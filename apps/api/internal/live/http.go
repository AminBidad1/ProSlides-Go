package live

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/proslides/proslides/internal/identity"
)

type ManagerAuth interface {
	Current(context.Context, string) (identity.StoredSession, error)
	Authorize(context.Context, string, string) (identity.User, error)
}
type RateLimiter interface {
	Allow(context.Context, string, string, int, time.Duration) (bool, time.Duration, error)
}
type HTTP struct {
	service *Service
	broker  *EventBroker
	auth    ManagerAuth
	secure  bool
	timeout time.Duration
	limiter RateLimiter
}

func NewHTTP(service *Service, broker *EventBroker, auth ManagerAuth, secure bool, limiter ...RateLimiter) *HTTP {
	h := &HTTP{service: service, broker: broker, auth: auth, secure: secure, timeout: 10 * time.Second}
	if len(limiter) > 0 {
		h.limiter = limiter[0]
	}
	return h
}
func (h *HTTP) WithRequestTimeout(timeout time.Duration) *HTTP {
	if timeout > 0 {
		h.timeout = timeout
	}
	return h
}
func (h *HTTP) Register(m *http.ServeMux) {
	m.HandleFunc("POST /api/v1/live/sessions", h.createSession)
	m.HandleFunc("GET /api/v1/live/sessions/resolve", h.resolveSession)
	m.HandleFunc("POST /api/v1/live/sessions/{sessionId}/join", h.join)
	m.HandleFunc("POST /api/v1/live/sessions/{sessionId}/actions", h.action)
	m.HandleFunc("POST /api/v1/live/sessions/{sessionId}/answers", h.answer)
	m.HandleFunc("GET /api/v1/live/sessions/{sessionId}/snapshot", h.snapshot)
	m.HandleFunc("GET /api/v1/live/sessions/{sessionId}/stage", h.stage)
	m.HandleFunc("GET /api/v1/live/sessions/{sessionId}/roster", h.roster)
	m.HandleFunc("GET /api/v1/live/sessions/{sessionId}/events", h.events)
}
func (h *HTTP) resolveSession(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	x, e := h.service.ResolveSession(r.Context(), r.URL.Query().Get("join_code"))
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, http.StatusOK, x)
}
func (h *HTTP) createSession(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	u, e := h.manager(r, true)
	if e != nil {
		returnError(w, e)
		return
	}
	var b struct {
		RequestID      string `json:"request_id"`
		PresentationID string `json:"presentation_id"`
	}
	if decodeJSON(w, r, &b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	x, dup, e := h.service.CreateSession(r.Context(), u.ID, b.PresentationID, b.RequestID)
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, map[bool]int{true: 200, false: 201}[dup], x)
}
func (h *HTTP) join(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	var b struct {
		RequestID   string `json:"request_id"`
		DisplayName string `json:"display_name"`
		Avatar      string `json:"avatar"`
	}
	if decodeJSON(w, r, &b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	if !h.allow(w, r, "live_join_session", r.PathValue("sessionId"), 20_000, time.Minute) {
		return
	}
	p, dup, e := h.service.Join(r.Context(), r.PathValue("sessionId"), b.RequestID, b.DisplayName, b.Avatar)
	if e != nil {
		returnError(w, e)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "proslides_participant", Value: b.RequestID, Path: "/api/v1/live/sessions/" + r.PathValue("sessionId"), HttpOnly: true, Secure: h.secure, SameSite: http.SameSiteLaxMode})
	writeJSON(w, map[bool]int{true: 200, false: 201}[dup], p)
}
func (h *HTTP) action(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	u, e := h.manager(r, true)
	if e != nil {
		returnError(w, e)
		return
	}
	if !h.allow(w, r, "live_manager_action", u.ID, 120, time.Minute) {
		return
	}
	var b struct {
		RequestID            string `json:"request_id"`
		ExpectedStateVersion int64  `json:"expected_state_version"`
		Action               string `json:"action"`
		ItemID               string `json:"item_id"`
	}
	if decodeJSON(w, r, &b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	x, dup, e := h.service.Action(r.Context(), r.PathValue("sessionId"), u.ID, b.RequestID, b.ExpectedStateVersion, b.Action, b.ItemID)
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, map[bool]int{true: 200, false: 201}[dup], x)
}
func (h *HTTP) answer(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	token, e := r.Cookie("proslides_participant")
	if e != nil {
		returnError(w, ErrUnauthorized)
		return
	}
	if !h.allow(w, r, "live_answer_participant", r.PathValue("sessionId")+":"+token.Value, 10, time.Second) || !h.allow(w, r, "live_answer_session", r.PathValue("sessionId"), 20_000, time.Second) {
		return
	}
	var b struct {
		RequestID      string          `json:"request_id"`
		ActivityItemID string          `json:"activity_item_id"`
		Response       json.RawMessage `json:"response"`
	}
	if decodeJSON(w, r, &b) != nil {
		returnError(w, ErrInvalid)
		return
	}
	if len(b.Response) == 0 {
		returnError(w, ErrInvalid)
		return
	}
	x, e := h.service.Submit(r.Context(), r.PathValue("sessionId"), token.Value, b.RequestID, b.ActivityItemID, b.Response)
	if e != nil {
		if !errors.Is(e, ErrInvalid) && !errors.Is(e, ErrUnauthorized) && !errors.Is(e, ErrConflict) && !errors.Is(e, ErrInvalidTransition) {
			slog.Error("live answer command failed", "session_id", r.PathValue("sessionId"), "request_id", b.RequestID, "error", e)
		}
		returnError(w, e)
		return
	}
	status := 201
	if x.Duplicate {
		status = 200
	}
	writeJSON(w, status, x)
}
func (h *HTTP) snapshot(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	sessionID := r.PathValue("sessionId")
	includeItems := false
	if raw := r.URL.Query().Get("include_items"); raw != "" {
		var parseErr error
		includeItems, parseErr = strconv.ParseBool(raw)
		if parseErr != nil {
			returnError(w, ErrInvalid)
			return
		}
	}

	switch r.URL.Query().Get("viewer") {
	case "manager":
		u, e := h.manager(r, false)
		if e != nil {
			returnError(w, ErrUnauthorized)
			return
		}
		x, e := h.service.ManagerSnapshot(r.Context(), sessionID, u.ID, includeItems)
		if e != nil {
			returnError(w, e)
			return
		}
		writeJSON(w, http.StatusOK, x)
		return
	case "participant":
		participant, e := r.Cookie("proslides_participant")
		if e != nil {
			returnError(w, ErrUnauthorized)
			return
		}
		x, e := h.service.ParticipantSnapshot(r.Context(), sessionID, participant.Value)
		if e != nil {
			returnError(w, e)
			return
		}
		writeJSON(w, http.StatusOK, x)
		return
	case "":
		// Backward-compatible negotiation for older clients. First-party clients
		// always declare a viewer role so mixed manager/participant cookies cannot
		// silently select the wrong projection.
	default:
		returnError(w, ErrInvalid)
		return
	}

	managerAuthenticated := false
	if u, e := h.manager(r, false); e == nil {
		managerAuthenticated = true
		x, snapshotErr := h.service.ManagerSnapshot(r.Context(), sessionID, u.ID, includeItems)
		if snapshotErr == nil {
			writeJSON(w, http.StatusOK, x)
			return
		}
		if !errors.Is(snapshotErr, ErrNotFound) {
			returnError(w, snapshotErr)
			return
		}
	}
	participant, e := r.Cookie("proslides_participant")
	if e != nil {
		if managerAuthenticated {
			returnError(w, ErrNotFound)
		} else {
			returnError(w, ErrUnauthorized)
		}
		return
	}
	x, e := h.service.ParticipantSnapshot(r.Context(), sessionID, participant.Value)
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, http.StatusOK, x)
}

func (h *HTTP) stage(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	u, e := h.manager(r, false)
	if e != nil {
		returnError(w, ErrUnauthorized)
		return
	}
	x, e := h.service.StageSnapshot(r.Context(), r.PathValue("sessionId"), u.ID)
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, http.StatusOK, x)
}

func (h *HTTP) roster(w http.ResponseWriter, r *http.Request) {
	r, cancel := h.bounded(r)
	defer cancel()
	u, e := h.manager(r, false)
	if e != nil {
		returnError(w, ErrUnauthorized)
		return
	}
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, e = strconv.Atoi(raw)
		if e != nil {
			returnError(w, ErrInvalid)
			return
		}
	}
	order := r.URL.Query().Get("order")
	if order == "" {
		order = "joined"
	}
	x, e := h.service.Roster(r.Context(), r.PathValue("sessionId"), u.ID, order, limit, r.URL.Query().Get("cursor"))
	if e != nil {
		returnError(w, e)
		return
	}
	writeJSON(w, http.StatusOK, x)
}
type eventViewer struct {
	role             string
	rateLimitIdentity string
	participantToken string
}

func (h *HTTP) eventViewer(r *http.Request) (eventViewer, error) {
	sessionID := r.PathValue("sessionId")
	viewerRole := r.URL.Query().Get("viewer")

	managerViewer := func(role string) (eventViewer, error) {
		manager, err := h.manager(r, false)
		if err != nil {
			return eventViewer{}, ErrUnauthorized
		}
		if err = h.service.AuthorizeViewer(r.Context(), sessionID, manager.ID, ""); err != nil {
			return eventViewer{}, err
		}
		return eventViewer{
			role:             role,
			rateLimitIdentity: role + ":" + manager.ID,
		}, nil
	}
	participantViewer := func() (eventViewer, error) {
		participant, err := r.Cookie("proslides_participant")
		if err != nil {
			return eventViewer{}, ErrUnauthorized
		}
		if err = h.service.AuthorizeViewer(r.Context(), sessionID, "", participant.Value); err != nil {
			return eventViewer{}, err
		}
		return eventViewer{
			role:             "participant",
			rateLimitIdentity: "participant:" + participant.Value,
			participantToken: participant.Value,
		}, nil
	}

	switch viewerRole {
	case "manager":
		return managerViewer("manager")
	case "stage":
		return managerViewer("stage")
	case "participant":
		return participantViewer()
	case "":
		// Legacy auto-negotiation. Explicit roles above are required by first-party
		// clients and avoid ambiguity when both cookies exist in one browser.
	default:
		return eventViewer{}, ErrInvalid
	}

	if viewer, err := managerViewer("manager"); err == nil {
		return viewer, nil
	} else if !errors.Is(err, ErrUnauthorized) && !errors.Is(err, ErrNotFound) {
		return eventViewer{}, err
	}
	return participantViewer()
}

func eventVisibleToViewer(role string, event Event) bool {
	// Activity results are computed at close so managers can inspect them
	// privately. Participants receive the authoritative result from the
	// revealed snapshot after session.state_changed; broadcasting the close
	// event would disclose results before the presenter reveals them.
	return role == "manager" || event.Name != "activity.result_updated"
}

func (h *HTTP) events(w http.ResponseWriter, r *http.Request) {
	viewer, e := h.eventViewer(r)
	if e != nil {
		returnError(w, e)
		return
	}
	sessionID := r.PathValue("sessionId")
	if !h.allow(w, r, "live_sse_reconnect", sessionID+":"+viewer.rateLimitIdentity, 60, time.Minute) {
		return
	}
	f, ok := w.(http.Flusher)
	if !ok {
		returnError(w, errors.New("stream unsupported"))
		return
	}
	subscription, unsubscribe, e := h.broker.Subscribe(r.Context(), sessionID)
	if e != nil {
		returnError(w, e)
		return
	}
	defer unsubscribe()

	// Presence is reference-counted per participant credential. Register the
	// connection only after the broker subscription succeeds, then always
	// release exactly one reference when this stream exits.
	if viewer.participantToken != "" {
		if e = h.service.SetParticipantPresence(
			r.Context(),
			sessionID,
			viewer.participantToken,
			false,
		); e != nil {
			returnError(w, e)
			return
		}
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = h.service.SetParticipantPresence(
				ctx,
				sessionID,
				viewer.participantToken,
				true,
			)
		}()
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-store, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	after, _ := strconv.ParseInt(r.Header.Get("Last-Event-ID"), 10, 64)
	for {
		events, eventErr := h.service.Events(r.Context(), sessionID, after)
		if eventErr != nil {
			return
		}
		for _, event := range compactEvents(events) {
			if eventVisibleToViewer(viewer.role, event) {
				writeEvent(w, event)
			}
		}
		if len(events) > 0 {
			after = events[len(events)-1].EventID
		}
		if len(events) < eventPageSize {
			break
		}
	}
	f.Flush()
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			fmt.Fprint(w, ": heartbeat\n\n")
			f.Flush()
		case event, open := <-subscription:
			if !open {
				return
			}
			if event.EventID <= after {
				continue
			}
			after = event.EventID
			if !eventVisibleToViewer(viewer.role, event) {
				continue
			}
			writeEvent(w, event)
			f.Flush()
		}
	}
}

func writeEvent(w http.ResponseWriter, event Event) {
	data, _ := json.Marshal(event)
	fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", event.EventID, event.Name, data)
}
func (h *HTTP) manager(r *http.Request, csrf bool) (identity.User, error) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		return identity.User{}, ErrUnauthorized
	}
	if csrf {
		u, e := h.auth.Authorize(r.Context(), c.Value, r.Header.Get("X-CSRF-Token"))
		if e != nil {
			return identity.User{}, ErrCSRF
		}
		return u, nil
	}
	s, e := h.auth.Current(r.Context(), c.Value)
	return s.User, e
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func (h *HTTP) bounded(r *http.Request) (*http.Request, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(r.Context(), h.timeout)
	return r.WithContext(ctx), cancel
}
func (h *HTTP) allow(w http.ResponseWriter, r *http.Request, scope, identity string, limit int, window time.Duration) bool {
	if h.limiter == nil {
		return true
	}
	allowed, retry, err := h.limiter.Allow(r.Context(), scope, identity, limit, window)
	if err != nil {
		// Durable live commands remain available during Redis degradation.
		return true
	}
	if allowed {
		return true
	}
	seconds := int((retry + time.Second - 1) / time.Second)
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "rate_limited", "retry_after_seconds": seconds})
	return false
}
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return ErrInvalid
	}
	return nil
}
func returnError(w http.ResponseWriter, e error) {
	status, code := 500, "internal_error"
	switch {
	case errors.Is(e, identity.ErrInvalidCredentials), errors.Is(e, ErrUnauthorized):
		status, code = 401, "unauthorized"
	case errors.Is(e, ErrCSRF):
		status, code = 403, "csrf_failed"
	case errors.Is(e, ErrInvalid):
		status, code = 400, "invalid_request"
	case errors.Is(e, ErrNotFound):
		status, code = 404, "not_found"
	case errors.Is(e, ErrNameTaken):
		status, code = 409, "display_name_taken"
	case errors.Is(e, ErrConflict), errors.Is(e, ErrInvalidTransition):
		status, code = 409, "conflict"
	case errors.Is(e, context.DeadlineExceeded), errors.Is(e, context.Canceled):
		status, code = 503, "temporarily_unavailable"
	}
	writeJSON(w, status, map[string]string{"error": code})
}

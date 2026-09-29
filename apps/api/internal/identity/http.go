package identity

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	platformhttp "github.com/proslides/proslides/internal/platform/http"
)

type RateLimiter interface {
	Allow(context.Context, string, string, int, time.Duration) (bool, time.Duration, error)
}

type HTTP struct {
	service           *Service
	secure            bool
	limiter           RateLimiter
	trustedProxyCIDRs []netip.Prefix
}

// WithTrustedProxyCIDRs allows forwarded client addresses only when the direct
// peer is a configured proxy. The right-most untrusted address is selected so
// user-supplied X-Forwarded-For prefixes cannot bypass distributed limits.
func (h *HTTP) WithTrustedProxyCIDRs(prefixes []netip.Prefix) *HTTP {
	h.trustedProxyCIDRs = append([]netip.Prefix(nil), prefixes...)
	return h
}

func NewHTTP(s *Service, secure bool, limiter ...RateLimiter) *HTTP {
	h := &HTTP{service: s, secure: secure}
	if len(limiter) > 0 {
		h.limiter = limiter[0]
	}
	return h
}
func (h *HTTP) Register(m *http.ServeMux) {
	m.HandleFunc("POST /api/v1/auth/register", h.register)
	m.HandleFunc("POST /api/v1/auth/login", h.login)
	m.HandleFunc("POST /api/v1/auth/verify", h.verify)
	m.HandleFunc("POST /api/v1/auth/verify/resend", h.resendVerification)
	m.HandleFunc("POST /api/v1/auth/google", h.google)
	m.HandleFunc("POST /api/v1/auth/logout", h.logout)
	m.HandleFunc("GET /api/v1/auth/me", h.me)
	m.HandleFunc("POST /api/v1/auth/password/reset", h.requestPasswordReset)
	m.HandleFunc("POST /api/v1/auth/password/reset/confirm", h.confirmPasswordReset)
}

func (h *HTTP) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	if !h.allow(w, r, "password_reset", 5, time.Hour) {
		return
	}
	var body struct {
		Email string `json:"email"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	err := h.service.RequestPasswordReset(r.Context(), body.Email)
	if errors.Is(err, ErrInvalidPasswordReset) {
		errJSON(w, 400, "invalid_request")
		return
	}
	if errors.Is(err, ErrPasswordResetUnavailable) {
		errJSON(w, 503, "password_reset_unavailable")
		return
	}
	if err != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (h *HTTP) confirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	if !h.allow(w, r, "password_reset_confirm", 10, time.Hour) {
		return
	}
	var body struct {
		UID         string `json:"uid"`
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	if err := h.service.ConfirmPasswordReset(r.Context(), body.UID, body.Token, body.NewPassword); err != nil {
		errJSON(w, 400, "invalid_or_expired_reset")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type credentials struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
}

func (h *HTTP) register(w http.ResponseWriter, r *http.Request) {
	if !h.allow(w, r, "register", 10, time.Minute) {
		return
	}
	var v credentials
	if json.NewDecoder(r.Body).Decode(&v) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	a, e := h.service.Register(r.Context(), Registration{v.Email, v.DisplayName, v.Password})
	h.auth(w, a, e, http.StatusCreated)
}
func (h *HTTP) login(w http.ResponseWriter, r *http.Request) {
	if !h.allow(w, r, "login", 10, time.Minute) {
		return
	}
	var v credentials
	if json.NewDecoder(r.Body).Decode(&v) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	a, e := h.service.Login(r.Context(), v.Email, v.Password)
	h.auth(w, a, e, http.StatusOK)
}

func (h *HTTP) verify(w http.ResponseWriter, r *http.Request) {
	if !h.allow(w, r, "verify", 10, time.Minute) {
		return
	}
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	a, err := h.service.VerifyEmail(r.Context(), body.Email, body.Code)
	if errors.Is(err, ErrVerificationExpired) {
		errJSON(w, 400, "verification_expired")
		return
	}
	if errors.Is(err, ErrVerificationAttempts) {
		errJSON(w, 429, "verification_attempts_exceeded")
		return
	}
	if errors.Is(err, ErrInvalidVerification) {
		errJSON(w, 400, "invalid_verification")
		return
	}
	h.auth(w, a, err, http.StatusOK)
}

func (h *HTTP) resendVerification(w http.ResponseWriter, r *http.Request) {
	if !h.allow(w, r, "verify_resend", 5, time.Hour) {
		return
	}
	var body struct {
		Email string `json:"email"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil {
		errJSON(w, 400, "invalid_request")
		return
	}
	issue, err := h.service.ResendVerification(r.Context(), body.Email)
	if errors.Is(err, ErrVerificationUnavailable) {
		errJSON(w, 503, "verification_unavailable")
		return
	}
	if err != nil {
		errJSON(w, 500, "internal_error")
		return
	}
	if issue.RetryAfter > 0 {
		seconds := ceilSeconds(issue.RetryAfter)
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
		writeJSON(w, 429, map[string]any{"error": "resend_too_soon", "retry_after_seconds": seconds})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"detail": "verification_sent", "resend_seconds": int(h.service.options.VerificationResendDelay.Seconds()), "code_expires_in_seconds": int(h.service.options.VerificationTTL.Seconds())})
}

func (h *HTTP) google(w http.ResponseWriter, r *http.Request) {
	if !h.allow(w, r, "google", 10, time.Minute) {
		return
	}
	var body struct {
		Token string `json:"token"`
	}
	if json.NewDecoder(r.Body).Decode(&body) != nil || strings.TrimSpace(body.Token) == "" {
		errJSON(w, 400, "invalid_request")
		return
	}
	a, err := h.service.GoogleAuthenticate(r.Context(), body.Token)
	if errors.Is(err, ErrGoogleUnavailable) {
		errJSON(w, 503, "google_auth_unavailable")
		return
	}
	if errors.Is(err, ErrInvalidGoogleCredential) {
		errJSON(w, 401, "invalid_google_credential")
		return
	}
	h.auth(w, a, err, http.StatusOK)
}

func (h *HTTP) auth(w http.ResponseWriter, a Authenticated, e error, successStatus int) {
	if e != nil {
		if errors.Is(e, ErrInvalidRegistration) {
			errJSON(w, 400, "invalid_request")
		} else if errors.Is(e, ErrEmailTaken) {
			errJSON(w, 409, "email_taken")
		} else if errors.Is(e, ErrInvalidCredentials) || errors.Is(e, ErrInvalidGoogleCredential) {
			errJSON(w, 401, "invalid_credentials")
		} else if errors.Is(e, ErrEmailNotVerified) {
			errJSON(w, 403, "email_not_verified")
		} else if errors.Is(e, ErrVerificationUnavailable) || errors.Is(e, ErrGoogleUnavailable) {
			errJSON(w, 503, "authentication_unavailable")
		} else {
			errJSON(w, 500, "internal_error")
		}
		return
	}
	if a.SessionEstablished {
		exp := a.Secrets.ExpiresAt
		http.SetCookie(w, &http.Cookie{Name: "proslides_session", Value: a.Secrets.Token, Path: "/", Expires: exp, HttpOnly: true, Secure: h.secure, SameSite: http.SameSiteLaxMode})
		http.SetCookie(w, &http.Cookie{Name: "proslides_csrf", Value: a.Secrets.CSRFToken, Path: "/", Expires: exp, Secure: h.secure, SameSite: http.SameSiteLaxMode})
	}
	w.WriteHeader(successStatus)
	json.NewEncoder(w).Encode(map[string]any{"id": a.User.ID, "email": a.User.Email, "display_name": a.User.DisplayName, "full_name": a.User.DisplayName, "is_active": a.User.IsActive, "verification_sent": a.VerificationSent, "code_expires_in_seconds": a.VerificationExpiresIn, "resend_seconds": int(h.service.options.VerificationResendDelay.Seconds()), "is_new_user": a.IsNewUser, "needs_password_setup": a.IsNewUser})
}

func (h *HTTP) allow(w http.ResponseWriter, r *http.Request, scope string, limit int, window time.Duration) bool {
	if h.limiter == nil {
		return true
	}
	host := h.clientAddress(r)
	allowed, retry, err := h.limiter.Allow(r.Context(), scope, host, limit, window)
	if err != nil {
		// Authentication remains available during a Redis outage; dependency health still reports it.
		return true
	}
	if allowed {
		return true
	}
	seconds := ceilSeconds(retry)
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	writeJSON(w, 429, map[string]any{"error": "rate_limited", "retry_after_seconds": seconds})
	return false
}

func (h *HTTP) clientAddress(r *http.Request) string {
	return platformhttp.ClientAddress(r, h.trustedProxyCIDRs)
}
func (h *HTTP) me(w http.ResponseWriter, r *http.Request) {
	c, e := r.Cookie("proslides_session")
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	s, e := h.service.Current(r.Context(), c.Value)
	if e != nil {
		errJSON(w, 401, "unauthorized")
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"id": s.User.ID, "email": s.User.Email, "display_name": s.User.DisplayName, "is_active": s.User.IsActive})
}
func (h *HTTP) logout(w http.ResponseWriter, r *http.Request) {
	s, _ := r.Cookie("proslides_session")
	c, _ := r.Cookie("proslides_csrf")
	if s == nil || c == nil || r.Header.Get("X-CSRF-Token") != c.Value || h.service.Logout(r.Context(), s.Value, c.Value) != nil {
		errJSON(w, 403, "csrf_failed")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "proslides_session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: h.secure})
	http.SetCookie(w, &http.Cookie{Name: "proslides_csrf", Value: "", Path: "/", MaxAge: -1, Secure: h.secure})
	w.WriteHeader(204)
}
func errJSON(w http.ResponseWriter, s int, e string) {
	writeJSON(w, s, map[string]string{"error": e})
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func ceilSeconds(value time.Duration) int { return int((value + time.Second - 1) / time.Second) }

var _ = time.Now

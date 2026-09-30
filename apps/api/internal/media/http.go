package media

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/proslides/proslides/internal/identity"
)

type SessionReader interface {
	Current(context.Context, string) (identity.StoredSession, error)
	Authorize(context.Context, string, string) (identity.User, error)
}

type HTTP struct {
	sessions SessionReader
	service  *Service
}

func NewHTTP(sessions SessionReader, service *Service) *HTTP {
	return &HTTP{sessions: sessions, service: service}
}

func (h *HTTP) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/media/backgrounds", h.uploadBackground)
	mux.HandleFunc("GET /api/v1/media/assets/{assetId}/content", h.content)
	mux.HandleFunc("HEAD /api/v1/media/assets/{assetId}/content", h.content)
}

func (h *HTTP) authorizedMutation(w http.ResponseWriter, r *http.Request) (identity.User, bool) {
	cookie, err := r.Cookie("proslides_session")
	if err != nil {
		mediaError(w, http.StatusUnauthorized, "unauthorized")
		return identity.User{}, false
	}
	user, err := h.sessions.Authorize(
		r.Context(),
		cookie.Value,
		r.Header.Get("X-CSRF-Token"),
	)
	if err != nil {
		mediaError(w, http.StatusForbidden, "csrf_failed")
		return identity.User{}, false
	}
	return user, true
}

func readUploadFile(w http.ResponseWriter, r *http.Request) ([]byte, string, error) {
	r.Body = http.MaxBytesReader(
		w,
		r.Body,
		MaxBackgroundUploadBytes+(1<<20),
	)
	reader, err := r.MultipartReader()
	if err != nil {
		return nil, "", ErrInvalidImage
	}

	var (
		data     []byte
		filename string
		found    bool
	)
	for {
		part, nextErr := reader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(nextErr, &tooLarge) {
				return nil, "", ErrMediaTooLarge
			}
			return nil, "", ErrInvalidImage
		}

		if part.FormName() != "file" || part.FileName() == "" {
			part.Close()
			continue
		}
		if found {
			part.Close()
			return nil, "", ErrInvalidImage
		}
		found = true
		filename = part.FileName()
		payload, readErr := io.ReadAll(
			io.LimitReader(part, MaxBackgroundUploadBytes+1),
		)
		part.Close()
		if readErr != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(readErr, &tooLarge) {
				return nil, "", ErrMediaTooLarge
			}
			return nil, "", ErrInvalidImage
		}
		if len(payload) > MaxBackgroundUploadBytes {
			return nil, "", ErrMediaTooLarge
		}
		data = payload
	}

	if !found || len(data) == 0 {
		return nil, "", ErrInvalidImage
	}
	return data, filename, nil
}

func (h *HTTP) uploadBackground(w http.ResponseWriter, r *http.Request) {
	user, ok := h.authorizedMutation(w, r)
	if !ok {
		return
	}
	data, filename, err := readUploadFile(w, r)
	if err != nil {
		writeMediaServiceError(w, err)
		return
	}
	asset, err := h.service.UploadBackground(
		r.Context(),
		user.ID,
		filename,
		data,
	)
	if err != nil {
		writeMediaServiceError(w, err)
		return
	}
	mediaJSON(w, http.StatusCreated, asset)
}

func (h *HTTP) content(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("assetId")
	if !validAssetUUID(id) {
		mediaError(w, http.StatusNotFound, "not_found")
		return
	}
	asset, body, err := h.service.Open(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			mediaError(w, http.StatusNotFound, "not_found")
			return
		}
		mediaError(w, http.StatusServiceUnavailable, "media_storage_unavailable")
		return
	}
	defer body.Close()

	w.Header().Set("Content-Type", asset.MimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(asset.ByteSize, 10))
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", `"`+hex.EncodeToString(asset.SHA256)+`"`)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	w.WriteHeader(http.StatusOK)
	if _, err = io.Copy(w, body); err != nil {
		slog.Warn("media response interrupted", "asset_id", asset.ID, "error", err)
	}
}

func writeMediaServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrMediaTooLarge):
		mediaError(w, http.StatusRequestEntityTooLarge, "media_too_large")
	case errors.Is(err, ErrImageDimensions):
		mediaError(w, http.StatusBadRequest, "image_dimensions_invalid")
	case errors.Is(err, ErrInvalidImage):
		mediaError(w, http.StatusBadRequest, "invalid_image")
	case errors.Is(err, ErrStorageUnavailable):
		mediaError(w, http.StatusServiceUnavailable, "media_storage_unavailable")
	default:
		mediaError(w, http.StatusInternalServerError, "internal_error")
	}
}

func validAssetUUID(value string) bool {
	if len(value) != 36 ||
		value[8] != '-' ||
		value[13] != '-' ||
		value[18] != '-' ||
		value[23] != '-' {
		return false
	}
	_, err := hex.DecodeString(
		value[0:8] +
			value[9:13] +
			value[14:18] +
			value[19:23] +
			value[24:36],
	)
	return err == nil
}

func mediaJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func mediaError(w http.ResponseWriter, status int, code string) {
	mediaJSON(w, status, map[string]string{"error": code})
}

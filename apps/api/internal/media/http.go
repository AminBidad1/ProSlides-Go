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
	mux.HandleFunc("GET /api/v1/media/backgrounds", h.listBackgrounds)
	mux.HandleFunc("POST /api/v1/media/backgrounds", h.uploadBackground)
	mux.HandleFunc("GET /api/v1/media/assets/{assetId}/content", h.content)
	mux.HandleFunc("HEAD /api/v1/media/assets/{assetId}/content", h.content)
	mux.HandleFunc("GET /api/v1/media/assets/{assetId}/thumbnail", h.thumbnail)
	mux.HandleFunc("HEAD /api/v1/media/assets/{assetId}/thumbnail", h.thumbnail)
}

func (h *HTTP) currentUser(
	w http.ResponseWriter,
	r *http.Request,
) (identity.User, bool) {
	cookie, err := r.Cookie("proslides_session")
	if err != nil {
		mediaError(w, http.StatusUnauthorized, "unauthorized")
		return identity.User{}, false
	}
	session, err := h.sessions.Current(r.Context(), cookie.Value)
	if err != nil {
		mediaError(w, http.StatusUnauthorized, "unauthorized")
		return identity.User{}, false
	}
	return session.User, true
}

func (h *HTTP) authorizedMutation(
	w http.ResponseWriter,
	r *http.Request,
) (identity.User, bool) {
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

type uploadPayload struct {
	file      []byte
	filename  string
	thumbnail []byte
}

func readUploadFile(w http.ResponseWriter, r *http.Request) (uploadPayload, error) {
	r.Body = http.MaxBytesReader(
		w,
		r.Body,
		MaxBackgroundUploadBytes+MaxThumbnailUploadBytes+(1<<20),
	)
	reader, err := r.MultipartReader()
	if err != nil {
		return uploadPayload{}, ErrInvalidImage
	}

	var payload uploadPayload
	var foundFile, foundThumbnail bool
	for {
		part, nextErr := reader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(nextErr, &tooLarge) {
				return uploadPayload{}, ErrMediaTooLarge
			}
			return uploadPayload{}, ErrInvalidImage
		}

		switch part.FormName() {
		case "file":
			if part.FileName() == "" || foundFile {
				part.Close()
				return uploadPayload{}, ErrInvalidImage
			}
			foundFile = true
			payload.filename = part.FileName()
			payload.file, err = io.ReadAll(
				io.LimitReader(part, MaxBackgroundUploadBytes+1),
			)
		case "thumbnail":
			if part.FileName() == "" || foundThumbnail {
				part.Close()
				return uploadPayload{}, ErrInvalidImage
			}
			foundThumbnail = true
			payload.thumbnail, err = io.ReadAll(
				io.LimitReader(part, MaxThumbnailUploadBytes+1),
			)
		default:
			part.Close()
			continue
		}
		part.Close()
		if err != nil {
			return uploadPayload{}, ErrInvalidImage
		}
		if len(payload.file) > MaxBackgroundUploadBytes ||
			len(payload.thumbnail) > MaxThumbnailUploadBytes {
			return uploadPayload{}, ErrMediaTooLarge
		}
	}

	if !foundFile || len(payload.file) == 0 {
		return uploadPayload{}, ErrInvalidImage
	}
	return payload, nil
}

func (h *HTTP) uploadBackground(w http.ResponseWriter, r *http.Request) {
	user, ok := h.authorizedMutation(w, r)
	if !ok {
		return
	}
	payload, err := readUploadFile(w, r)
	if err != nil {
		writeMediaServiceError(w, err)
		return
	}
	asset, err := h.service.UploadBackground(
		r.Context(),
		user.ID,
		payload.filename,
		payload.file,
		payload.thumbnail,
	)
	if err != nil {
		writeMediaServiceError(w, err)
		return
	}
	mediaJSON(w, http.StatusCreated, asset)
}

func (h *HTTP) listBackgrounds(w http.ResponseWriter, r *http.Request) {
	user, ok := h.currentUser(w, r)
	if !ok {
		return
	}

	limit := DefaultLibraryPageSize
	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > MaxLibraryPageSize {
			mediaError(w, http.StatusBadRequest, "invalid_limit")
			return
		}
		limit = parsed
	}
	page, err := h.service.ListBackgrounds(
		r.Context(),
		user.ID,
		r.URL.Query().Get("cursor"),
		limit,
	)
	if err != nil {
		if errors.Is(err, ErrInvalidCursor) {
			mediaError(w, http.StatusBadRequest, "invalid_cursor")
			return
		}
		mediaError(w, http.StatusInternalServerError, "internal_error")
		return
	}
	mediaJSON(w, http.StatusOK, page)
}

func (h *HTTP) content(w http.ResponseWriter, r *http.Request) {
	h.serveAsset(w, r, false)
}

func (h *HTTP) thumbnail(w http.ResponseWriter, r *http.Request) {
	h.serveAsset(w, r, true)
}

func (h *HTTP) serveAsset(
	w http.ResponseWriter,
	r *http.Request,
	thumbnail bool,
) {
	id := r.PathValue("assetId")
	if !validAssetUUID(id) {
		mediaError(w, http.StatusNotFound, "not_found")
		return
	}

	var (
		asset Asset
		body  io.ReadCloser
		err   error
	)
	if thumbnail {
		asset, body, err = h.service.OpenThumbnail(r.Context(), id)
	} else {
		asset, body, err = h.service.Open(r.Context(), id)
	}
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			mediaError(w, http.StatusNotFound, "not_found")
			return
		}
		mediaError(w, http.StatusServiceUnavailable, "media_storage_unavailable")
		return
	}
	defer body.Close()

	mimeType := asset.MimeType
	byteSize := asset.ByteSize
	if thumbnail && asset.ThumbnailStorageKey != "" {
		mimeType = asset.ThumbnailMimeType
		byteSize = asset.ThumbnailByteSize
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(byteSize, 10))
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	if !thumbnail || asset.ThumbnailStorageKey == "" {
		w.Header().Set("ETag", `"`+hex.EncodeToString(asset.SHA256)+`"`)
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	w.WriteHeader(http.StatusOK)
	if _, err = io.Copy(w, body); err != nil {
		slog.Warn(
			"media response interrupted",
			"asset_id",
			asset.ID,
			"thumbnail",
			thumbnail,
			"error",
			err,
		)
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

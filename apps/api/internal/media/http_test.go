package media

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/proslides/proslides/internal/identity"
)

type fakeSessions struct {
	err error
}

func (f fakeSessions) Current(context.Context, string) (identity.StoredSession, error) {
	if f.err != nil {
		return identity.StoredSession{}, f.err
	}
	return identity.StoredSession{
		User: identity.User{ID: "owner-id"},
	}, nil
}

func (f fakeSessions) Authorize(context.Context, string, string) (identity.User, error) {
	if f.err != nil {
		return identity.User{}, f.err
	}
	return identity.User{ID: "owner-id"}, nil
}

func multipartBackground(t *testing.T, filename string, payload []byte) (*bytes.Buffer, string) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = part.Write(payload); err != nil {
		t.Fatal(err)
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	return &body, writer.FormDataContentType()
}

func TestBackgroundUploadRequiresAuthorizedMutation(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(fakeSessions{}, NewService(&fakeStore{}, NewMemoryObjectStore())).Register(mux)

	body, contentType := multipartBackground(t, "bg.jpg", jpegFixture(t, 8, 8))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/media/backgrounds", body)
	req.Header.Set("Content-Type", contentType)
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)

	if result.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
}

func TestBackgroundUploadReturnsStableFirstPartyURL(t *testing.T) {
	store := &fakeStore{}
	objects := NewMemoryObjectStore()
	mux := http.NewServeMux()
	NewHTTP(fakeSessions{}, NewService(store, objects)).Register(mux)

	body, contentType := multipartBackground(t, "bg.jpg", jpegFixture(t, 16, 9))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/media/backgrounds", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-CSRF-Token", "csrf")
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "session"})
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)

	if result.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
	var asset Asset
	if err := json.Unmarshal(result.Body.Bytes(), &asset); err != nil {
		t.Fatal(err)
	}
	if asset.Status != StatusReady ||
		!strings.HasPrefix(asset.URL, "/api/v1/media/assets/") ||
		!strings.HasSuffix(asset.URL, "/content") {
		t.Fatalf("asset=%+v", asset)
	}

	get := httptest.NewRequest(http.MethodGet, asset.URL, nil)
	getResult := httptest.NewRecorder()
	mux.ServeHTTP(getResult, get)
	if getResult.Code != http.StatusOK {
		t.Fatalf("get status=%d body=%s", getResult.Code, getResult.Body.String())
	}
	if getResult.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("cache-control=%q", getResult.Header().Get("Cache-Control"))
	}
	if getResult.Header().Get("ETag") == "" ||
		getResult.Header().Get("Content-Type") != "image/jpeg" {
		t.Fatalf("headers=%v", getResult.Header())
	}
}

func TestBackgroundUploadRejectsNonImage(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(fakeSessions{}, NewService(&fakeStore{}, NewMemoryObjectStore())).Register(mux)

	body, contentType := multipartBackground(t, "notes.txt", []byte("hello"))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/media/backgrounds", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-CSRF-Token", "csrf")
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "session"})
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)

	if result.Code != http.StatusBadRequest ||
		!strings.Contains(result.Body.String(), "invalid_image") {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
}

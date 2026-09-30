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

func multipartBackground(
	t *testing.T,
	filename string,
	payload []byte,
	thumbnail []byte,
) (*bytes.Buffer, string) {
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
	if len(thumbnail) > 0 {
		thumb, createErr := writer.CreateFormFile("thumbnail", "thumbnail.jpg")
		if createErr != nil {
			t.Fatal(createErr)
		}
		if _, createErr = thumb.Write(thumbnail); createErr != nil {
			t.Fatal(createErr)
		}
	}
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	return &body, writer.FormDataContentType()
}

func TestBackgroundUploadRequiresAuthorizedMutation(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(
		fakeSessions{},
		NewService(newFakeStore(), NewMemoryObjectStore()),
	).Register(mux)

	body, contentType := multipartBackground(
		t,
		"bg.jpg",
		jpegFixture(t, 8, 8),
		nil,
	)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/media/backgrounds", body)
	req.Header.Set("Content-Type", contentType)
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)

	if result.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
}

func TestBackgroundUploadReturnsStableFirstPartyURLs(t *testing.T) {
	store := newFakeStore()
	objects := NewMemoryObjectStore()
	mux := http.NewServeMux()
	NewHTTP(fakeSessions{}, NewService(store, objects)).Register(mux)

	body, contentType := multipartBackground(
		t,
		"my-stage.jpg",
		jpegFixture(t, 16, 9),
		jpegFixture(t, 8, 5),
	)
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
		asset.OriginalFilename != "my-stage.jpg" ||
		!strings.HasSuffix(asset.URL, "/content") ||
		!strings.HasSuffix(asset.ThumbnailURL, "/thumbnail") {
		t.Fatalf("asset=%+v", asset)
	}

	for _, target := range []string{asset.URL, asset.ThumbnailURL} {
		get := httptest.NewRequest(http.MethodGet, target, nil)
		getResult := httptest.NewRecorder()
		mux.ServeHTTP(getResult, get)
		if getResult.Code != http.StatusOK {
			t.Fatalf("get %s status=%d body=%s", target, getResult.Code, getResult.Body.String())
		}
		if getResult.Header().Get("Cache-Control") !=
			"public, max-age=31536000, immutable" {
			t.Fatalf("cache-control=%q", getResult.Header().Get("Cache-Control"))
		}
		if getResult.Header().Get("Content-Type") != "image/jpeg" {
			t.Fatalf("headers=%v", getResult.Header())
		}
	}
}

func TestBackgroundLibraryRequiresSessionAndListsOwnerAssets(t *testing.T) {
	store := newFakeStore()
	store.assets["123e4567-e89b-42d3-a456-426614174000"] = Asset{
		ID:               "123e4567-e89b-42d3-a456-426614174000",
		OwnerID:          "owner-id",
		Purpose:          PurposeBackground,
		Status:           StatusReady,
		StorageKey:       "one.jpg",
		MimeType:         "image/jpeg",
		Width:            1920,
		Height:           1080,
		ByteSize:         100,
		OriginalFilename: "hero.jpg",
	}
	store.assets["123e4567-e89b-42d3-a456-426614174001"] = Asset{
		ID:        "123e4567-e89b-42d3-a456-426614174001",
		OwnerID:   "other-owner",
		Purpose:   PurposeBackground,
		Status:    StatusReady,
		CreatedAt: store.assets["123e4567-e89b-42d3-a456-426614174000"].CreatedAt,
	}

	mux := http.NewServeMux()
	NewHTTP(
		fakeSessions{},
		NewService(store, NewMemoryObjectStore()),
	).Register(mux)

	unauthorized := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/media/backgrounds",
		nil,
	)
	unauthorizedResult := httptest.NewRecorder()
	mux.ServeHTTP(unauthorizedResult, unauthorized)
	if unauthorizedResult.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d", unauthorizedResult.Code)
	}

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/media/backgrounds?limit=12",
		nil,
	)
	req.AddCookie(&http.Cookie{Name: "proslides_session", Value: "session"})
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)
	if result.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}

	var page AssetPage
	if err := json.Unmarshal(result.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 ||
		page.Items[0].OwnerID != "" ||
		page.Items[0].OriginalFilename != "hero.jpg" {
		t.Fatalf("page=%+v", page)
	}
}

func TestBackgroundUploadRejectsNonImage(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(
		fakeSessions{},
		NewService(newFakeStore(), NewMemoryObjectStore()),
	).Register(mux)

	body, contentType := multipartBackground(t, "notes.txt", []byte("hello"), nil)
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

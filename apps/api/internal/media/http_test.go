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

func (f fakeSessions) Current(
	context.Context,
	string,
) (identity.StoredSession, error) {
	if f.err != nil {
		return identity.StoredSession{}, f.err
	}
	return identity.StoredSession{
		User: identity.User{ID: "owner-id"},
	}, nil
}

func (f fakeSessions) Authorize(
	context.Context,
	string,
	string,
) (identity.User, error) {
	if f.err != nil {
		return identity.User{}, f.err
	}
	return identity.User{ID: "owner-id"}, nil
}

func multipartImage(
	t *testing.T,
	filename string,
	payload []byte,
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
	if err = writer.Close(); err != nil {
		t.Fatal(err)
	}
	return &body, writer.FormDataContentType()
}

func TestImageUploadRequiresAuthorizedMutation(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(
		fakeSessions{},
		NewService(newFakeStore(), NewMemoryObjectStore()),
	).Register(mux)

	body, contentType := multipartImage(
		t,
		"image.jpg",
		jpegFixture(t, 8, 8),
	)
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/media/images",
		body,
	)
	req.Header.Set("Content-Type", contentType)
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)

	if result.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
}

func TestImageUploadReturnsStableContentAndRenditionURLs(t *testing.T) {
	store := newFakeStore()
	objects := NewMemoryObjectStore()
	mux := http.NewServeMux()
	NewHTTP(fakeSessions{}, NewService(store, objects)).Register(mux)

	body, contentType := multipartImage(
		t,
		"stage-and-question.jpg",
		jpegFixture(t, 1300, 800),
	)
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/media/images",
		body,
	)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-CSRF-Token", "csrf")
	req.AddCookie(&http.Cookie{
		Name:  "proslides_session",
		Value: "session",
	})
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
		asset.Purpose != PurposeImage ||
		asset.OriginalFilename != "stage-and-question.jpg" ||
		!strings.HasSuffix(asset.URL, "/content") ||
		asset.Renditions.Thumbnail == nil ||
		!strings.HasSuffix(
			asset.Renditions.Thumbnail.URL,
			"/renditions/thumbnail",
		) ||
		asset.Renditions.Medium == nil ||
		!strings.HasSuffix(
			asset.Renditions.Medium.URL,
			"/renditions/medium",
		) {
		t.Fatalf("asset=%+v", asset)
	}

	for _, target := range []string{
		asset.URL,
		asset.Renditions.Thumbnail.URL,
		asset.Renditions.Medium.URL,
	} {
		get := httptest.NewRequest(http.MethodGet, target, nil)
		getResult := httptest.NewRecorder()
		mux.ServeHTTP(getResult, get)
		if getResult.Code != http.StatusOK {
			t.Fatalf(
				"get %s status=%d body=%s",
				target,
				getResult.Code,
				getResult.Body.String(),
			)
		}
		if getResult.Header().Get("Cache-Control") !=
			"public, max-age=31536000, immutable" {
			t.Fatalf(
				"cache-control=%q",
				getResult.Header().Get("Cache-Control"),
			)
		}
		if getResult.Header().Get("Content-Type") != "image/jpeg" ||
			getResult.Header().Get("ETag") == "" {
			t.Fatalf("headers=%v", getResult.Header())
		}
	}
}

func TestImageLibraryRequiresSessionAndListsOnlyOwnerAssets(t *testing.T) {
	store := newFakeStore()
	store.assets["123e4567-e89b-42d3-a456-426614174000"] = Asset{
		ID:               "123e4567-e89b-42d3-a456-426614174000",
		OwnerID:          "owner-id",
		Purpose:          PurposeImage,
		Status:           StatusReady,
		StorageKey:       "one.jpg",
		MimeType:         "image/jpeg",
		Width:            1920,
		Height:           1080,
		ByteSize:         100,
		OriginalFilename: "hero.jpg",
	}
	first := store.assets["123e4567-e89b-42d3-a456-426614174000"]
	store.assets["123e4567-e89b-42d3-a456-426614174001"] = Asset{
		ID:        "123e4567-e89b-42d3-a456-426614174001",
		OwnerID:   "other-owner",
		Purpose:   PurposeImage,
		Status:    StatusReady,
		CreatedAt: first.CreatedAt,
	}

	mux := http.NewServeMux()
	NewHTTP(
		fakeSessions{},
		NewService(store, NewMemoryObjectStore()),
	).Register(mux)

	unauthorized := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/media/images",
		nil,
	)
	unauthorizedResult := httptest.NewRecorder()
	mux.ServeHTTP(unauthorizedResult, unauthorized)
	if unauthorizedResult.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d", unauthorizedResult.Code)
	}

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/media/images?limit=12",
		nil,
	)
	req.AddCookie(&http.Cookie{
		Name:  "proslides_session",
		Value: "session",
	})
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

func TestImageLibraryRejectsInvalidLimit(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(
		fakeSessions{},
		NewService(newFakeStore(), NewMemoryObjectStore()),
	).Register(mux)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/media/images?limit=49",
		nil,
	)
	req.AddCookie(&http.Cookie{
		Name:  "proslides_session",
		Value: "session",
	})
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)

	if result.Code != http.StatusBadRequest ||
		!strings.Contains(result.Body.String(), "invalid_limit") {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
}

func TestRenditionFallsBackToMasterButInvalidVariantReturnsNotFound(t *testing.T) {
	store := newFakeStore()
	objects := NewMemoryObjectStore()
	service := NewService(store, objects)
	asset, err := service.UploadImage(
		context.Background(),
		"owner-id",
		"small.jpg",
		jpegFixture(t, 320, 180),
	)
	if err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	NewHTTP(fakeSessions{}, service).Register(mux)

	fallback := httptest.NewRecorder()
	mux.ServeHTTP(
		fallback,
		httptest.NewRequest(
			http.MethodGet,
			assetRenditionURL(asset.ID, VariantMedium),
			nil,
		),
	)
	if fallback.Code != http.StatusOK ||
		fallback.Header().Get("Content-Type") != asset.MimeType ||
		int64(fallback.Body.Len()) != asset.ByteSize {
		t.Fatalf(
			"fallback status=%d content_type=%q bytes=%d asset=%+v",
			fallback.Code,
			fallback.Header().Get("Content-Type"),
			fallback.Body.Len(),
			asset,
		)
	}

	invalid := httptest.NewRecorder()
	mux.ServeHTTP(
		invalid,
		httptest.NewRequest(
			http.MethodGet,
			"/api/v1/media/assets/"+asset.ID+"/renditions/unknown",
			nil,
		),
	)
	if invalid.Code != http.StatusNotFound {
		t.Fatalf(
			"invalid variant status=%d body=%s",
			invalid.Code,
			invalid.Body.String(),
		)
	}
}

func TestImageUploadRejectsNonImage(t *testing.T) {
	mux := http.NewServeMux()
	NewHTTP(
		fakeSessions{},
		NewService(newFakeStore(), NewMemoryObjectStore()),
	).Register(mux)

	body, contentType := multipartImage(
		t,
		"notes.txt",
		[]byte("hello"),
	)
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/media/images",
		body,
	)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-CSRF-Token", "csrf")
	req.AddCookie(&http.Cookie{
		Name:  "proslides_session",
		Value: "session",
	})
	result := httptest.NewRecorder()
	mux.ServeHTTP(result, req)

	if result.Code != http.StatusBadRequest ||
		!strings.Contains(result.Body.String(), "invalid_image") {
		t.Fatalf("status=%d body=%s", result.Code, result.Body.String())
	}
}

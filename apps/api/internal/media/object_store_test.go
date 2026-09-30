package media

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFilesystemObjectStoreVerifiesWritableRootWithoutLeavingProbe(t *testing.T) {
	root := filepath.Join(t.TempDir(), "media")
	store, err := NewFilesystemObjectStore(root)
	if err != nil {
		t.Fatalf("NewFilesystemObjectStore() error = %v", err)
	}
	if store.root == "" {
		t.Fatal("filesystem store root is empty")
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("startup probe leaked files: %+v", entries)
	}
}

func TestR2ObjectStoreUsesCloudflareObjectContract(t *testing.T) {
	var (
		stored      []byte
		contentType string
		deleted     bool
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer token" {
			t.Fatalf("authorization = %q", r.Header.Get("Authorization"))
		}
		if r.URL.Path != "/accounts/account/r2/buckets/bucket/objects/asset.jpg" {
			t.Fatalf("path = %q", r.URL.Path)
		}

		switch r.Method {
		case http.MethodPut:
			if err := r.ParseMultipartForm(1 << 20); err != nil {
				t.Fatalf("parse multipart: %v", err)
			}
			file, header, err := r.FormFile("body")
			if err != nil {
				t.Fatalf("missing body file: %v", err)
			}
			defer file.Close()
			stored, err = io.ReadAll(file)
			if err != nil {
				t.Fatal(err)
			}
			contentType = header.Header.Get("Content-Type")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"success":true,"result":{"key":"asset.jpg"}}`))
		case http.MethodGet:
			if deleted {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "image/jpeg")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(stored)
		case http.MethodDelete:
			deleted = true
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"success":true,"result":{"key":"asset.jpg"}}`))
		default:
			t.Fatalf("unexpected method %s", r.Method)
		}
	}))
	defer server.Close()

	store := newR2ObjectStoreWithEndpoint(
		"account",
		"bucket",
		"token",
		server.URL,
	)

	payload := []byte("image-bytes")
	if err := store.Put(
		context.Background(),
		"asset.jpg",
		"image/jpeg",
		payload,
	); err != nil {
		t.Fatalf("Put() error = %v", err)
	}
	if string(stored) != string(payload) {
		t.Fatalf("stored = %q", stored)
	}
	if contentType != "image/jpeg" {
		t.Fatalf("part content type = %q", contentType)
	}

	body, err := store.Open(context.Background(), "asset.jpg")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	got, err := io.ReadAll(body)
	body.Close()
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(payload) {
		t.Fatalf("Open() = %q", got)
	}

	if err = store.Delete(context.Background(), "asset.jpg"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if !deleted {
		t.Fatal("object was not deleted")
	}
}

func TestObjectStoresRejectUnsafeKeys(t *testing.T) {
	store := NewMemoryObjectStore()
	for _, key := range []string{"", "../secret", "folder/file", `bad\\file`} {
		if err := store.Put(context.Background(), key, "image/jpeg", []byte("x")); err == nil {
			t.Fatalf("unsafe key accepted: %q", key)
		}
	}

	if !safeStorageKey("123e4567.jpg") {
		t.Fatal("safe generated storage key rejected")
	}
	if safeStorageKey(strings.Repeat("a", 10)+"/x") {
		t.Fatal("slash-containing key accepted")
	}
}

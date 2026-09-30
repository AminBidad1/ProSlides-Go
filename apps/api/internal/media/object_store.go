package media

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

func safeStorageKey(key string) bool {
	if key == "" || key == "." || key == ".." || strings.ContainsAny(key, "/\\") {
		return false
	}
	for _, r := range key {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= 'A' && r <= 'Z':
		case r >= '0' && r <= '9':
		case r == '.', r == '_', r == '-':
		default:
			return false
		}
	}
	return true
}

type MemoryObjectStore struct {
	mu      sync.RWMutex
	objects map[string][]byte
}

func NewMemoryObjectStore() *MemoryObjectStore {
	return &MemoryObjectStore{objects: make(map[string][]byte)}
}

func (s *MemoryObjectStore) Put(_ context.Context, key, _ string, data []byte) error {
	if !safeStorageKey(key) {
		return ErrStorageUnavailable
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.objects[key] = append([]byte(nil), data...)
	return nil
}

func (s *MemoryObjectStore) Open(_ context.Context, key string) (io.ReadCloser, error) {
	s.mu.RLock()
	data, ok := s.objects[key]
	s.mu.RUnlock()
	if !ok {
		return nil, ErrStorageUnavailable
	}
	return io.NopCloser(bytes.NewReader(append([]byte(nil), data...))), nil
}

func (s *MemoryObjectStore) Delete(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.objects, key)
	return nil
}

type FilesystemObjectStore struct {
	root string
}

func NewFilesystemObjectStore(root string) (*FilesystemObjectStore, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return nil, fmt.Errorf("media filesystem path is required")
	}
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, fmt.Errorf("create media storage directory: %w", err)
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve media storage directory: %w", err)
	}
	probe, err := os.CreateTemp(absolute, ".writable-*")
	if err != nil {
		return nil, fmt.Errorf("media storage directory is not writable: %w", err)
	}
	probeName := probe.Name()
	if closeErr := probe.Close(); closeErr != nil {
		_ = os.Remove(probeName)
		return nil, fmt.Errorf("verify media storage directory: %w", closeErr)
	}
	if removeErr := os.Remove(probeName); removeErr != nil {
		return nil, fmt.Errorf("verify media storage cleanup: %w", removeErr)
	}
	return &FilesystemObjectStore{root: absolute}, nil
}

func (s *FilesystemObjectStore) objectPath(key string) (string, error) {
	if !safeStorageKey(key) {
		return "", ErrStorageUnavailable
	}
	return filepath.Join(s.root, key), nil
}

func (s *FilesystemObjectStore) Put(_ context.Context, key, _ string, data []byte) error {
	path, err := s.objectPath(key)
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(s.root, ".upload-*")
	if err != nil {
		return fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	tempName := temp.Name()
	defer os.Remove(tempName) //nolint:errcheck

	if err = temp.Chmod(0o640); err == nil {
		_, err = temp.Write(data)
	}
	if closeErr := temp.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	if err = os.Rename(tempName, path); err != nil {
		return fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	return nil
}

func (s *FilesystemObjectStore) Open(_ context.Context, key string) (io.ReadCloser, error) {
	path, err := s.objectPath(key)
	if err != nil {
		return nil, err
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	return file, nil
}

func (s *FilesystemObjectStore) Delete(_ context.Context, key string) error {
	path, err := s.objectPath(key)
	if err != nil {
		return err
	}
	if err = os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	return nil
}

type R2ObjectStore struct {
	client    *http.Client
	baseURL   string
	accountID string
	bucket    string
	apiToken  string
}

func NewR2ObjectStore(accountID, bucket, apiToken string) (*R2ObjectStore, error) {
	accountID = strings.TrimSpace(accountID)
	bucket = strings.TrimSpace(bucket)
	apiToken = strings.TrimSpace(apiToken)
	if accountID == "" || bucket == "" || apiToken == "" {
		return nil, fmt.Errorf("R2 account, bucket, and API token are required")
	}
	return newR2ObjectStoreWithEndpoint(
		accountID,
		bucket,
		apiToken,
		"https://api.cloudflare.com/client/v4",
	), nil
}

func newR2ObjectStoreWithEndpoint(
	accountID, bucket, apiToken, baseURL string,
) *R2ObjectStore {
	return &R2ObjectStore{
		client:    &http.Client{Timeout: 30 * time.Second},
		baseURL:   strings.TrimRight(baseURL, "/"),
		accountID: strings.TrimSpace(accountID),
		bucket:    strings.TrimSpace(bucket),
		apiToken:  strings.TrimSpace(apiToken),
	}
}

func (s *R2ObjectStore) objectURL(key string) (string, error) {
	if !safeStorageKey(key) {
		return "", ErrStorageUnavailable
	}
	return s.baseURL + "/accounts/" +
		url.PathEscape(s.accountID) +
		"/r2/buckets/" + url.PathEscape(s.bucket) +
		"/objects/" + url.PathEscape(key), nil
}

func (s *R2ObjectStore) request(ctx context.Context, method, key, contentType string, body io.Reader) (*http.Response, error) {
	endpoint, err := s.objectURL(key)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiToken)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	response, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	return response, nil
}

func storageResponseError(response *http.Response) error {
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
	return fmt.Errorf(
		"%w: object storage returned HTTP %d: %s",
		ErrStorageUnavailable,
		response.StatusCode,
		strings.TrimSpace(string(body)),
	)
}

func (s *R2ObjectStore) Put(ctx context.Context, key, contentType string, data []byte) error {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(
		`form-data; name="body"; filename="%s"`,
		strings.ReplaceAll(key, `"`, ""),
	))
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	if _, err = part.Write(data); err != nil {
		return fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}
	if err = writer.Close(); err != nil {
		return fmt.Errorf("%w: %v", ErrStorageUnavailable, err)
	}

	response, err := s.request(
		ctx,
		http.MethodPut,
		key,
		writer.FormDataContentType(),
		&body,
	)
	if err != nil {
		return err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return storageResponseError(response)
	}
	response.Body.Close()
	return nil
}

func (s *R2ObjectStore) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	response, err := s.request(ctx, http.MethodGet, key, "", nil)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, storageResponseError(response)
	}
	return response.Body, nil
}

func (s *R2ObjectStore) Delete(ctx context.Context, key string) error {
	response, err := s.request(ctx, http.MethodDelete, key, "", nil)
	if err != nil {
		return err
	}
	if response.StatusCode == http.StatusNotFound {
		response.Body.Close()
		return nil
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return storageResponseError(response)
	}
	response.Body.Close()
	return nil
}

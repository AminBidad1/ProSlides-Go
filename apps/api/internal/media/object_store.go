package media

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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

type s3ObjectClient interface {
	PutObject(context.Context, *s3.PutObjectInput, ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	DeleteObject(context.Context, *s3.DeleteObjectInput, ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
}

type S3ObjectStore struct {
	client s3ObjectClient
	bucket string
}

func NewS3ObjectStore(
	endpoint, region, bucket, accessKeyID, secretAccessKey string,
	forcePathStyle bool,
) (*S3ObjectStore, error) {
	endpoint = strings.TrimSpace(endpoint)
	region = strings.TrimSpace(region)
	bucket = strings.TrimSpace(bucket)
	accessKeyID = strings.TrimSpace(accessKeyID)
	secretAccessKey = strings.TrimSpace(secretAccessKey)
	if endpoint == "" || region == "" || bucket == "" || accessKeyID == "" || secretAccessKey == "" {
		return nil, fmt.Errorf("S3 endpoint, region, bucket, access key ID, and secret access key are required")
	}
	parsedEndpoint, err := url.Parse(endpoint)
	if err != nil || parsedEndpoint.Host == "" ||
		(parsedEndpoint.Scheme != "http" && parsedEndpoint.Scheme != "https") {
		return nil, fmt.Errorf("S3 endpoint must be an absolute HTTP(S) URL")
	}

	client := s3.New(s3.Options{
		BaseEndpoint:     aws.String(strings.TrimRight(endpoint, "/")),
		Region:           region,
		Credentials:      aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
		UsePathStyle:     forcePathStyle,
		RetryMaxAttempts: 3,
	})
	return newS3ObjectStoreWithClient(bucket, client), nil
}

func newS3ObjectStoreWithClient(bucket string, client s3ObjectClient) *S3ObjectStore {
	return &S3ObjectStore{
		client: client,
		bucket: strings.TrimSpace(bucket),
	}
}

func wrapStorageError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%w: %w", ErrStorageUnavailable, err)
}

func (s *S3ObjectStore) Put(ctx context.Context, key, contentType string, data []byte) error {
	if !safeStorageKey(key) {
		return ErrStorageUnavailable
	}
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
		Body:        bytes.NewReader(data),
	})
	return wrapStorageError(err)
}

func (s *S3ObjectStore) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	if !safeStorageKey(key) {
		return nil, ErrStorageUnavailable
	}
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, wrapStorageError(err)
	}
	if output == nil || output.Body == nil {
		return nil, fmt.Errorf("%w: S3 returned an empty object body", ErrStorageUnavailable)
	}
	return output.Body, nil
}

func (s *S3ObjectStore) Delete(ctx context.Context, key string) error {
	if !safeStorageKey(key) {
		return ErrStorageUnavailable
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return wrapStorageError(err)
}

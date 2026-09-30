package media

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3"
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

type fakeS3ObjectClient struct {
	putInput    *s3.PutObjectInput
	getInput    *s3.GetObjectInput
	deleteInput *s3.DeleteObjectInput
	payload     []byte
	putErr      error
	getErr      error
	deleteErr   error
}

func (f *fakeS3ObjectClient) PutObject(
	_ context.Context,
	input *s3.PutObjectInput,
	_ ...func(*s3.Options),
) (*s3.PutObjectOutput, error) {
	f.putInput = input
	if f.putErr != nil {
		return nil, f.putErr
	}
	payload, err := io.ReadAll(input.Body)
	if err != nil {
		return nil, err
	}
	f.payload = payload
	return &s3.PutObjectOutput{}, nil
}

func (f *fakeS3ObjectClient) GetObject(
	_ context.Context,
	input *s3.GetObjectInput,
	_ ...func(*s3.Options),
) (*s3.GetObjectOutput, error) {
	f.getInput = input
	if f.getErr != nil {
		return nil, f.getErr
	}
	return &s3.GetObjectOutput{
		Body: io.NopCloser(strings.NewReader(string(f.payload))),
	}, nil
}

func (f *fakeS3ObjectClient) DeleteObject(
	_ context.Context,
	input *s3.DeleteObjectInput,
	_ ...func(*s3.Options),
) (*s3.DeleteObjectOutput, error) {
	f.deleteInput = input
	if f.deleteErr != nil {
		return nil, f.deleteErr
	}
	return &s3.DeleteObjectOutput{}, nil
}

func TestS3ObjectStoreUsesProviderNeutralObjectContract(t *testing.T) {
	client := &fakeS3ObjectClient{}
	store := newS3ObjectStoreWithClient("media-bucket", client)

	payload := []byte("image-bytes")
	if err := store.Put(context.Background(), "asset.jpg", "image/jpeg", payload); err != nil {
		t.Fatalf("Put() error = %v", err)
	}
	if client.putInput == nil ||
		client.putInput.Bucket == nil || *client.putInput.Bucket != "media-bucket" ||
		client.putInput.Key == nil || *client.putInput.Key != "asset.jpg" ||
		client.putInput.ContentType == nil || *client.putInput.ContentType != "image/jpeg" {
		t.Fatalf("PutObject input = %+v", client.putInput)
	}
	if string(client.payload) != string(payload) {
		t.Fatalf("stored = %q", client.payload)
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
	if client.deleteInput == nil ||
		client.deleteInput.Bucket == nil || *client.deleteInput.Bucket != "media-bucket" ||
		client.deleteInput.Key == nil || *client.deleteInput.Key != "asset.jpg" {
		t.Fatalf("DeleteObject input = %+v", client.deleteInput)
	}
}

func TestS3ObjectStoreNormalizesProviderFailures(t *testing.T) {
	providerErr := errors.New("provider unavailable")
	client := &fakeS3ObjectClient{putErr: providerErr}
	store := newS3ObjectStoreWithClient("media-bucket", client)

	err := store.Put(context.Background(), "asset.jpg", "image/jpeg", []byte("x"))
	if !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("Put() error = %v, want ErrStorageUnavailable", err)
	}
	if !errors.Is(err, providerErr) {
		t.Fatalf("Put() error = %v, want provider cause", err)
	}

	client.putErr = nil
	client.getErr = providerErr
	if _, err = store.Open(context.Background(), "asset.jpg"); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("Open() error = %v, want ErrStorageUnavailable", err)
	}

	client.getErr = nil
	client.deleteErr = providerErr
	if err = store.Delete(context.Background(), "asset.jpg"); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("Delete() error = %v, want ErrStorageUnavailable", err)
	}
}

func TestNewS3ObjectStoreValidatesRequiredConfiguration(t *testing.T) {
	if _, err := NewS3ObjectStore("", "auto", "bucket", "access", "secret", false); err == nil {
		t.Fatal("NewS3ObjectStore() accepted an empty endpoint")
	}
	if _, err := NewS3ObjectStore("not-a-url", "auto", "bucket", "access", "secret", false); err == nil {
		t.Fatal("NewS3ObjectStore() accepted an invalid endpoint")
	}
	if _, err := NewS3ObjectStore("https://storage.example.test", "", "bucket", "access", "secret", false); err == nil {
		t.Fatal("NewS3ObjectStore() accepted an empty region")
	}
}

func TestObjectStoresRejectUnsafeKeys(t *testing.T) {
	for _, key := range []string{"", "../secret", "folder/file", `bad\\file`} {
		memoryStore := NewMemoryObjectStore()
		if err := memoryStore.Put(context.Background(), key, "image/jpeg", []byte("x")); err == nil {
			t.Fatalf("memory store accepted unsafe key: %q", key)
		}

		client := &fakeS3ObjectClient{}
		s3Store := newS3ObjectStoreWithClient("media-bucket", client)
		if err := s3Store.Put(context.Background(), key, "image/jpeg", []byte("x")); err == nil {
			t.Fatalf("S3 Put accepted unsafe key: %q", key)
		}
		if _, err := s3Store.Open(context.Background(), key); err == nil {
			t.Fatalf("S3 Open accepted unsafe key: %q", key)
		}
		if err := s3Store.Delete(context.Background(), key); err == nil {
			t.Fatalf("S3 Delete accepted unsafe key: %q", key)
		}
		if client.putInput != nil || client.getInput != nil || client.deleteInput != nil {
			t.Fatalf("unsafe key %q reached the S3 client", key)
		}
	}

	if !safeStorageKey("123e4567.jpg") {
		t.Fatal("safe generated storage key rejected")
	}
	if safeStorageKey(strings.Repeat("a", 10)+"/x") {
		t.Fatal("slash-containing key accepted")
	}
}

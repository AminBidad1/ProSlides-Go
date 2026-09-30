package media

import (
	"context"
	"errors"
	"io"
	"time"
)

var (
	ErrNotFound           = errors.New("media asset not found")
	ErrInvalidImage       = errors.New("invalid image")
	ErrMediaTooLarge      = errors.New("media upload too large")
	ErrImageDimensions    = errors.New("image dimensions invalid")
	ErrStorageUnavailable = errors.New("media storage unavailable")
	ErrInvalidCursor       = errors.New("invalid media cursor")
)

const (
	StatusProcessing = "processing"
	StatusReady      = "ready"
	StatusFailed     = "failed"
	PurposeBackground = "background"
)

type Asset struct {
	ID               string    `json:"id"`
	Purpose          string    `json:"purpose"`
	MimeType         string    `json:"mime_type"`
	Width            int       `json:"width"`
	Height           int       `json:"height"`
	ByteSize         int64     `json:"byte_size"`
	Status           string    `json:"status"`
	URL              string    `json:"url"`
	CreatedAt        time.Time `json:"created_at"`
	OwnerID          string    `json:"-"`
	StorageKey       string    `json:"-"`
	OriginalFilename string    `json:"filename"`
	ThumbnailURL     string    `json:"thumbnail_url"`
	ThumbnailStorageKey string  `json:"-"`
	ThumbnailMimeType   string  `json:"-"`
	ThumbnailByteSize   int64   `json:"-"`
	SHA256           []byte    `json:"-"`
}

type Store interface {
	CreateProcessing(context.Context, Asset) error
	SetStatus(context.Context, string, string, string) error
	FindReady(context.Context, string) (Asset, error)
	FindReadyByDigest(context.Context, string, string, []byte) (Asset, error)
	ListReady(context.Context, string, string, time.Time, string, int) ([]Asset, error)
}

type AssetPage struct {
	Items      []Asset `json:"items"`
	NextCursor string  `json:"next_cursor,omitempty"`
}

type ObjectStore interface {
	Put(context.Context, string, string, []byte) error
	Open(context.Context, string) (io.ReadCloser, error)
	Delete(context.Context, string) error
}

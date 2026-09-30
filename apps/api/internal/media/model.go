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
	OriginalFilename string    `json:"-"`
	SHA256           []byte    `json:"-"`
}

type Store interface {
	CreateProcessing(context.Context, Asset) error
	SetStatus(context.Context, string, string, string) error
	FindReady(context.Context, string) (Asset, error)
}

type ObjectStore interface {
	Put(context.Context, string, string, []byte) error
	Open(context.Context, string) (io.ReadCloser, error)
	Delete(context.Context, string) error
}

package media

import (
	"context"
	"errors"
	"io"
	"time"
)

var (
	ErrNotFound           = errors.New("media asset not found")
	ErrVariantNotFound    = errors.New("media variant not found")
	ErrInvalidImage       = errors.New("invalid image")
	ErrMediaTooLarge      = errors.New("media upload too large")
	ErrImageDimensions    = errors.New("image dimensions invalid")
	ErrStorageUnavailable = errors.New("media storage unavailable")
	ErrInvalidCursor      = errors.New("invalid media cursor")
)

const (
	StatusProcessing = "processing"
	StatusReady      = "ready"
	StatusFailed     = "failed"

	PurposeImage = "image"

	VariantThumbnail = "thumbnail"
	VariantMedium    = "medium"
	VariantLarge     = "large"
)

type Rendition struct {
	URL      string `json:"url"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	ByteSize int64  `json:"byte_size"`
}

type AssetRenditions struct {
	Thumbnail *Rendition `json:"thumbnail,omitempty"`
	Medium    *Rendition `json:"medium,omitempty"`
	Large     *Rendition `json:"large,omitempty"`
}

type Variant struct {
	Name       string `json:"-"`
	StorageKey string `json:"-"`
	MimeType   string `json:"-"`
	Width      int    `json:"-"`
	Height     int    `json:"-"`
	ByteSize   int64  `json:"-"`
}

type Asset struct {
	ID               string          `json:"id"`
	Purpose          string          `json:"purpose"`
	MimeType         string          `json:"mime_type"`
	Width            int             `json:"width"`
	Height           int             `json:"height"`
	ByteSize         int64           `json:"byte_size"`
	Status           string          `json:"status"`
	URL              string          `json:"url"`
	Renditions       AssetRenditions `json:"renditions"`
	CreatedAt        time.Time       `json:"created_at"`
	OwnerID          string          `json:"-"`
	StorageKey       string          `json:"-"`
	OriginalFilename string          `json:"filename"`
	SHA256           []byte          `json:"-"`
	Variants         map[string]Variant `json:"-"`
}

type Store interface {
	CreateProcessing(context.Context, Asset, []Variant) error
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

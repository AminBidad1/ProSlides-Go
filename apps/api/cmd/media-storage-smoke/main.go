package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/proslides/proslides/internal/media"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "media storage smoke failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("media storage smoke passed")
}

func run() error {
	forcePathStyle, err := envBool("MEDIA_S3_FORCE_PATH_STYLE", false)
	if err != nil {
		return err
	}
	endpoint, err := requiredEnv("MEDIA_S3_ENDPOINT")
	if err != nil {
		return err
	}
	region, err := requiredEnv("MEDIA_S3_REGION")
	if err != nil {
		return err
	}
	bucket, err := requiredEnv("MEDIA_S3_BUCKET")
	if err != nil {
		return err
	}
	accessKeyID, err := requiredEnv("MEDIA_S3_ACCESS_KEY_ID")
	if err != nil {
		return err
	}
	secretAccessKey, err := requiredEnv("MEDIA_S3_SECRET_ACCESS_KEY")
	if err != nil {
		return err
	}
	store, err := media.NewS3ObjectStore(
		endpoint,
		region,
		bucket,
		accessKeyID,
		secretAccessKey,
		forcePathStyle,
	)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	suffix := make([]byte, 12)
	if _, err = rand.Read(suffix); err != nil {
		return fmt.Errorf("generate smoke key: %w", err)
	}
	key := "proslides-smoke-" + hex.EncodeToString(suffix) + ".bin"
	payload := []byte("proslides-media-storage-smoke-v1")

	written := false
	defer func() {
		if !written {
			return
		}
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		_ = store.Delete(cleanupCtx, key)
	}()

	if err = store.Put(ctx, key, "application/octet-stream", payload); err != nil {
		return fmt.Errorf("put smoke object: %w", err)
	}
	written = true
	body, err := store.Open(ctx, key)
	if err != nil {
		return fmt.Errorf("open smoke object: %w", err)
	}
	got, readErr := io.ReadAll(body)
	closeErr := body.Close()
	if readErr != nil {
		return fmt.Errorf("read smoke object: %w", readErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close smoke object: %w", closeErr)
	}
	if !bytes.Equal(got, payload) {
		return fmt.Errorf("smoke object bytes differ after read")
	}

	if err = store.Delete(ctx, key); err != nil {
		return fmt.Errorf("delete smoke object: %w", err)
	}
	body, err = store.Open(ctx, key)
	if err == nil {
		body.Close()
		return fmt.Errorf("deleted smoke object is still readable")
	}
	if !errors.Is(err, media.ErrStorageUnavailable) {
		return fmt.Errorf("deleted smoke object returned unexpected error: %w", err)
	}
	return nil
}

func requiredEnv(key string) (string, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return "", fmt.Errorf("%s is required", key)
	}
	return value, nil
}

func envBool(key string, defaultValue bool) (bool, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return defaultValue, nil
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, fmt.Errorf("%s must be true or false", key)
	}
	return value, nil
}

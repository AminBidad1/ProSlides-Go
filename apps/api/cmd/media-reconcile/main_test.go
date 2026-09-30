package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"

	"github.com/proslides/proslides/internal/media"
)

func TestVerifyObjectChecksMasterDigestAndSize(t *testing.T) {
	store := media.NewMemoryObjectStore()
	payload := []byte("verified-master")
	if err := store.Put(context.Background(), "master.jpg", "image/jpeg", payload); err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(payload)
	object := objectExpectation{
		kind:      "master",
		assetID:   "asset-1",
		key:       "master.jpg",
		byteSize:  int64(len(payload)),
		sha256Hex: hex.EncodeToString(digest[:]),
	}
	if err := verifyObject(context.Background(), store, object); err != nil {
		t.Fatalf("verifyObject() error = %v", err)
	}

	object.sha256Hex = strings.Repeat("0", 64)
	if err := verifyObject(context.Background(), store, object); err == nil {
		t.Fatal("verifyObject() accepted a mismatched master digest")
	}
}

func TestVerifyObjectChecksVariantByteSize(t *testing.T) {
	store := media.NewMemoryObjectStore()
	payload := []byte("variant")
	if err := store.Put(context.Background(), "variant.jpg", "image/jpeg", payload); err != nil {
		t.Fatal(err)
	}
	object := objectExpectation{
		kind:     "variant",
		assetID:  "asset-1",
		variant:  "medium",
		key:      "variant.jpg",
		byteSize: int64(len(payload) + 1),
	}
	if err := verifyObject(context.Background(), store, object); err == nil {
		t.Fatal("verifyObject() accepted a mismatched variant byte size")
	}
}

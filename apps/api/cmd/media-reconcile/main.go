package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/proslides/proslides/internal/media"
)

type objectExpectation struct {
	kind      string
	assetID   string
	variant   string
	key       string
	byteSize  int64
	sha256Hex string
}

type verificationResult struct {
	object objectExpectation
	err    error
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "media reconciliation failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	concurrency, err := positiveIntEnv("MEDIA_RECONCILE_CONCURRENCY", 8)
	if err != nil {
		return err
	}
	overallTimeout, err := durationEnv("MEDIA_RECONCILE_TIMEOUT", 15*time.Minute)
	if err != nil {
		return err
	}
	objectTimeout, err := durationEnv("MEDIA_RECONCILE_OBJECT_TIMEOUT", 20*time.Second)
	if err != nil {
		return err
	}
	forcePathStyle, err := boolEnv("MEDIA_S3_FORCE_PATH_STYLE", false)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), overallTimeout)
	defer cancel()

	databaseURL, err := requiredEnv("DATABASE_URL")
	if err != nil {
		return err
	}
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("connect postgres: %w", err)
	}
	defer pool.Close()
	if err = pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping postgres: %w", err)
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

	objects, err := loadExpectations(ctx, pool)
	if err != nil {
		return err
	}
	if len(objects) == 0 {
		fmt.Println("media reconciliation: no ready media objects")
		return nil
	}

	jobs := make(chan objectExpectation)
	results := make(chan verificationResult)
	var workers sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for object := range jobs {
				verifyCtx, verifyCancel := context.WithTimeout(ctx, objectTimeout)
				err := verifyObject(verifyCtx, store, object)
				verifyCancel()
				results <- verificationResult{object: object, err: err}
			}
		}()
	}

	go func() {
		defer close(jobs)
		for _, object := range objects {
			select {
			case jobs <- object:
			case <-ctx.Done():
				return
			}
		}
	}()
	go func() {
		workers.Wait()
		close(results)
	}()

	failures := 0
	checked := 0
	for result := range results {
		checked++
		if result.err == nil {
			continue
		}
		failures++
		label := result.object.kind
		if result.object.variant != "" {
			label += ":" + result.object.variant
		}
		fmt.Fprintf(
			os.Stderr,
			"FAIL asset=%s object=%s key=%s: %v\n",
			result.object.assetID,
			label,
			result.object.key,
			result.err,
		)
	}
	if err = ctx.Err(); err != nil {
		return fmt.Errorf("reconciliation deadline reached after checking %d/%d objects: %w", checked, len(objects), err)
	}
	if failures > 0 {
		return fmt.Errorf("%d of %d media objects failed verification", failures, checked)
	}
	fmt.Printf("media reconciliation passed: %d objects verified\n", checked)
	return nil
}

func loadExpectations(ctx context.Context, pool *pgxpool.Pool) ([]objectExpectation, error) {
	rows, err := pool.Query(ctx, `
		SELECT
			'master' AS kind,
			a.id::text,
			'' AS variant,
			a.storage_key,
			a.byte_size,
			encode(a.sha256, 'hex') AS sha256_hex
		FROM media_assets a
		WHERE a.status = 'ready'
		UNION ALL
		SELECT
			'variant' AS kind,
			a.id::text,
			v.variant,
			v.storage_key,
			v.byte_size,
			'' AS sha256_hex
		FROM media_variants v
		JOIN media_assets a ON a.id = v.asset_id
		WHERE a.status = 'ready'
		ORDER BY 2, 1, 3
	`)
	if err != nil {
		return nil, fmt.Errorf("query media metadata: %w", err)
	}
	defer rows.Close()

	objects := make([]objectExpectation, 0)
	for rows.Next() {
		var object objectExpectation
		if err = rows.Scan(
			&object.kind,
			&object.assetID,
			&object.variant,
			&object.key,
			&object.byteSize,
			&object.sha256Hex,
		); err != nil {
			return nil, fmt.Errorf("scan media metadata: %w", err)
		}
		objects = append(objects, object)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate media metadata: %w", err)
	}
	return objects, nil
}

func verifyObject(ctx context.Context, store media.ObjectStore, object objectExpectation) error {
	body, err := store.Open(ctx, object.key)
	if err != nil {
		return err
	}
	defer body.Close() //nolint:errcheck

	var digest hash.Hash
	var destination io.Writer = io.Discard
	if object.kind == "master" {
		digest = sha256.New()
		destination = digest
	}

	read, err := io.Copy(destination, io.LimitReader(body, object.byteSize+1))
	if err != nil {
		return fmt.Errorf("read object: %w", err)
	}
	if read != object.byteSize {
		return fmt.Errorf("byte size mismatch: got %d want %d", read, object.byteSize)
	}
	if object.kind == "master" {
		got := hex.EncodeToString(digest.Sum(nil))
		if !strings.EqualFold(got, object.sha256Hex) {
			return fmt.Errorf("SHA-256 mismatch")
		}
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

func positiveIntEnv(key string, defaultValue int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return defaultValue, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", key)
	}
	return value, nil
}

func durationEnv(key string, defaultValue time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return defaultValue, nil
	}
	value, err := time.ParseDuration(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive Go duration", key)
	}
	return value, nil
}

func boolEnv(key string, defaultValue bool) (bool, error) {
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

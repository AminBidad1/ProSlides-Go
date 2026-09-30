package media

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) CreateProcessing(ctx context.Context, asset Asset) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO media_assets(
			id, owner_id, purpose, storage_key, mime_type, width, height,
			byte_size, sha256, status, original_filename, created_at, updated_at,
			thumbnail_storage_key, thumbnail_mime_type, thumbnail_byte_size
		)
		VALUES(
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,
			NULLIF($13,''), NULLIF($14,''), NULLIF($15,0)
		)
	`,
		asset.ID,
		asset.OwnerID,
		asset.Purpose,
		asset.StorageKey,
		asset.MimeType,
		asset.Width,
		asset.Height,
		asset.ByteSize,
		asset.SHA256,
		StatusProcessing,
		asset.OriginalFilename,
		asset.CreatedAt,
		asset.ThumbnailStorageKey,
		asset.ThumbnailMimeType,
		asset.ThumbnailByteSize,
	)
	return err
}

func (s *PostgresStore) SetStatus(ctx context.Context, id, ownerID, status string) error {
	command, err := s.pool.Exec(ctx, `
		UPDATE media_assets
		SET status=$3, updated_at=now()
		WHERE id=$1 AND owner_id=$2
	`, id, ownerID, status)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *PostgresStore) FindReady(ctx context.Context, id string) (Asset, error) {
	var asset Asset
	err := s.pool.QueryRow(ctx, `
		SELECT
			id::text, owner_id::text, purpose, storage_key, mime_type, width,
			height, byte_size, sha256, status, original_filename, created_at,
			COALESCE(thumbnail_storage_key, ''),
			COALESCE(thumbnail_mime_type, ''),
			COALESCE(thumbnail_byte_size, 0)
		FROM media_assets
		WHERE id=$1 AND status='ready'
	`, id).Scan(
		&asset.ID,
		&asset.OwnerID,
		&asset.Purpose,
		&asset.StorageKey,
		&asset.MimeType,
		&asset.Width,
		&asset.Height,
		&asset.ByteSize,
		&asset.SHA256,
		&asset.Status,
		&asset.OriginalFilename,
		&asset.CreatedAt,
		&asset.ThumbnailStorageKey,
		&asset.ThumbnailMimeType,
		&asset.ThumbnailByteSize,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	return asset, err
}


func (s *PostgresStore) FindReadyByDigest(
	ctx context.Context,
	ownerID, purpose string,
	digest []byte,
) (Asset, error) {
	var asset Asset
	err := s.pool.QueryRow(ctx, `
		SELECT
			id::text, owner_id::text, purpose, storage_key, mime_type, width,
			height, byte_size, sha256, status, original_filename, created_at,
			COALESCE(thumbnail_storage_key, ''),
			COALESCE(thumbnail_mime_type, ''),
			COALESCE(thumbnail_byte_size, 0)
		FROM media_assets
		WHERE owner_id=$1 AND purpose=$2 AND sha256=$3 AND status='ready'
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`, ownerID, purpose, digest).Scan(
		&asset.ID,
		&asset.OwnerID,
		&asset.Purpose,
		&asset.StorageKey,
		&asset.MimeType,
		&asset.Width,
		&asset.Height,
		&asset.ByteSize,
		&asset.SHA256,
		&asset.Status,
		&asset.OriginalFilename,
		&asset.CreatedAt,
		&asset.ThumbnailStorageKey,
		&asset.ThumbnailMimeType,
		&asset.ThumbnailByteSize,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	return asset, err
}

func (s *PostgresStore) ListReady(
	ctx context.Context,
	ownerID, purpose string,
	before time.Time,
	beforeID string,
	limit int,
) ([]Asset, error) {
	query := `
		SELECT
			id::text, owner_id::text, purpose, storage_key, mime_type, width,
			height, byte_size, sha256, status, original_filename, created_at,
			COALESCE(thumbnail_storage_key, ''),
			COALESCE(thumbnail_mime_type, ''),
			COALESCE(thumbnail_byte_size, 0)
		FROM media_assets
		WHERE owner_id=$1 AND purpose=$2 AND status='ready'
	`
	args := []any{ownerID, purpose}
	if !before.IsZero() {
		query += ` AND (created_at, id) < ($3, $4::uuid)`
		args = append(args, before, beforeID)
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT $` + strconv.Itoa(len(args)+1)
	args = append(args, limit)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]Asset, 0, limit)
	for rows.Next() {
		var asset Asset
		if err = rows.Scan(
			&asset.ID,
			&asset.OwnerID,
			&asset.Purpose,
			&asset.StorageKey,
			&asset.MimeType,
			&asset.Width,
			&asset.Height,
			&asset.ByteSize,
			&asset.SHA256,
			&asset.Status,
			&asset.OriginalFilename,
			&asset.CreatedAt,
			&asset.ThumbnailStorageKey,
			&asset.ThumbnailMimeType,
			&asset.ThumbnailByteSize,
		); err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}
	return assets, rows.Err()
}

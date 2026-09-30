package media

import (
	"context"
	"errors"

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
			byte_size, sha256, status, original_filename, created_at, updated_at
		)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
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
			height, byte_size, sha256, status, original_filename, created_at
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
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	return asset, err
}

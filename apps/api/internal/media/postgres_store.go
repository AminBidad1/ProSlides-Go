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

type rowScanner interface {
	Scan(...any) error
}

func scanAsset(row rowScanner) (Asset, error) {
	var asset Asset
	err := row.Scan(
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
	return asset, err
}

const assetSelectColumns = `
	id::text, owner_id::text, purpose, storage_key, mime_type, width,
	height, byte_size, sha256, status, original_filename, created_at
`

func (s *PostgresStore) CreateProcessing(
	ctx context.Context,
	asset Asset,
	variants []Variant,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	_, err = tx.Exec(ctx, `
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
	if err != nil {
		return err
	}

	for _, variant := range variants {
		_, err = tx.Exec(ctx, `
			INSERT INTO media_variants(
				asset_id, variant, storage_key, mime_type,
				width, height, byte_size, created_at
			)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8)
		`,
			asset.ID,
			variant.Name,
			variant.StorageKey,
			variant.MimeType,
			variant.Width,
			variant.Height,
			variant.ByteSize,
			asset.CreatedAt,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *PostgresStore) SetStatus(
	ctx context.Context,
	id, ownerID, status string,
) error {
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

func (s *PostgresStore) loadVariants(
	ctx context.Context,
	assets []Asset,
) error {
	if len(assets) == 0 {
		return nil
	}
	ids := make([]string, 0, len(assets))
	index := make(map[string]int, len(assets))
	for i := range assets {
		ids = append(ids, assets[i].ID)
		index[assets[i].ID] = i
		assets[i].Variants = make(map[string]Variant)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			asset_id::text, variant, storage_key, mime_type,
			width, height, byte_size
		FROM media_variants
		WHERE asset_id::text = ANY($1::text[])
	`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var assetID string
		var variant Variant
		if err = rows.Scan(
			&assetID,
			&variant.Name,
			&variant.StorageKey,
			&variant.MimeType,
			&variant.Width,
			&variant.Height,
			&variant.ByteSize,
		); err != nil {
			return err
		}
		if i, ok := index[assetID]; ok {
			assets[i].Variants[variant.Name] = variant
		}
	}
	return rows.Err()
}

func (s *PostgresStore) FindReady(
	ctx context.Context,
	id string,
) (Asset, error) {
	asset, err := scanAsset(s.pool.QueryRow(ctx, `
		SELECT `+assetSelectColumns+`
		FROM media_assets
		WHERE id=$1 AND status='ready'
	`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	if err != nil {
		return Asset{}, err
	}
	assets := []Asset{asset}
	if err = s.loadVariants(ctx, assets); err != nil {
		return Asset{}, err
	}
	return assets[0], nil
}

func (s *PostgresStore) FindReadyByDigest(
	ctx context.Context,
	ownerID, purpose string,
	digest []byte,
) (Asset, error) {
	asset, err := scanAsset(s.pool.QueryRow(ctx, `
		SELECT `+assetSelectColumns+`
		FROM media_assets
		WHERE owner_id=$1 AND purpose=$2 AND sha256=$3 AND status='ready'
		ORDER BY created_at DESC, id DESC
		LIMIT 1
	`, ownerID, purpose, digest))
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	if err != nil {
		return Asset{}, err
	}
	assets := []Asset{asset}
	if err = s.loadVariants(ctx, assets); err != nil {
		return Asset{}, err
	}
	return assets[0], nil
}

func (s *PostgresStore) ListReady(
	ctx context.Context,
	ownerID, purpose string,
	before time.Time,
	beforeID string,
	limit int,
) ([]Asset, error) {
	query := `
		SELECT `+assetSelectColumns+`
		FROM media_assets
		WHERE owner_id=$1 AND purpose=$2 AND status='ready'
	`
	args := []any{ownerID, purpose}
	if !before.IsZero() {
		query += ` AND (created_at, id) < ($3, $4::uuid)`
		args = append(args, before, beforeID)
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT $` +
		strconv.Itoa(len(args)+1)
	args = append(args, limit)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]Asset, 0, limit)
	for rows.Next() {
		asset, scanErr := scanAsset(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		assets = append(assets, asset)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if err = s.loadVariants(ctx, assets); err != nil {
		return nil, err
	}
	return assets, nil
}

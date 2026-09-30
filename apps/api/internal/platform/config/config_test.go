package config

import "testing"

func setProductionMedia(t *testing.T) {
	t.Helper()
	t.Setenv("MEDIA_STORAGE_BACKEND", "r2")
	t.Setenv("MEDIA_R2_ACCOUNT_ID", "account-id")
	t.Setenv("MEDIA_R2_BUCKET", "proslides-media")
	t.Setenv("MEDIA_R2_API_TOKEN", "test-token")
}

func TestLoadRequiresBothRuntimeDependencies(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want missing DATABASE_URL error")
	}
}

func TestLoadRejectsInvalidDependencyCheckTimeout(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("DEPENDENCY_CHECK_TIMEOUT", "not-a-duration")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want invalid timeout error")
	}
}

func TestLoadRejectsInvalidMigrationTimeout(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("MIGRATION_TIMEOUT", "0s")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want invalid migration timeout error")
	}
}

func TestLoadRequiresSMTPForMandatoryVerification(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true")
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_FROM_ADDRESS", "")
	if _, err := Load(); err == nil {
		t.Fatal("mandatory verification accepted without SMTP")
	}
}

func TestLoadRequiresPepperForMandatoryVerification(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true")
	t.Setenv("SMTP_HOST", "smtp.example.test")
	t.Setenv("SMTP_FROM_ADDRESS", "no-reply@example.test")
	t.Setenv("EMAIL_VERIFICATION_PEPPER", "short")
	if _, err := Load(); err == nil {
		t.Fatal("mandatory verification accepted a weak pepper")
	}
}

func TestLoadRejectsConflictingSMTPEncryption(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("SMTP_USE_TLS", "true")
	t.Setenv("SMTP_USE_SSL", "true")
	if _, err := Load(); err == nil {
		t.Fatal("conflicting SMTP encryption accepted")
	}
}

func TestLoadRejectsInvalidTrustedProxyCIDR(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("TRUSTED_PROXY_CIDRS", "not-a-cidr")
	if _, err := Load(); err == nil {
		t.Fatal("invalid trusted proxy CIDR accepted")
	}
}

func TestLoadProductionRequiresHTTPSPublicOrigin(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	setProductionMedia(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("PUBLIC_WEB_URL", "http://proslides.example.test")
	t.Setenv("TRUSTED_PROXY_CIDRS", "172.30.0.0/24")

	if _, err := Load(); err == nil {
		t.Fatal("production accepted a non-HTTPS PUBLIC_WEB_URL")
	}
}

func TestLoadProductionRequiresTrustedProxyCIDRs(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	setProductionMedia(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("PUBLIC_WEB_URL", "https://proslides.example.test")
	t.Setenv("TRUSTED_PROXY_CIDRS", "")

	if _, err := Load(); err == nil {
		t.Fatal("production accepted an empty TRUSTED_PROXY_CIDRS")
	}
}

func TestLoadProductionRequiresPostgresTLS(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	setProductionMedia(t)
	t.Setenv("DATABASE_URL", "postgres://db.example.test/proslides?sslmode=disable")
	t.Setenv("REDIS_URL", "rediss://redis.example.test:6379/0")
	t.Setenv("PUBLIC_WEB_URL", "https://proslides.example.test")
	t.Setenv("TRUSTED_PROXY_CIDRS", "172.30.0.0/24")

	if _, err := Load(); err == nil {
		t.Fatal("production accepted PostgreSQL without required TLS")
	}
}

func TestLoadProductionRequiresRedisTLS(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	setProductionMedia(t)
	t.Setenv("DATABASE_URL", "postgres://db.example.test/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "redis://redis.example.test:6379/0")
	t.Setenv("PUBLIC_WEB_URL", "https://proslides.example.test")
	t.Setenv("TRUSTED_PROXY_CIDRS", "172.30.0.0/24")

	if _, err := Load(); err == nil {
		t.Fatal("production accepted Redis without TLS")
	}
}

func TestLoadProductionRejectsNonHTTPSGoogleJWKS(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	setProductionMedia(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("PUBLIC_WEB_URL", "https://proslides.example.test")
	t.Setenv("TRUSTED_PROXY_CIDRS", "172.30.0.0/24")
	t.Setenv("GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("GOOGLE_JWKS_URL", "http://accounts.example.test/certs")

	if _, err := Load(); err == nil {
		t.Fatal("production Google login accepted a non-HTTPS GOOGLE_JWKS_URL")
	}
}

func TestLoadProductionAcceptsReferenceSecurityBoundary(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	setProductionMedia(t)
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("PUBLIC_WEB_URL", "https://proslides.example.test")
	t.Setenv("TRUSTED_PROXY_CIDRS", "172.30.0.0/24")
	t.Setenv("GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("GOOGLE_JWKS_URL", "https://www.googleapis.com/oauth2/v3/certs")

	if _, err := Load(); err != nil {
		t.Fatalf("Load() error = %v, want valid production boundary", err)
	}
}

func TestLoadProductionRequiresR2MediaStorage(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("PUBLIC_WEB_URL", "https://proslides.example.test")
	t.Setenv("TRUSTED_PROXY_CIDRS", "172.30.0.0/24")
	t.Setenv("MEDIA_STORAGE_BACKEND", "filesystem")

	if _, err := Load(); err == nil {
		t.Fatal("production accepted filesystem media storage")
	}
}

func TestLoadR2RequiresCredentials(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("DATABASE_URL", "postgres://localhost/proslides?sslmode=require")
	t.Setenv("REDIS_URL", "rediss://localhost:6379/0")
	t.Setenv("MEDIA_STORAGE_BACKEND", "r2")
	t.Setenv("MEDIA_R2_ACCOUNT_ID", "")
	t.Setenv("MEDIA_R2_BUCKET", "")
	t.Setenv("MEDIA_R2_API_TOKEN", "")

	if _, err := Load(); err == nil {
		t.Fatal("R2 media storage accepted missing credentials")
	}
}

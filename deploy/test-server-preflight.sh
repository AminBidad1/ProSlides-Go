#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-deploy/.env.test-server}"
compose_file="${TEST_SERVER_COMPOSE_FILE:-deploy/compose.test-server.yaml}"

fail() {
  echo "test-server preflight: $*" >&2
  exit 1
}

read_env() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  printf '%s' "${line#*=}" | tr -d '\r'
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is not available"
docker info >/dev/null 2>&1 || fail "Docker daemon is not reachable"

[[ -f "$env_file" ]] || fail "missing $env_file; copy deploy/.env.test-server.example first"
[[ -f "$compose_file" ]] || fail "missing $compose_file"

postgres_password="$(read_env POSTGRES_PASSWORD)"
public_url="$(read_env TEST_PUBLIC_URL)"
http_port="$(read_env TEST_HTTP_PORT)"

[[ -n "$postgres_password" ]] || fail "POSTGRES_PASSWORD is empty"
[[ "$postgres_password" != change-me* ]] || fail "POSTGRES_PASSWORD still contains the example placeholder"
[[ ${#postgres_password} -ge 24 ]] || fail "POSTGRES_PASSWORD must be at least 24 URL-safe characters"
[[ "$postgres_password" =~ ^[A-Za-z0-9._~-]+$ ]] || fail "POSTGRES_PASSWORD must be URL-safe because it is embedded in DATABASE_URL"

[[ "$public_url" =~ ^https?://[^[:space:]]+$ ]] || fail "TEST_PUBLIC_URL must be an absolute http:// or https:// URL"
[[ "$public_url" != *SERVER_IP* ]] || fail "TEST_PUBLIC_URL still contains SERVER_IP placeholder"

if [[ -n "$http_port" ]]; then
  [[ "$http_port" =~ ^[0-9]+$ ]] || fail "TEST_HTTP_PORT must be numeric"
  (( http_port >= 1 && http_port <= 65535 )) || fail "TEST_HTTP_PORT must be between 1 and 65535"
fi

docker compose --env-file "$env_file" -f "$compose_file" config --quiet

if command -v stat >/dev/null 2>&1; then
  mode="$(stat -c '%a' "$env_file" 2>/dev/null || true)"
  if [[ -n "$mode" && "${mode: -1}" != "0" ]]; then
    echo "test-server preflight: warning: $env_file is readable by other users; chmod 600 is recommended" >&2
  fi
fi

echo "test-server preflight: configuration is valid"

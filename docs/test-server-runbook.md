# Test-server deployment runbook

This is the lightweight deployment path for functional and integration testing
on one Linux server. It is intentionally separate from the production reference:
no managed PostgreSQL/Redis, S3 object storage, multi-replica rollout, capacity
certification, or production observability gate is required here.

## Topology

```text
browser -> host:TEST_HTTP_PORT -> web Nginx -> Go API
                                      |          |
                                      |          +-> PostgreSQL container
                                      |          +-> Redis container
                                      |          +-> persistent media volume
                                      |
                                      +-> SPA/static assets
```

Only the web port is published. API, PostgreSQL, and Redis stay on the private
Compose network. PostgreSQL data, Redis data, and uploaded media use named
volumes and survive ordinary container rebuilds/restarts.

## Server prerequisites

Use a Linux server with Docker Engine and Docker Compose v2. Clone the repository
with a normal non-root deployment account when practical. Open SSH and the
chosen test web port in the host/cloud firewall; do not open PostgreSQL, Redis,
or the API port.

This stack is for test traffic. Its size should match the people and scenarios
you plan to exercise; it is not evidence for the production capacity gates.

## First deploy

Clone the repository and check out the exact commit you want to test. Then:

```bash
cp deploy/.env.test-server.example deploy/.env.test-server
chmod 600 deploy/.env.test-server
openssl rand -hex 24
```

Put the generated value in `POSTGRES_PASSWORD`. Set `TEST_PUBLIC_URL` to the
address users will actually open, for example
`http://203.0.113.10:8080`. Keep the password URL-safe because the Compose file
places it inside `DATABASE_URL`.

Google login is optional. To test it, set `GOOGLE_CLIENT_ID`; the same value is
used for the API and the web build. Email verification is deliberately disabled
in this lightweight stack, so SMTP is not required.

Run the checked-in preflight without printing interpolated secrets:

```bash
bash deploy/test-server-preflight.sh
```

Build and start:

```bash
docker compose \
  --env-file deploy/.env.test-server \
  -f deploy/compose.test-server.yaml \
  up -d --build --wait

docker compose \
  --env-file deploy/.env.test-server \
  -f deploy/compose.test-server.yaml \
  ps
```

The API runs forward-only migrations automatically before it becomes ready.

## Smoke check

From the server or another machine that can reach the test address:

```bash
public_url="$(sed -n 's/^TEST_PUBLIC_URL=//p' deploy/.env.test-server | tail -n 1)"
curl -fsS "$public_url/web-healthz"
curl -fsS "$public_url/api/v1/version"
```

Then exercise the flows that matter for this project rather than admiring two
green HTTP responses: register/login, create/edit a presentation, upload/reuse an
image, start a live Session, join from a phone, submit an answer, advance
activities, verify Stage/participant synchronization, and open the resulting
report.

Useful diagnostics:

```bash
docker compose --env-file deploy/.env.test-server -f deploy/compose.test-server.yaml ps
docker compose --env-file deploy/.env.test-server -f deploy/compose.test-server.yaml logs --tail=200 api web
```

Do not paste logs containing credentials or session material into public issues.

## Updating the test server

Before an update, keep the currently tested commit SHA so you can return to it.
For test data worth preserving, create a quick PostgreSQL dump:

```bash
mkdir -p backups
stamp="$(date -u +%Y%m%d-%H%M%S)"
docker compose \
  --env-file deploy/.env.test-server \
  -f deploy/compose.test-server.yaml \
  exec -T postgres pg_dump -U proslides -d proslides -Fc \
  > "backups/proslides-test-$stamp.dump"
```

Then update the checkout, rerun preflight, and rebuild:

```bash
git pull --ff-only
bash deploy/test-server-preflight.sh

docker compose \
  --env-file deploy/.env.test-server \
  -f deploy/compose.test-server.yaml \
  up -d --build --wait
```

Named volumes are not removed by this command. Do not use `down -v` unless the
test database and uploaded media are intentionally disposable.

## HTTPS on a test server

Plain HTTP on an isolated or temporary test host is supported by this stack. If
the server is exposed broadly or will carry meaningful credentials, put a normal
TLS reverse proxy in front of the published web port. The production ingress
example can be adapted, but the production Compose file itself is not required
for this test environment.

## What this path deliberately does not prove

A successful test-server deployment proves that the real containerized
application, migrations, persistence, same-origin API proxy, SSE flow, and
critical product paths work on a remote Linux host. It does not close the
production-readiness capacity, managed backup/PITR, S3, alerting, multi-replica,
or rollback-evidence gates tracked for a public production launch.

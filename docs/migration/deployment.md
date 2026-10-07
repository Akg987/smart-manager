# Deployment guide

**Status:** deployment examples prepared for staging; they have not been run or security-reviewed. The repo currently has no Dockerfile, Compose manifest, or Nginx site configuration. The snippets below are proposed configurations and require environment-specific review before production use.

## Runtime topology

Run Next.js on port 3000, NestJS on port 4000, and PostgreSQL on an internal Docker network. Expose only Nginx to the public network. Next's rewrite forwards `/api/*` requests to NestJS, so the browser uses one origin and session cookies remain same-site. Keep PostgreSQL and NestJS ports private.

The `NEST_API_URL` rewrite destination is read during `next build`, so set it to the API's internal service name when building the web image. The Next Proxy also reads the variable at runtime when it checks the session. Next self-hosting guidance recommends putting a reverse proxy such as Nginx in front of the app; disable response buffering for streaming responses.

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Next, Nest, Drizzle | PostgreSQL connection string. Use the private Compose hostname from app containers. |
| `POSTGRES_DB` | PostgreSQL container | Database created on first initialization. |
| `POSTGRES_USER` | PostgreSQL container | Database owner account. |
| `POSTGRES_PASSWORD` | PostgreSQL container | Secret password; supply through the deployment secret store. |
| `NEST_API_URL` | Next build and runtime | Nest base URL, for example `http://api:4000` in Compose or `http://localhost:4000` locally. |
| `PORT` | Nest | API listen port; defaults to `4000`. |
| `WEB_ORIGIN` | Nest | Exact public web origin allowed by credentialed CORS, e.g. `https://manager.example.com`. |
| `APP_KEY` | Nest | The existing Laravel key used to decrypt legacy encrypted settings and encrypt compatible values. Preserve it through cutover; never generate a replacement before all encrypted values have been migrated or re-encrypted. |
| `TWO_FACTOR_ENABLED` | Nest | Enable or disable two-factor checks according to the existing environment policy. |
| `TWO_FACTOR_ROLES` | Nest | Comma-separated roles subject to two-factor authentication. |
| `TWO_FACTOR_FAIL_OPEN` | Nest | Explicit policy for OTP delivery failures; configure deliberately and test before production. |
| `IPPANEL_OTP_PATTERN_CODE` | Nest | SMS provider pattern code used for OTP delivery, if enabled. |
| `UPLOAD_DIR` | Nest | Persistent directory for uploaded avatars and other user files. |
| `SOURCE_MYSQL_HOST` | migration script | MySQL staging host. |
| `SOURCE_MYSQL_PORT` | migration script | MySQL staging port; defaults to `3306`. |
| `SOURCE_MYSQL_USER` / `SOURCE_MYSQL_PASSWORD` | migration script | Read-only source account credentials for preflight; apply also needs source `SELECT`. |
| `SOURCE_MYSQL_DATABASE` | migration script | Laravel database name to copy. |
| `SOURCE_MYSQL_SSL_CA` | migration script | Optional CA file for TLS connections to MySQL. |
| `SOURCE_TIMEZONE` | migration script | IANA timezone for source MySQL `DATETIME` values without timezone; defaults to `Asia/Tehran`. Confirm it against the actual Laravel environment before copying. |
| `MIGRATION_CONFIRM` | migration script | Must equal `copy-mysql-to-empty-postgres` together with `--apply`; never set for routine preflight. |

Do not commit `.env*` files, database dumps, passwords, or Laravel `APP_KEY`. Keep separate credentials for staging and production, and prefer the platform's secret manager over checked-in Compose environment values.

## Docker image example

Save as `Dockerfile` at the repository root if adopting this setup. Build with the repository root as context. The image uses separate web and API targets; the migration target retains build dependencies for Drizzle Kit. The production targets install production dependencies in their own stage.

Add this `.dockerignore` beside the Dockerfile so local secrets, database dumps, generated output, and host-installed dependencies do not enter the build context:

```dockerignore
.git
.env
.env.*
!.env.example
node_modules
**/node_modules
.next
**/dist
coverage
*.sql
*.zip
```

```dockerfile
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci --prefix apps/api

FROM deps AS build
WORKDIR /app
COPY . .
ARG NEST_API_URL=http://api:4000
ENV NEST_API_URL=${NEST_API_URL}
RUN npm run build
RUN ./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit false --outDir apps/api/dist --rootDir .

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci --omit=dev --prefix apps/api

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json next.config.ts ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "-p", "3000"]

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 4000
CMD ["node", "apps/api/dist/apps/api/src/main.js"]

FROM build AS migrate
CMD ["npx", "drizzle-kit", "migrate"]
```

Confirm the emitted API entry path against the current TypeScript configuration after building the image. If it changes, update the API command before deployment. This example intentionally leaves dependency scanning, image signing, non-root execution, and platform-specific secret injection to the production hardening pass.

## Docker Compose example

Save as `compose.yaml` if using the example Dockerfile. Set the required variables in the deployment environment or an ignored environment file. Compose waits for PostgreSQL health before migrations and for migration completion before starting the API; this ordering does not replace application health checks.

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:?Set POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER:?Set POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 20
    networks: [private]

  migrate:
    build:
      context: .
      target: migrate
      args:
        NEST_API_URL: http://api:4000
    environment:
      DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL}
    depends_on:
      db:
        condition: service_healthy
    networks: [private]
    restart: "no"

  api:
    build:
      context: .
      target: api
    environment:
      DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL}
      PORT: "4000"
      WEB_ORIGIN: ${WEB_ORIGIN:?Set WEB_ORIGIN}
      APP_KEY: ${APP_KEY:?Set the existing Laravel APP_KEY}
      TWO_FACTOR_ENABLED: ${TWO_FACTOR_ENABLED:-false}
      TWO_FACTOR_ROLES: ${TWO_FACTOR_ROLES:-admin}
      TWO_FACTOR_FAIL_OPEN: ${TWO_FACTOR_FAIL_OPEN:-false}
      IPPANEL_OTP_PATTERN_CODE: ${IPPANEL_OTP_PATTERN_CODE:-}
      UPLOAD_DIR: /data/uploads
    volumes:
      - uploads:/data/uploads
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4000/api/auth/me').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 4s
      retries: 10
    networks: [private]

  web:
    build:
      context: .
      target: web
      args:
        NEST_API_URL: http://api:4000
    environment:
      DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL}
      NEST_API_URL: http://api:4000
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"
    networks: [private]

volumes:
  postgres_data:
  uploads:

networks:
  private:
    internal: true
```

Use the same PostgreSQL credentials in `DATABASE_URL` and `POSTGRES_*`; a typical in-network URL is `postgres://<user>:<password>@db:5432/<database>`. The API health check treats an unauthenticated `401` from `/api/auth/me` as healthy because it checks process availability, not a valid session. Confirm that endpoint path and response behavior against the deployed API.

The Compose network is internal, while only the web port is published to the host. If the deployment platform requires egress from the API for SMS delivery, configure a controlled egress network instead of the `internal: true` setting and keep the database private.

## Nginx reverse proxy example

Place the `map` directive inside Nginx's `http` block, then configure the HTTPS virtual host. Replace certificate paths and hostnames with managed values. Keep upload size limits aligned with application validation.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name manager.example.com;

    ssl_certificate     /etc/letsencrypt/live/manager.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/manager.example.com/privkey.pem;

    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }
}

server {
    listen 80;
    server_name manager.example.com;
    return 301 https://$host$request_uri;
}
```

Nginx should proxy to Next only. Do not add a public NestJS or PostgreSQL listener. Verify cookie `Secure`, `HttpOnly`, and `SameSite` attributes and correct forwarded-protocol handling over HTTPS before enabling production login.

## MySQL to PostgreSQL cutover

1. Take and verify restorable backups of the MySQL database, uploaded files, Laravel `APP_KEY`, and current deployment configuration. Restore the supplied SQL dump into an isolated MySQL staging database; the migration script connects to a live MySQL database and does not parse `.sql` files.
2. Create a fresh PostgreSQL staging database, apply the checked-in Drizzle migrations with `npx drizzle-kit migrate`, and confirm it contains no rows in the tables being copied.
3. Install the Python dependencies from `scripts/migration/requirements.txt`. Configure source connection variables and the target `DATABASE_URL` through a secure environment. The default run is a read-only preflight:

   ```bash
   python scripts/migration/migrate_mysql_to_postgres.py
   ```

4. Review every table count, shared column count, source timezone, password-hash summary, and target-only table in the report. Resolve schema differences before applying. The script refuses source-only tables and refuses to merge into a non-empty target.
5. For the first staging copy only, obtain an approved empty target and run:

   ```bash
   MIGRATION_CONFIRM=copy-mysql-to-empty-postgres python scripts/migration/migrate_mysql_to_postgres.py --apply
   ```

   PowerShell equivalent: `$env:MIGRATION_CONFIRM='copy-mysql-to-empty-postgres'; python scripts/migration/migrate_mysql_to_postgres.py --apply`.

6. Compare MySQL and PostgreSQL row counts for every shared table, verify representative records and foreign-key integrity, verify sequence next values, test password login with an approved account/password, and compare representative KPI check-in/action writes between old and new systems. Validate avatars and other uploaded files separately; this script copies database rows only.
7. Repeat against a production-like staging restore. Schedule a controlled write freeze for final production copy or define a change-capture strategy; this utility alone does not replicate writes made after its source snapshot. Keep Laravel available for rollback until business owners sign off on the staged results and production smoke checks.

The Python utility requires compatible table names and columns. It copies only common column names, uses the target column type for JSON/boolean/time conversions, preserves stored password hashes, and recreates PostgreSQL foreign keys in the same target transaction. Preflight does not prove every value can be inserted or that every column has equivalent semantics; the full apply and post-copy checks remain required.

## Release and rollback sequence

Build immutable web and API images from the same revision. Run the Drizzle migration task before starting the API, then verify login, approval states, dashboard access, avatar retrieval, check-in submission, corrective actions, audit/inbox behavior, SMS paths as configured, and logout in staging. Capture logs without credentials or password hashes. Test restoring the PostgreSQL backup and uploaded-file volume before switching production traffic.

Do not delete or disable the Laravel application based only on a successful image build or database copy. The current parity checklist still records URL gaps, unrun sample-user login, and business-flow comparisons as open. Retain a tested rollback route to the previous application and database snapshot until those gates are closed.

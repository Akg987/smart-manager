# Smart Manager

Smart Manager is a Next.js frontend and NestJS API backed by PostgreSQL through Drizzle ORM. The Laravel application remains the migration reference until the parity gates in [the migration checklist](docs/migration/parity-checklist.md) pass.

## Local development

Requirements: Node.js 24, npm, and a PostgreSQL database with the Drizzle migrations applied.

Set `DATABASE_URL` in `.env.local` for the web app and API. Set `NEST_API_URL=http://localhost:4000` when the API is not running at its default address.

```bash
npm ci
npm ci --prefix apps/api
npx drizzle-kit migrate
npm run dev
```

In a second terminal, start the API:

```bash
npm --prefix apps/api run start:watch
```

The web app listens on port 3000 and the API on port 4000. The Next.js proxy forwards `/api/*` to NestJS.

## Verification

```bash
npm run build
npx tsc --noEmit
npm --prefix apps/api run typecheck
npm --prefix apps/api test
```

The MySQL-to-PostgreSQL migration utility and production deployment examples are documented in [docs/migration](docs/migration/).

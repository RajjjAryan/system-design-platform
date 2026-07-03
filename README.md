# SystemDesign Studio

SystemDesign Studio is a production architecture simulator for system design interviews. It gives interviewers and candidates a dense infrastructure CAD workspace with component palettes, live diagnostics, component inspectors, failure injection, architecture health scoring, and review mode.

## What Is Included

- Public dashboard and create-interview flow
- Password signup/login backed by the Node API
- User-specific interview dashboard
- Server-backed candidate/interviewer/panel invite links
- One shared live workspace with role-specific permissions for candidates, interviewers, and panels
- Authenticated WebSocket sync for shared workspace updates and presence, with polling fallback
- Expiring/revocable share links and stale-write conflict protection
- Interactive architecture workspace
- Drag-and-drop component palette
- Selectable nodes and edges
- Production-grade component inspectors powered by `sds-knowledge.js`
- Architecture health score, cost, p99, availability, throughput, SPOF and security signals
- Diagnostics drawer for critical, warning, and suggestion issues
- Failure injection for Redis, Kafka, database, and traffic spikes
- Interviewer-only AI hints panel
- Frozen review mode with scorecard and final feedback
- Managed Postgres persistence for production, with SQLite fallback for local single-instance use
- Email verification and password reset through SMTP
- Health/readiness endpoints, structured request logs, Sentry error monitoring, and database-backed product analytics events
- Buildless ESM Worker artifact for static hosting

## Repository Structure

```text
public/
  index.html        Browser entrypoint
  runtime-config.js Frontend API origin configuration
  styles.css        Product UI system
  app.js            Vanilla JS single-page application
  sds-data.js       Component palette and full question specs
  sds-knowledge.js  Inspector schemas, metrics, cost, diagnostics, scoring
server/
  api-server.mjs    Node API + static server for full product mode
  index.js          Source Worker contract for static artifact compatibility
Dockerfile          Container for full-stack deployment
render.yaml         Render blueprint with managed Postgres wiring
scripts/
  build.mjs         Builds dist/client and dist/server/index.js
  migrate-sqlite-to-postgres.mjs  One-off SQLite to Postgres data migration helper
  validate-artifact.mjs
tests/
  *.test.mjs        Node test suite
```

The full product path is the Node API server in `server/api-server.mjs`. The static artifact still exists for GitHub Pages/static hosting, but real login, persistence, and share-link enforcement require the API.

## Local Development

Install the production dependencies once:

```sh
npm install
```

```sh
npm test
npm run api
```

Open the full-stack app:

```text
http://127.0.0.1:8787
```

Use these environment variables for deployed API instances:

```sh
PORT=8787
DATABASE_URL=postgres://...
SDS_TOKEN_SECRET=replace-with-a-long-random-secret
SDS_PUBLIC_ORIGIN=https://rajjjaryan.github.io/system-design-platform/
SDS_REQUIRE_EMAIL_VERIFICATION=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=smtp-user
SMTP_PASS=smtp-password
SMTP_FROM="SystemDesign Studio <no-reply@example.com>"
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=production
```

If `DATABASE_URL` is not set, the API falls back to `SDS_DB_PATH` SQLite storage. Use that only for local development or a single non-scaled instance.

For frontend-only GitHub Pages, set `public/runtime-config.js` to the deployed API origin:

```js
window.SDS_CONFIG = {
  apiBaseUrl: 'https://your-api.example.com',
};
```

Static preview remains available:

```sh
npm test
npm run build
npm run validate
npm run serve
```

Open the local build:

```text
http://127.0.0.1:4173
```

## Production Build

```sh
npm run build
npm run validate
```

The build creates:

```text
dist/
  .openai/hosting.json
  client/
  server/index.js
```

`dist/server/index.js` is an ESM Worker with `default.fetch(request, env, ctx)`. It embeds the static client assets and serves `/index.html` for unknown app routes.

## Launch Notes

This repo now has a real backend-compatible launch path:

- Host the Node API (`npm start`) on a persistent Node 24 runtime with `DATABASE_URL` pointing at managed Postgres.
- Use `Dockerfile` directly, or import `render.yaml` on Render to provision the web service and Postgres database together.
- Keep `SDS_TOKEN_SECRET` private and rotate it before production traffic.
- Configure SMTP before enabling `SDS_REQUIRE_EMAIL_VERIFICATION=true`; otherwise signup and password reset requests intentionally fail closed.
- Set `SENTRY_DSN` to enable server-side exception capture. `/api/health` and `/api/ready` are available for uptime checks.
- Client usage events are posted to `/api/analytics/events` and stored in the database with bounded properties and hashed IPs.
- Point GitHub Pages `public/runtime-config.js` at the deployed API, or serve the frontend from the Node API for same-origin deployment.
- Keep GitHub Pages for the frontend only; it cannot provide server-side auth, durable storage, or role enforcement by itself.
- Use the in-app Privacy and Terms pages as product defaults, then replace the copy with counsel-reviewed language before high-scale public marketing.

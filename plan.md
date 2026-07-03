# SystemDesign Studio Production Implementation Plan

## Current Product Contract

SystemDesign Studio is now a full-stack system-design interview application, not a static prototype. The production path is:

- `server/api-server.mjs` serves the API and the browser app.
- SQLite persists users, interviews, share tokens, architecture state, scorecards, and final reviews.
- `public/app.js` is the browser SPA for login, dashboard, setup, workspace, sharing, diagnostics, and review.
- `public/sds-data.js` and `public/sds-knowledge.js` provide question specs, component metadata, diagnostics, scoring, metrics, and cost models.
- `Dockerfile` and `render.yaml` define the deployable backend path.

GitHub Pages can host the frontend only. Login, durable interviews, share links, and role enforcement require the Node API.

## Implemented End-to-End

- Password signup/login through `/api/auth/signup` and `/api/auth/login`.
- User-specific interview list through `/api/interviews`.
- Interview creation with question, candidate, permissions, blank architecture state, and score state.
- Server-issued candidate, interviewer, and panel invite tokens for the same workspace.
- Role-specific share loading through `/api/share/:token`.
- Candidate edit enforcement through `PATCH /api/share/:token`.
- Owner updates through `PATCH /api/interviews/:id`.
- Authenticated WebSocket subscriptions through `/api/ws/interviews/:id` for realtime shared-workspace invalidation.
- Canvas editing with drag/drop components, editable inspectors, edges, comments, pan, connect mode, shared refresh, and persisted architecture.
- Palette search.
- Dynamic diagnostics and AI interviewer hints derived from the current architecture.
- Review mode with persisted scores, decision, and feedback.
- Containerized deployment and Render blueprint with persistent SQLite disk.

## Verification Gates

Run before merging or deploying:

```sh
npm test
npm run build
npm run validate
docker build -t systemdesign-studio:local .
```

For runtime smoke testing:

```sh
SDS_TOKEN_SECRET="$(openssl rand -hex 32)" npm run api
```

Then verify:

- `GET /` returns the app.
- Signup creates a user and token.
- Creating an interview persists it to `/api/interviews`.
- Share links load role-filtered interview data.
- Candidate edits save only when `allowCandidateEdit` is true.
- Review submit persists decision and feedback.

## Production Readiness Notes

- Use `SDS_TOKEN_SECRET` in every non-local environment.
- Use a mounted persistent volume for `SDS_DB_PATH`.
- Move from SQLite to managed Postgres before running multiple API instances.
- Add email verification, password reset, rate limits, audit logs, and legal pages before broad public traffic.

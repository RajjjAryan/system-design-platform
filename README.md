# SystemDesign Studio

SystemDesign Studio is a production architecture simulator for system design interviews. It gives interviewers and candidates a dense infrastructure CAD workspace with component palettes, live diagnostics, component inspectors, failure injection, architecture health scoring, and review mode.

## What Is Included

- Public dashboard and create-interview flow
- Candidate link generation screen
- Interactive architecture workspace
- Drag-and-drop component palette
- Selectable nodes and edges
- Production-grade component inspectors powered by `sds-knowledge.js`
- Architecture health score, cost, p99, availability, throughput, SPOF and security signals
- Diagnostics drawer for critical, warning, and suggestion issues
- Failure injection for Redis, Kafka, database, and traffic spikes
- Interviewer-only AI hints panel
- Frozen review mode with scorecard and final feedback
- Buildless ESM Worker artifact for static hosting

## Repository Structure

```text
public/
  index.html        Browser entrypoint
  styles.css        Product UI system
  app.js            Vanilla JS single-page application
server/
  index.js          Source Worker contract
scripts/
  build.mjs         Builds dist/client and dist/server/index.js
  validate-artifact.mjs
tests/
  *.test.mjs        Node test suite
SystemDesign Studio Platform/
  sds-data.js       Component palette, questions, seed architecture
  sds-knowledge.js  Inspector schemas, metrics, cost, diagnostics, scoring
```

The old exported prototype is kept for reference. The production app lives in `public/` and uses the shared data and knowledge modules during build.

## Local Development

No dependency install is required.

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

This repo is ready for a static Worker-style hosting path. Before a public launch, decide the final hosting provider and domain, then deploy the `dist/` artifact created from a verified build.

For a public internet launch, the next production hardening layer should include:

- Real authentication and session ownership if user accounts are required
- Durable interview/session storage if users need cross-device persistence
- Server-side sharing tokens for candidate links
- Privacy policy and terms pages
- Error monitoring and analytics
- Abuse protection on public sharing routes

The current product is intentionally client-only and suitable for public MVP launch/demo without storing user data on a backend.

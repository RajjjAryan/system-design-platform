# SystemDesign Studio Production Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a production-grade Figma generation spec for the next version of SystemDesign Studio as an infrastructure CAD workspace for system design interviews.

**Architecture:** Preserve the current dark Linear/Figma-style static prototype and evolve it into a simulator-first design system. Treat `SystemDesign Studio Platform/SystemDesign Studio.dc.html` as the editable product surface, `SystemDesign Studio Platform/sds-data.js` as the palette/question seed source, and `SystemDesign Studio Platform/sds-knowledge.js` as the production knowledge engine for inspectors, metrics, diagnostics, cost, and scoring. Treat `SystemDesign Studio.html` as bundled output unless the project has a documented rebuild/export step.

**Tech Stack:** Static HTML/DC prototype, JavaScript modules, Figma frames/components/prototype links, Inter Tight for UI text, JetBrains Mono for metrics/configuration.

---

## Source Files And Responsibilities

- `plan.md`: This implementation plan and acceptance checklist.
- `SystemDesign Studio Platform/SystemDesign Studio.dc.html`: Main editable prototype shell, dashboard, workspace, inspectors, simulation controls, diagnostics drawer, review mode, and interaction logic.
- `SystemDesign Studio Platform/sds-data.js`: Component palette, icons, preset questions, default question specs, and seed canvas architecture.
- `SystemDesign Studio Platform/sds-knowledge.js`: Component-specific inspector schemas, metrics, cost models, failure modes, diagnostics, and architecture scoring.
- `SystemDesign Studio Platform/support.js`: Generated runtime support. Do not edit by hand unless rebuilding the runtime is explicitly in scope.
- `SystemDesign Studio.html`: Bundled standalone page. Regenerate from source if a bundling path exists; otherwise leave untouched during design-spec work.

## Product Direction

The next version should feel like the current prototype became a serious production architecture simulator, not a landing page and not a generic diagramming app. The Figma output should prioritize the workspace, deep component inspectors, live diagnostics, scenario injection, architecture health, and interview review flow.

Preserve the existing visual language:

- Dark-first, compact, developer-focused interface.
- `Inter Tight` for UI.
- `JetBrains Mono` for metrics, config values, diagnostic badges, and status text.
- Indigo accent `#6366f1`.
- Diagnostic colors: red for critical, orange/yellow for warnings and overload, green for healthy states.
- Fixed product shell: `54px` top toolbar, `40px` bottom status bar, `256px` left component palette, resizable `360px` right inspector, and infinite dotted canvas center.

## Figma Pages

Create these Figma pages:

- Foundations
- Dashboard + Create Interview
- Workspace
- Component Inspectors
- Simulation + Diagnostics
- Review Mode
- Mobile Viewer
- Component Library

## Task 1: Audit Current Prototype And Extract Design Tokens

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Read: `SystemDesign Studio Platform/sds-data.js`
- Read: `SystemDesign Studio Platform/sds-knowledge.js`
- Update: Figma page `Foundations`

- [ ] **Step 1: Capture layout constants**

Record these current layout constants in the Figma `Foundations` page:

```text
Top toolbar: 54px
Bottom status bar: 40px
Left palette: 256px target width
Right inspector: 360px target width
Desktop frames: 1440x900, 1366x768, 1920x1080
Mobile viewer: 390x844
Canvas: infinite dotted grid, dark background #0a0b0f
Primary surface: #0e1015
Panel/card surface: #12151c
Node surface: #161922
Primary accent: #6366f1
Secondary accent: #818cf8
Healthy: #34d399
Warning/overload: #f59e0b and #fbbf24
Critical/failure: #ef4444 and #fb7185
Muted text: #9498a6
Body text: #e6e8ee
```

- [ ] **Step 2: Capture typography**

Record these type styles in Figma:

```text
UI body: Inter Tight 13px/16px, weight 500
Panel headings: Inter Tight 15px/18px, weight 600
Section labels: JetBrains Mono 10px/12px, weight 600, uppercase
Metric values: JetBrains Mono 22-26px, weight 600
Field values: JetBrains Mono 12px/15px, weight 500
Button labels: Inter Tight 13px/16px, weight 600
```

- [ ] **Step 3: Capture core interaction states**

Document these reusable states:

```text
Default node: neutral border, #161922 fill
Selected node: #6366f1 ring plus soft indigo glow
Broken node: #ef4444 border and red glow
Affected downstream node: muted red border and red glow
Overloaded node: #f59e0b border and orange glow
Diagnostic dot: red or orange 15px dot anchored top-left
Selected toolbar item: indigo tinted background and #a5b4fc icon
Open menu: #12151c popover, 1px translucent border, 11px radius
```

- [ ] **Step 4: Verify**

Check that the Figma `Foundations` page includes color, type, spacing, shell, node, badge, panel, menu, and diagnostic state tokens before moving on.

## Task 2: Design Dashboard And Create Interview Flow

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Read: `SystemDesign Studio Platform/sds-data.js`
- Update: Figma page `Dashboard + Create Interview`

- [ ] **Step 1: Create dashboard frame**

Create a `1440x900` dashboard frame with:

```text
Top navigation with SystemDesign Studio mark, search, notifications, user avatar
Upcoming interviews section
Resume in progress section
Question library grid
Recent architectures section
Open-source/community signal
Primary Create interview button
```

- [ ] **Step 2: Create question cards**

Use representative cards from `QUESTIONS` in `sds-data.js`:

```text
Design Twitter - Hard - Timelines, Fan-out, Caching - 45m
Design WhatsApp - Hard - Messaging, Presence, E2E - 45m
Design Uber - Hard - Geo, Matching, Dispatch - 50m
Design TinyURL - Easy - Hashing, KV Store, Redirects - 30m
Design Payment System - Hard - Idempotency, Ledger, Consistency - 50m
```

- [ ] **Step 3: Create interview setup flow**

Design the create interview flow with:

```text
Preset/custom question picker
Difficulty selector
Duration selector
Candidate link generation
Interviewer controls
Permissions panel
Start workspace command
```

- [ ] **Step 4: Prototype dashboard interaction**

Add prototype links:

```text
Question card click -> Workspace default frame
Create interview click -> Create Interview modal or full setup frame
Start workspace click -> Workspace default frame
Share link generated -> Candidate joins state
```

- [ ] **Step 5: Verify**

Check that the dashboard is operational and not marketing-led: the first screen must emphasize interviews, question selection, active work, and recent architecture sessions.

## Task 3: Design Workspace Shell

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Update: Figma page `Workspace`

- [ ] **Step 1: Create desktop workspace frames**

Create these frames:

```text
Workspace / Default / 1440x900
Workspace / Default / 1366x768
Workspace / Default / 1920x1080
```

Each frame must include:

```text
54px top toolbar
40px bottom collaboration/status bar
256px left component palette
360px right architecture-health panel
Infinite dotted canvas
Collapsible question panel
Simulation cluster in top toolbar
Zoom controls
AI assistant hint button
Finish & review button
```

- [ ] **Step 2: Populate left component palette**

Use categories and items from `PALETTE` in `sds-data.js`:

```text
Frontend: Web Client, Mobile App, CDN, Browser
API: API Gateway, Load Balancer, Reverse Proxy, GraphQL Gateway, REST API
Compute: Service, Worker, Cron, Lambda, ECS, Kubernetes Pod
Storage: MySQL, PostgreSQL, Redis, DynamoDB, Cassandra, MongoDB, Elasticsearch, S3
Messaging: Kafka, RabbitMQ, SQS, Pub/Sub
Infrastructure: DNS, CDN, Cache, Firewall, NAT, VPN
Monitoring: Grafana, Prometheus, Logs, Metrics, Alerts
AI: Vector DB, Embedding Service, LLM, RAG, Inference API
Other: Queue, Cache, Auth, Notification, Payment, Search
```

- [ ] **Step 3: Populate default canvas**

Use the current Twitter seed architecture:

```text
Mobile App -> API Gateway -> Load Balancer -> Tweet Service
Load Balancer -> Timeline Service
Tweet Service -> Cassandra
Tweet Service -> Kafka
Kafka -> Timeline Service
Timeline Service -> Redis
Timeline Service -> Cassandra
Mobile App -> CDN -> S3
```

- [ ] **Step 4: Ensure responsive toolbar behavior**

For `1366x768`, collapse dense controls into grouped menus where needed:

```text
Keep select, pan, connect, comment, latency icons visible.
Keep Break, Traffic, Inject, and Finish & review visible.
Allow Scale, AI, and secondary controls to group if space is tight.
No toolbar text or button should clip at 1366px width.
```

- [ ] **Step 5: Verify**

Inspect the three desktop frames and confirm the toolbar, side panels, canvas, nodes, edge labels, and status bar do not overlap or clip.

## Task 4: Design Architecture Health Panel

**Files:**
- Read: `SystemDesign Studio Platform/sds-knowledge.js`
- Update: Figma page `Workspace`
- Update: Figma page `Simulation + Diagnostics`

- [ ] **Step 1: Create health summary panel**

Design a right panel state shown when no component or edge is selected:

```text
Architecture health score
Health grade
Monthly cost
Estimated p99
Estimated availability
Max throughput
Single points of failure count
Monitoring status
Backup status
Security gap status
```

- [ ] **Step 2: Create dimension bars**

Include bars for all scoring dimensions from `scoreArchitecture`:

```text
Scalability
Availability
Reliability
Maintainability
Cost
Security
Performance
Observability
Fault tolerance
Consistency
```

- [ ] **Step 3: Create diagnostic count summary**

Include:

```text
Critical count
Warning count
Suggestion count
Open diagnostics drawer command
```

- [ ] **Step 4: Verify**

Confirm the panel communicates production readiness at a glance and uses realistic metrics, not decorative summary cards.

## Task 5: Design Shared Component Inspector System

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Read: `SystemDesign Studio Platform/sds-knowledge.js`
- Update: Figma page `Component Inspectors`
- Update: Figma page `Component Library`

- [ ] **Step 1: Create shared inspector shell**

Design the selected-component right inspector with:

```text
Component icon
Component name
Component category
Description
Health badge
Break/restore component command
Delete command
Tabbed inspector body
```

- [ ] **Step 2: Standardize inspector tabs**

Use these shared tabs for the Figma system, even where the current code uses shorter IDs:

```text
General
Networking
Scaling
Performance
Storage
Security
Observability
Failure
Cost
Interview
```

- [ ] **Step 3: Create field controls**

Create reusable controls:

```text
Text input
Number input with unit
Select
Boolean toggle
Metric row with bar
Cost row
Failure mode row
Interview pros/cons row
Interview follow-up prompt row
Critical/warning diagnostic chip
```

- [ ] **Step 4: Verify**

Check that all inspector controls fit inside a `360px` panel without horizontal clipping.

## Task 6: Design Six Core Deep Inspectors

**Files:**
- Read: `SystemDesign Studio Platform/sds-knowledge.js`
- Update: Figma page `Component Inspectors`

- [ ] **Step 1: Redis inspector**

Create Redis states for healthy, standalone SPOF, overloaded, and broken:

```text
Topology: Standalone, Sentinel, Cluster
Version: 7.2, 7.0, 6.2
Node memory: 4 GB, 8 GB, 16 GB, 32 GB, 64 GB
Replicas per primary
Multi-AZ
Cluster mode
Shards
Replication factor
Max memory %
Eviction policy
Persistence: None, RDB, AOF, RDB + AOF
TLS in transit
Security group
Cache hit ratio
Memory utilization
CPU
Ops/sec
Evictions/sec
Replication lag
p99 latency
Monthly cost
Failure modes: primary failure, OOM, network partition
Critical diagnostic: Redis has no replica
```

- [ ] **Step 2: DynamoDB inspector**

Create DynamoDB states for healthy, hot partition, throttled, and expensive on-demand:

```text
Billing mode: On-demand, Provisioned
Partition key
Sort key
RCU
WCU
Auto scaling
Average item size
Adaptive capacity
GSI count
LSI count
TTL
Streams
Global tables
Encryption at rest
PITR
Backups
Consumed read capacity
Consumed write capacity
Hottest partition
Throttled requests/sec
p99 latency
Estimated partition count
Monthly cost
Warning diagnostic: Weak DynamoDB partition key
Suggestion diagnostic: No TTL configured
```

- [ ] **Step 3: Kafka inspector**

Create Kafka states for healthy, RF=1 critical, consumer lag, and broker failure:

```text
Broker count
Replication factor
Min in-sync replicas
Partitions
Retention
Cleanup policy
Compression
Producer acks
Idempotent producer
Batch size
linger.ms
Consumer group
Consumer count
Offset reset
Dead-letter queue
Messages/sec
Throughput
Consumer lag
Partition skew
Under-replicated partitions
End-to-end p99
Monthly cost
Critical diagnostic: Kafka replication factor < 2
Warning diagnostic: Fewer partitions than consumers
```

- [ ] **Step 4: Load Balancer inspector**

Create Load Balancer states for healthy, single backend, all backends unhealthy, and overload:

```text
Algorithm
Sticky sessions
Layer: L4 TCP or L7 HTTP
Health check interval
Unhealthy threshold
Circuit breaker
Retries
Timeout
Max connections
Idle timeout
TLS termination
Active connections
Requests/sec
Healthy backends
5xx rate
p95 latency
Monthly cost
Warning diagnostic: Load balancer points to one backend
```

- [ ] **Step 5: API Service inspector**

Create API Service states for healthy, missing auth, CPU saturation, and retry storm:

```text
Runtime/language
Framework
CPU request
Memory
Replicas
Worker/thread pool
Timeout
Circuit breaker
Retry policy
Rate limiter
Authentication
mTLS
Authorization
QPS
CPU per pod
p95 latency
p99 latency
Error rate
Open connections
Monthly cost
Critical diagnostic: API Gateway or REST API has no authentication
Warning diagnostic: Retries without a circuit breaker
```

- [ ] **Step 6: PostgreSQL/MySQL inspector**

Create PostgreSQL/MySQL states for healthy, public exposure, connection exhaustion, slow query, and primary failover:

```text
Instance class
Version
Read replicas
Multi-AZ standby
Automatic failover
Sharded
Shard key
Connection pool
Max connections
Isolation level
Slow query log
Autovacuum for PostgreSQL
Provisioned disk
Provisioned IOPS
Automated backups
Backup retention
QPS
CPU
Connections
Replica lag
Slow query %
p99 latency
Disk used
Monthly cost
Critical diagnostic: data store exposed publicly
Suggestion diagnostic: no cache in front of database
```

- [ ] **Step 7: Verify**

Confirm each of the six core components has realistic fields, metrics, diagnostics, failure states, cost state, and interview follow-ups.

## Task 7: Design Selected Edge Inspector

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Read: `SystemDesign Studio Platform/sds-knowledge.js`
- Update: Figma page `Component Inspectors`

- [ ] **Step 1: Create edge inspector**

Design the selected-edge right panel with:

```text
Protocol selector: HTTP, HTTPS, gRPC, Kafka, Redis, MySQL, Postgres, TCP, UDP, Websocket
Serializer selector: JSON, Protobuf, Avro, MessagePack
Throughput badge
TLS toggle
Compression toggle
Retries input
Timeout input
Circuit breaker toggle
Connection pool input
Bidirectional mode toggle
```

- [ ] **Step 2: Create edge states**

Create these visual states:

```text
Default edge
Selected edge
High-throughput edge
Broken downstream edge
Overloaded edge
Bidirectional edge
```

- [ ] **Step 3: Verify**

Confirm edge labels remain readable over the canvas and selected-edge editing does not conflict with selected-node inspector states.

## Task 8: Design Diagnostics Drawer

**Files:**
- Read: `SystemDesign Studio Platform/sds-knowledge.js`
- Update: Figma page `Simulation + Diagnostics`

- [ ] **Step 1: Create VS Code Problems-style drawer**

Design a bottom or side diagnostics drawer with:

```text
Critical section
Warning section
Suggestion section
Issue title
Affected node
Why it matters
Production impact
Recommended fix
Click target to select affected node
```

- [ ] **Step 2: Include required diagnostic examples**

Represent these issues:

```text
Redis SPOF: Redis has no replica
Kafka RF=1: Kafka replication factor < 2
DynamoDB hot partition: Weak DynamoDB partition key
Load balancer single backend: Load balancer points to one backend
Public DB exposure: data store exposed publicly
API auth missing: API Gateway or REST API has no authentication
```

- [ ] **Step 3: Prototype diagnostics interaction**

Add prototype links:

```text
Open diagnostics -> drawer opens
Click Redis SPOF issue -> Redis node selected, Redis inspector open
Click Kafka RF=1 issue -> Kafka node selected, Kafka inspector open
Click API auth issue -> API Gateway or REST API selected, API inspector open
```

- [ ] **Step 4: Verify**

Confirm every diagnostic item shows severity, title, affected node, impact, and fix.

## Task 9: Design Simulation And Failure Injection

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Read: `SystemDesign Studio Platform/sds-knowledge.js`
- Update: Figma page `Simulation + Diagnostics`

- [ ] **Step 1: Create scenario injection menu**

Design the injection menu with:

```text
Redis down
Kafka broker dies
DB outage
Region outage
AZ outage
Traffic spike
Flash sale
Hot partition
Slow DB
Cache stampede
Retry storm
```

- [ ] **Step 2: Create traffic spike state**

Create `Traffic x1000` frame with:

```text
Traffic badge active in toolbar
Overloaded nodes highlighted orange
Animated/high-throughput edges
Higher p99 latency
Higher monthly cost
Lower architecture health score
New diagnostic warnings
Scenario timeline entry: Traffic x1000 spike
```

- [ ] **Step 3: Create broken dependency state**

Create broken Redis, Kafka, and DB states:

```text
Broken node turns red
Outgoing and dependent edges become dashed red
Downstream services highlight as affected
Diagnostics drawer opens
Architecture health score drops
Right inspector shows failure modes for selected broken component
```

- [ ] **Step 4: Create constraint cards**

Represent injected constraints:

```text
Users: 1M -> 100M
Latency: 500ms -> 50ms
Must support multi-region
Switch to strong consistency
GDPR data residency
Add offline support
Cut infra cost 40%
```

- [ ] **Step 5: Verify**

Confirm simulation states update metrics, overloaded nodes, architecture score, diagnostics, timeline entries, and cost estimates.

## Task 10: Design AI Assistant As Hints-Only

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Update: Figma page `Workspace`
- Update: Figma page `Review Mode`

- [ ] **Step 1: Create AI hints panel**

Design the assistant as a narrow hints panel with:

```text
Missing components
Single points of failure
Bottlenecks
Tradeoffs
Interview follow-ups
```

- [ ] **Step 2: Enforce no full-answer behavior**

The assistant copy must avoid complete generated architectures. Use phrasing like:

```text
Potential SPOF: Redis cache has no replica.
Missing component: No rate limiter sits between the gateway and services.
Bottleneck: Cassandra write path may saturate under fan-out.
Follow-up: Ask how the candidate handles celebrity fan-out.
```

- [ ] **Step 3: Verify**

Confirm the AI assistant critiques and prompts, but does not solve the design for the candidate.

## Task 11: Design Review Mode

**Files:**
- Read: `SystemDesign Studio Platform/SystemDesign Studio.dc.html`
- Update: Figma page `Review Mode`

- [ ] **Step 1: Create frozen architecture summary**

Design review mode with:

```text
Frozen architecture label
Component count
Connection count
Data store count
Cache count
Queue count
Load balancer count
Placed component chips
Architecture health score
```

- [ ] **Step 2: Create generated observations**

Show observations based on diagnostics and assistant hints:

```text
Potential SPOFs
Missing observability
Database or cache bottlenecks
Security gaps
Scaling tradeoffs
```

- [ ] **Step 3: Create manual scorecard**

Include these score dimensions:

```text
Scalability
Availability
Reliability
Communication
Tradeoffs
Database choice
Caching
Load balancing
Observability
Security
```

- [ ] **Step 4: Create final evaluation controls**

Include:

```text
Event timeline
Summary notes
Final feedback
Advance decision
No-hire decision
Submit evaluation button
```

- [ ] **Step 5: Prototype review interaction**

Add prototype link:

```text
Finish & review -> Review Mode frame
Back to canvas -> Workspace frame
Submit evaluation -> Submitted state
```

- [ ] **Step 6: Verify**

Confirm review mode supports interview debrief and assessment rather than generic design export.

## Task 12: Design Mobile Viewer

**Files:**
- Update: Figma page `Mobile Viewer`

- [ ] **Step 1: Create mobile frame**

Create `390x844` mobile viewer with:

```text
Read-only architecture preview
Question summary
Health score
Diagnostics summary
Scenario timeline
Review status
Compact component detail bottom sheet
```

- [ ] **Step 2: Define mobile limits**

Document that V1 mobile is a viewer, not a full editor:

```text
No drag-and-drop editing
No full inspector editing
No scenario authoring
Allows review, inspection, and diagnostics scanning
```

- [ ] **Step 3: Verify**

Confirm text does not overlap or clip on `390x844`.

## Task 13: Build Prototype Flow Map

**Files:**
- Update: Figma prototype links across all pages

- [ ] **Step 1: Add required prototype flow**

Wire these interactions:

```text
Dashboard question card -> Workspace
Create custom interview -> Share link -> Candidate joins
Drag Redis onto canvas -> Select Redis -> Redis inspector opens
Set Redis to Standalone/no replicas -> Critical diagnostic appears
Inject traffic x1000 -> Metrics, overloaded nodes, architecture score, and costs update
Break Kafka/Redis/DB -> Node turns red, edges dash, downstream services highlight
Open diagnostics -> Click issue -> Corresponding node selects and inspector opens
Finish & review -> Frozen summary, observations, scorecard, final feedback
```

- [ ] **Step 2: Add frame naming convention**

Use names that make prototype review easy:

```text
Dashboard / Home / 1440
Dashboard / Create Interview / Setup
Dashboard / Create Interview / Link Generated
Workspace / Default / 1440
Workspace / Selected Redis / SPOF
Workspace / Selected Kafka / RF1
Workspace / Selected Edge / gRPC
Simulation / Traffic x1000
Simulation / Redis Down
Diagnostics / Problems Open
Review / Summary
Mobile / Viewer
```

- [ ] **Step 3: Verify**

Run through the prototype in presentation mode and confirm the core story is navigable without designer narration.

## Task 14: Acceptance Review

**Files:**
- Read: `plan.md`
- Review: All Figma pages and prototype links

- [ ] **Step 1: Check frame requirements**

Confirm the Figma file includes:

```text
Desktop frame: 1440x900
Desktop frame: 1366x768
Desktop frame: 1920x1080
Mobile viewer frame: 390x844
```

- [ ] **Step 2: Check toolbar responsiveness**

Confirm the `1366x768` workspace frame has no clipped toolbar controls.

- [ ] **Step 3: Check core component depth**

Confirm Redis, DynamoDB, Kafka, Load Balancer, API Service, and PostgreSQL/MySQL each have:

```text
Realistic editable fields
Live metrics
Diagnostics
Failure states
Cost state
Interview prompts
```

- [ ] **Step 4: Check required diagnostic demos**

Confirm the prototype demonstrates:

```text
Redis SPOF
Kafka RF=1
DynamoDB hot partition
Load balancer single backend
Public DB exposure
API auth missing
```

- [ ] **Step 5: Check product feel**

Confirm the final result feels like a production architecture simulator for interviews:

```text
Simulator-first
Production-grade
Dense but readable
Clearly interview-oriented
Not a landing page
Not a generic diagramming app
Not an AI answer generator
```

## Execution Notes

- Prefer depth for the six core components over broad static icon coverage.
- Keep dark mode as the primary design. Light mode is a later design-system variant.
- The platform remains an interview tool. AI should assist with hints and critique, not auto-generate a complete answer.
- When changing the local prototype after the Figma spec is complete, edit `SystemDesign Studio Platform/SystemDesign Studio.dc.html`, `sds-data.js`, and `sds-knowledge.js` first, then regenerate `SystemDesign Studio.html` only if a reliable bundling workflow is available.

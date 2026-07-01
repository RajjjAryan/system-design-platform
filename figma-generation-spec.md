# SystemDesign Studio Production Figma Generation Spec

## Purpose

Create the next SystemDesign Studio Figma file as a production architecture simulator for system design interviews. The design must evolve the current dark static prototype into an "Infrastructure CAD" workspace: dense, precise, simulator-first, and interview-oriented.

This document is written for a senior designer or Figma-generation model. It should be used as the source for creating the Figma file and its interactive prototype.

## Source Context

Use these repo files as product truth:

- `SystemDesign Studio Platform/SystemDesign Studio.dc.html`: current dashboard, workspace, inspector, diagnostics, simulation, review UI, and interaction logic.
- `SystemDesign Studio Platform/sds-data.js`: palette categories, component names, icons, questions, and seed Twitter architecture.
- `SystemDesign Studio Platform/sds-knowledge.js`: production schemas for component inspectors, metrics, costs, failure modes, diagnostics, and health scoring.
- `plan.md`: implementation checklist and acceptance criteria.

Do not design a new landing page. Do not reposition the product as a generic whiteboard. The first impression must be a working interview simulator.

## Design Principles

- Preserve the current dark Linear/Figma-style product language.
- Optimize for repeated expert use by interviewers and candidates.
- Prefer dense, scan-friendly panels over large marketing sections.
- Make simulation state visible through nodes, edges, metrics, diagnostics, and review summary.
- AI is critique-only. It gives hints, follow-ups, and risk notes. It never generates a complete system design answer.
- The workspace is the core product. All other pages support setup, inspection, simulation, and review.

## Figma File Structure

Create these Figma pages in this order:

1. `Foundations`
2. `Dashboard + Create Interview`
3. `Workspace`
4. `Component Inspectors`
5. `Simulation + Diagnostics`
6. `Review Mode`
7. `Mobile Viewer`
8. `Component Library`

## Global Tokens

### Colors

Use these as named color styles:

```text
Background / App: #0a0b0f
Background / Toolbar: #0e1015
Background / Panel: #12151c
Background / Node: #161922
Border / Subtle: rgba(255,255,255,0.07)
Border / Control: rgba(255,255,255,0.09)
Text / Primary: #e6e8ee
Text / Secondary: #c5c8d2
Text / Muted: #9498a6
Text / Dim: #7c8090
Accent / Primary: #6366f1
Accent / Secondary: #818cf8
Accent / Soft: #a5b4fc
State / Healthy: #34d399
State / Warning: #f59e0b
State / Warning Soft: #fbbf24
State / Critical: #ef4444
State / Critical Soft: #fb7185
State / Info: #38bdf8
State / AI: #e879f9
```

### Typography

Use these as text styles:

```text
UI / Body: Inter Tight, 13px, 16px line height, 500
UI / Body Small: Inter Tight, 12px, 15px line height, 500
UI / Panel Title: Inter Tight, 15px, 18px line height, 600
UI / Section Title: Inter Tight, 13px, 16px line height, 600
UI / Button: Inter Tight, 13px, 16px line height, 600
UI / Page Title: Inter Tight, 26px, 31px line height, 600
Mono / Label: JetBrains Mono, 10px, 12px line height, 600, uppercase
Mono / Value: JetBrains Mono, 12px, 15px line height, 500
Mono / Metric: JetBrains Mono, 22px, 27px line height, 600
Mono / Large Metric: JetBrains Mono, 26px, 31px line height, 600
```

Use letter spacing `0`. Do not use viewport-scaled font sizes.

### Layout Constants

```text
Top toolbar height: 54px
Bottom status bar height: 40px
Left palette width: 256px
Right inspector width: 360px
Create/review side panel width: 400px
Toolbar icon button: 34x34px
Compact icon button: 32x32px
Node default width: 150px
Node default height: 66px
Node radius: 11px
Panel/card radius: 8px to 12px, avoid larger radii
Popover radius: 11px
Canvas grid dot: 1px dot, 20px spacing, low opacity
```

### Required Frame Sizes

Create at least these top-level frames:

```text
Dashboard / Home / 1440: 1440x900
Workspace / Default / 1440: 1440x900
Workspace / Default / 1366: 1366x768
Workspace / Default / 1920: 1920x1080
Mobile / Viewer: 390x844
```

The `1366x768` workspace frame is a hard acceptance frame. No toolbar control may clip.

## Reusable Components

Build the following components in `Component Library`.

### App Shell

Variants:

```text
Dashboard shell
Workspace shell
Review shell
Mobile viewer shell
```

Workspace shell anatomy:

```text
54px top toolbar
256px left palette
Canvas center
360px right panel
40px bottom status bar
```

### Toolbar Icon Button

Variants:

```text
Default
Hover
Active
Disabled
Critical active
Warning active
```

Use icons, not text, for common commands: undo, redo, select, pan, connect, comment, latency, reset, zoom.

### Product Button

Variants:

```text
Primary
Secondary
Ghost
Danger
Success
Icon-only
Icon-plus-label
```

### Component Node

Variants:

```text
Default
Selected
Broken
Affected downstream
Overloaded
Connecting source
With critical diagnostic dot
With warning diagnostic dot
```

Node anatomy:

```text
Category icon tile: 34x34px
Component name
Optional latency overlay
Optional diagnostic count dot
Optional broken/overloaded glow
```

### Edge

Variants:

```text
Default
Selected
High throughput
Broken/downstream affected
Overloaded
Bidirectional
```

Edge labels:

```text
Protocol chip: dark chip with mono label
Throughput badge: filled chip using #a5b4fc normally, #f59e0b under load, #ef4444 when broken
```

### Inspector Controls

Create reusable variants:

```text
Text input
Number input with unit suffix
Select
Boolean toggle
Metric row with progress bar
Cost row
Failure mode row
Interview pros/cons row
Interview follow-up row
Diagnostic chip
Tab item
```

All inspector controls must fit inside a `360px` right panel with no horizontal clipping.

## Page: Foundations

Create a compact design-system page containing:

- Color swatches with labels and hex values.
- Type styles with sample text.
- Layout constants as annotated mini diagrams.
- Node state examples.
- Edge state examples.
- Diagnostic severity examples.
- Toolbar control examples.
- Inspector control examples.
- Canvas grid sample.

Use production UI examples, not abstract decorations.

## Page: Dashboard + Create Interview

### Frame: Dashboard / Home / 1440

Top navigation:

```text
SystemDesign Studio mark
Search input: "Search interviews, questions, candidates..."
Notification icon
User avatar
```

Primary content:

```text
Greeting and today summary
Primary "Create interview" button
Stats: Interviews this week, Avg. duration, Pass rate, Question presets
Upcoming interviews
Resume in progress
Question library
Recent architectures
Open-source/community signal
```

Question card examples:

```text
Design Twitter - Hard - Timelines, Fan-out, Caching - 45m
Design WhatsApp - Hard - Messaging, Presence, E2E - 45m
Design Uber - Hard - Geo, Matching, Dispatch - 50m
Design TinyURL - Easy - Hashing, KV Store, Redirects - 30m
Design Payment System - Hard - Idempotency, Ledger, Consistency - 50m
```

Recent architecture examples:

```text
Twitter feed - Priya S. - 10 components - paused 12 min ago
Payment ledger - Omar K. - reviewed yesterday
Food delivery tracking - Meera V. - shared with hiring panel
```

Open-source/community signal:

```text
Community templates
Interview question packs
Architecture review examples
Contribute a component model
```

### Frame: Dashboard / Create Interview / Setup

Create a setup flow with these sections:

```text
Question source: Preset or Custom
Question picker with difficulty and duration
Custom prompt editor
Difficulty: Easy, Medium, Hard
Duration: 30, 40, 45, 50, 60 minutes
Candidate information
Interviewer controls
Permissions
Start workspace command
Generate candidate link command
```

Interviewer controls:

```text
Allow candidate editing
Allow interviewer intervention
Enable diagnostics during interview
Hide architecture score from candidate
Enable failure injection
Enable AI hints for interviewer only
Record event timeline
```

Permissions:

```text
Candidate can view question
Candidate can edit canvas
Candidate cannot view scorecard
Interviewer can inject scenarios
Hiring panel can view review after submission
```

### Frame: Dashboard / Create Interview / Link Generated

Show:

```text
Candidate invite link
Copy link button
Open workspace button
Candidate joined status
Session permissions summary
```

### Prototype Links

```text
Create interview -> Dashboard / Create Interview / Setup
Generate candidate link -> Dashboard / Create Interview / Link Generated
Open workspace -> Workspace / Default / 1440
Question card -> Workspace / Default / 1440
Resume in progress -> Workspace / Default / 1440
```

## Page: Workspace

### Frame: Workspace / Default / 1440

Use fixed shell:

```text
Top toolbar: 54px
Left palette: 256px
Right architecture health panel: 360px
Bottom status bar: 40px
Canvas center: dotted infinite canvas
```

Top toolbar groups:

```text
Product mark
Undo and redo
Select, pan, connect, comment, latency overlay
Simulation label
Break
Traffic menu
Scale menu
Inject menu
Reset simulation
Zoom controls
AI hints
Finish & review
```

Canvas content:

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

Edge labels:

```text
Mobile App -> API Gateway: 120K RPS
Tweet Service -> Cassandra: 40K W/s
Timeline Service -> Redis: 2M reads/s
```

Question panel:

```text
Design Twitter
Difficulty: Hard
Functional requirements
Non-functional requirements
Scale assumptions
Follow-up prompts
Collapse/expand control
```

Bottom status bar:

```text
Candidate online
Interviewer online
Timer
Node count
Edge count
Simulation state
Saved status
Latency overlay status
```

### Frame: Workspace / Default / 1366

Same shell as 1440 but with responsive toolbar behavior:

```text
Keep visible: select, pan, connect, comment, latency, Break, Traffic, Inject, Finish & review.
Group or abbreviate: Scale, AI hints, secondary status controls.
Keep zoom controls compact.
No clipped labels.
No overlapping popovers.
```

### Frame: Workspace / Default / 1920

Use the extra width for:

```text
Wider canvas
Expanded question panel
More breathing room between toolbar groups
Visible architecture health panel details
```

## Architecture Health Panel

Shown in the right panel when no component or edge is selected.

Top summary:

```text
Architecture health score: 3.2 / 5
Grade: Needs hardening
Critical issues: 2
Warnings: 4
Suggestions: 3
Monthly cost: $3.8K
Estimated p99: ~120 ms
Estimated availability: 99.95%
Max throughput: 40K RPS
SPOFs: 2
Monitoring: Missing
Backups: Enabled or None
Security: Clear or N issues
```

Dimension bars:

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

Use colors:

```text
4.0 to 5.0: #34d399
3.0 to 3.9: #6366f1
2.0 to 2.9: #f59e0b
1.0 to 1.9: #ef4444
```

Panel commands:

```text
Open diagnostics
Open AI hints
Finish & review
```

## Page: Component Inspectors

### Shared Inspector Shell

Right panel selected-component state:

```text
Component header
Icon and category color
Component name
Category label
Description
Health badge
Diagnostics count
Break/restore component command
Delete command
Tabs
Scrollable inspector body
```

Shared tab model:

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

Do not force every component to show every tab if empty, but the component system must support all tabs.

### Redis Inspector

Create frames:

```text
Inspector / Redis / Healthy
Inspector / Redis / Standalone SPOF
Inspector / Redis / Overloaded
Inspector / Redis / Broken
```

Fields:

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
Snapshot interval
Port
TLS in transit
Security group
```

Metrics:

```text
Cache hit ratio
Memory utilization
CPU
Ops / sec
Evictions / sec
Replication lag
p99 latency
```

Failure modes:

```text
Primary failure
Out of memory
Network partition
```

Diagnostics:

```text
Critical: Redis has no replica
Warning: No Redis persistence
```

Interview prompts:

```text
How do you prevent a cache stampede on a cold key?
Write-through vs write-back vs cache-aside - which and why?
What happens to hit ratio when you 10x traffic?
```

### DynamoDB Inspector

Create frames:

```text
Inspector / DynamoDB / Healthy
Inspector / DynamoDB / Hot Partition
Inspector / DynamoDB / Throttled
Inspector / DynamoDB / Expensive On-Demand
```

Fields:

```text
Billing mode: On-demand, Provisioned
Partition key
Sort key
RCU
WCU
Auto scaling
Average item size
Adaptive capacity
Global secondary indexes
Local secondary indexes
TTL
Streams
Global tables
Encryption at rest
Point-in-time recovery
On-demand backups
```

Metrics:

```text
Consumed read capacity
Consumed write capacity
Hottest partition
Throttled requests / s
p99 latency
Estimated partition count
```

Diagnostics:

```text
Warning: Weak DynamoDB partition key
Suggestion: No TTL configured
```

Interview prompts:

```text
How do you pick a partition key to avoid hot partitions?
On-demand vs provisioned - where is the cost crossover?
How would you model a many-to-many relationship?
```

### Kafka Inspector

Create frames:

```text
Inspector / Kafka / Healthy
Inspector / Kafka / RF1 Critical
Inspector / Kafka / Consumer Lag
Inspector / Kafka / Broker Failure
```

Fields:

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
```

Metrics:

```text
Messages / sec
Throughput
Consumer lag
Partition skew
Under-replicated partitions
End-to-end p99
```

Diagnostics:

```text
Critical: Kafka replication factor < 2
Warning: Fewer partitions than consumers
```

Interview prompts:

```text
How do partitions relate to consumer parallelism?
What does acks=all + min.insync.replicas guarantee?
How do you recover from a broker outage without data loss?
```

### Load Balancer Inspector

Create frames:

```text
Inspector / Load Balancer / Healthy
Inspector / Load Balancer / Single Backend
Inspector / Load Balancer / All Backends Unhealthy
Inspector / Load Balancer / Overloaded
```

Fields:

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
```

Metrics:

```text
Active connections
Requests / sec
Healthy backends
5xx rate
p95 latency
```

Diagnostics:

```text
Warning: Load balancer points to one backend
```

Interview prompts:

```text
Least-connections vs round-robin - when does it matter?
How do you avoid the load balancer being a SPOF?
Where do you put the circuit breaker and why?
```

### API Service Inspector

Create frames:

```text
Inspector / API Service / Healthy
Inspector / API Service / Missing Auth
Inspector / API Service / CPU Saturation
Inspector / API Service / Retry Storm
```

Fields:

```text
Language / runtime
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
```

Metrics:

```text
QPS
CPU / pod
p95 latency
p99 latency
Error rate
Open connections
```

Diagnostics:

```text
Critical: API Gateway or REST API has no authentication
Warning: Retries without a circuit breaker
```

Interview prompts:

```text
Where do circuit breakers and timeouts belong?
How do you prevent a retry storm?
How do you size the worker pool?
```

### PostgreSQL / MySQL Inspector

Create frames:

```text
Inspector / PostgreSQL / Healthy
Inspector / PostgreSQL / Public Exposure
Inspector / PostgreSQL / Connection Exhaustion
Inspector / PostgreSQL / Slow Query
Inspector / PostgreSQL / Primary Failover
Inspector / MySQL / Healthy
```

Fields:

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
```

Metrics:

```text
QPS
CPU
Connections
Replica lag
Slow query %
p99 latency
Disk used
```

Diagnostics:

```text
Critical: data store exposed publicly
Suggestion: no cache in front of database
```

Interview prompts:

```text
Read replicas vs sharding - when do you reach for each?
How do you scale writes past one primary?
What breaks first when connections spike?
```

## Selected Edge Inspector

Create frame:

```text
Inspector / Edge / gRPC
```

Fields:

```text
Protocol: HTTP, HTTPS, gRPC, Kafka, Redis, MySQL, Postgres, TCP, UDP, Websocket
Serializer: JSON, Protobuf, Avro, MessagePack
Throughput badge
TLS
Compression
Retries
Timeout
Circuit breaker
Connection pool
Bidirectional mode
```

Show edge impact:

```text
Estimated throughput
Estimated p99 contribution
Retry amplification risk
Serialization overhead
TLS termination notes
```

## Page: Simulation + Diagnostics

### Scenario Injection Menu

Create frame:

```text
Simulation / Injection Menu
```

Menu items:

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

### Traffic x1000 State

Create frame:

```text
Simulation / Traffic x1000
```

State changes:

```text
Traffic badge active in toolbar
Load label: x1000
Overloaded nodes highlighted orange
Animated/high-throughput edges
Higher p99 latency
Higher monthly cost
Lower architecture health score
Warnings increase
Scenario timeline entry: Traffic x1000 spike
```

### Broken Dependency States

Create frames:

```text
Simulation / Redis Down
Simulation / Kafka Down
Simulation / DB Outage
```

State changes:

```text
Broken node red
Broken and downstream edges dashed red
Downstream services affected with muted red glow
Diagnostics drawer open
Architecture score lower
Right inspector shows selected component failure modes
```

### Constraint Cards

Show these as removable chips/cards:

```text
Users: 1M -> 100M
Latency: 500ms -> 50ms
Must support multi-region
Switch to strong consistency
GDPR data residency
Add offline support
Cut infra cost 40%
```

### Diagnostics Drawer

Create frame:

```text
Diagnostics / Problems Open
```

Use VS Code Problems behavior:

```text
Critical group
Warning group
Suggestion group
Issue title
Affected node
Why it matters
Production impact
Recommended fix
Click target to select affected node
```

Required diagnostic examples:

```text
Critical - Redis has no replica - Redis - Its failure drops cache reads and pushes traffic to the database - Enable Cluster/Sentinel with at least 1 replica and Multi-AZ
Critical - Kafka replication factor < 2 - Kafka - A broker failure can lose partitions - Set replication factor >= 3 and min.insync.replicas = 2
Warning - Weak DynamoDB partition key - DynamoDB - Skewed keys create hot partitions and throttling - Choose high-cardinality key or add sharding suffix
Warning - Load balancer points to one backend - Load Balancer - Backend is a SPOF - Add at least 2 backends across AZs
Critical - PostgreSQL exposed publicly - PostgreSQL - Direct internet reachability is a major attack surface - Move data store to private subnet
Critical - API Gateway has no authentication - API Gateway - Unauthenticated access to internal services - Add authN and authZ at the edge
```

## Page: AI Hints

This can live as a frame on `Workspace` or `Simulation + Diagnostics`.

Create the assistant as a compact panel:

```text
Potential SPOF: Redis cache has no replica.
Missing component: No rate limiter sits between the gateway and services.
Bottleneck: Cassandra write path may saturate near 40K W/s without batching.
Scaling hint: Consider fan-out-on-write for non-celebrity users, pull for the rest.
Follow-up: Ask how the candidate handles celebrity fan-out.
```

Rules:

```text
Do not show a full generated architecture.
Do not give final answer text to the candidate.
Do not auto-place components.
Do not auto-fix diagnostics.
Frame as interviewer hints and critique.
```

## Page: Review Mode

Create frame:

```text
Review / Summary
```

Top bar:

```text
Back to canvas
Review mode badge
Question title
Candidate name
Elapsed time
Submit evaluation button
```

Frozen architecture summary:

```text
Frozen label
Components count
Connections count
Data stores count
Caches count
Queues count
Load balancers count
Placed component chips
Architecture health score
```

Generated observations:

```text
Potential SPOFs
Missing observability
Database/cache bottlenecks
Security gaps
Scaling tradeoffs
```

Manual scorecard:

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

Final evaluation:

```text
Event timeline
Summary notes
Final feedback
Advance decision
No-hire decision
Submit evaluation button
Submitted state
```

## Page: Mobile Viewer

Create frame:

```text
Mobile / Viewer: 390x844
```

V1 mobile is read-only.

Include:

```text
Question summary
Read-only architecture preview
Health score
Critical/warning/suggestion counts
Scenario timeline
Review status
Compact component detail bottom sheet
```

Do not include:

```text
Drag-and-drop editing
Full inspector editing
Scenario authoring
Scorecard editing
```

Text must not overlap or clip at `390x844`.

## Prototype Flow

Wire these interactions:

```text
Dashboard / Home / 1440 -> question card -> Workspace / Default / 1440
Dashboard / Home / 1440 -> Create interview -> Dashboard / Create Interview / Setup
Dashboard / Create Interview / Setup -> Generate candidate link -> Dashboard / Create Interview / Link Generated
Dashboard / Create Interview / Link Generated -> Open workspace -> Workspace / Default / 1440
Workspace / Default / 1440 -> drag Redis -> Workspace / Selected Redis / Healthy
Workspace / Selected Redis / Healthy -> set Standalone/no replicas -> Workspace / Selected Redis / SPOF
Workspace / Selected Redis / SPOF -> open diagnostics -> Diagnostics / Problems Open
Diagnostics / Problems Open -> Redis issue -> Workspace / Selected Redis / SPOF
Diagnostics / Problems Open -> Kafka issue -> Workspace / Selected Kafka / RF1
Workspace / Default / 1440 -> Inject traffic x1000 -> Simulation / Traffic x1000
Workspace / Default / 1440 -> Redis down -> Simulation / Redis Down
Workspace / Default / 1440 -> Kafka down -> Simulation / Kafka Down
Workspace / Default / 1440 -> DB outage -> Simulation / DB Outage
Workspace / Default / 1440 -> Finish & review -> Review / Summary
Review / Summary -> Back to canvas -> Workspace / Default / 1440
Review / Summary -> Submit evaluation -> Review / Submitted
```

## Required Frame Inventory

Create these named frames at minimum:

```text
Dashboard / Home / 1440
Dashboard / Create Interview / Setup
Dashboard / Create Interview / Link Generated
Workspace / Default / 1440
Workspace / Default / 1366
Workspace / Default / 1920
Workspace / Selected Redis / Healthy
Workspace / Selected Redis / SPOF
Workspace / Selected Kafka / RF1
Workspace / Selected Edge / gRPC
Simulation / Injection Menu
Simulation / Traffic x1000
Simulation / Redis Down
Simulation / Kafka Down
Simulation / DB Outage
Diagnostics / Problems Open
Review / Summary
Review / Submitted
Mobile / Viewer
Component Library / Nodes
Component Library / Edges
Component Library / Inspector Controls
Foundations / Tokens
```

## Acceptance Checklist

The Figma output is acceptable only if:

```text
Desktop frames exist at 1440x900, 1366x768, and 1920x1080.
Mobile viewer exists at 390x844.
Toolbar does not clip at 1366px.
Left palette, canvas, right inspector, and bottom status bar match the fixed shell.
Redis, DynamoDB, Kafka, Load Balancer, API Service, and PostgreSQL/MySQL each have realistic fields, metrics, diagnostics, failure states, and cost states.
Diagnostics demonstrate Redis SPOF, Kafka RF=1, DynamoDB hot partition, LB single backend, public DB exposure, and API auth missing.
Scenario injection demonstrates traffic x1000, Redis down, Kafka down, and DB outage.
Architecture health shows score, cost, p99, availability, throughput, SPOFs, monitoring, backups, security, and dimension bars.
Review mode supports frozen summary, generated observations, manual scorecard, event timeline, final feedback, and hire/no-hire decision.
AI assistant is hints-only and does not generate a full answer.
The result feels like the current prototype evolved into a serious production architecture simulator.
```

## Suggested Figma Generation Prompt

Use this prompt when sending the work to a Figma-capable model:

```text
Generate a multi-page Figma file for SystemDesign Studio using the attached production generation spec. Preserve the existing dark Linear/Figma-style prototype language. Build an infrastructure CAD workspace for system design interviews, not a landing page. Create the required pages, named frames, component library, inspector variants, simulation states, diagnostics drawer, review mode, mobile viewer, and prototype links. Prioritize the workspace and production-grade component inspectors. Use the exact frame sizes, color tokens, typography, shell dimensions, diagnostic examples, and acceptance checklist from the spec.
```

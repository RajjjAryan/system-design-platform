// SystemDesign Studio — static data: palette, icon glyphs, preset questions, seed canvas.

// --- Icon glyphs (24x24). Each: {d: innerSVG, fill: bool} ---
export const ICONS = {
  monitor:  { d: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' },
  mobile:   { d: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>' },
  cloud:    { d: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18z"/>' },
  globe:    { d: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>' },
  gateway:  { d: '<path d="M8 4H5v16h3M16 4h3v16h-3M12 8v8M9 12h6"/>' },
  lb:       { d: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v3M12 10H5v7M12 10v7M12 10h7v7"/>' },
  cube:     { d: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/><path d="M12 3v18M5 7l7 4 7-4"/>' },
  gear:     { d: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>' },
  clock:    { d: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>' },
  hexagon:  { d: '<path d="M12 3l7 4v8l-7 4-7-4V7z"/><path d="M12 8l3 2v4l-3 2-3-2v-4z"/>' },
  db:       { d: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>' },
  bolt:     { d: '<path d="M13 3L5 13h5l-1 8 8-11h-5z"/>', fill: true },
  search:   { d: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>' },
  bucket:   { d: '<path d="M5 7h14l-1.4 12.1a1 1 0 0 1-1 .9H7.4a1 1 0 0 1-1-.9z"/><path d="M4 7h16"/>' },
  stream:   { d: '<path d="M3 8c4 0 4 8 8 8s4-8 8-8M3 14c4 0 4 3 8 3"/>' },
  queue:    { d: '<rect x="4" y="5" width="16" height="3" rx="1"/><rect x="4" y="10.5" width="16" height="3" rx="1"/><rect x="4" y="16" width="16" height="3" rx="1"/>' },
  shield:   { d: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>' },
  chart:    { d: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V9M16 16v-7"/>' },
  spark:    { d: '<path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z"/>', fill: true },
  bell:     { d: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>' },
  card:     { d: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18"/>' },
  net:      { d: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7.4 7.4L11 16M16.6 7.4L13 16M8 6h8"/>' },
  firewall: { d: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M8 5v5M14 10v5M11 15v4M11 5v5"/>' },
};

// item name -> icon key
export const ITEM_ICON = {
  'Web Client':'monitor','Mobile App':'mobile','CDN':'cloud','Browser':'globe',
  'API Gateway':'gateway','Load Balancer':'lb','Reverse Proxy':'gateway','GraphQL Gateway':'gateway','REST API':'gateway',
  'Service':'cube','Worker':'gear','Cron':'clock','Lambda':'bolt','ECS':'cube','Kubernetes Pod':'hexagon',
  'MySQL':'db','PostgreSQL':'db','Redis':'bolt','DynamoDB':'db','Cassandra':'db','MongoDB':'db','Elasticsearch':'search','S3':'bucket',
  'Kafka':'stream','RabbitMQ':'queue','SQS':'queue','Pub/Sub':'stream',
  'DNS':'globe','Firewall':'firewall','NAT':'net','VPN':'shield',
  'Grafana':'chart','Prometheus':'chart','Logs':'queue','Metrics':'chart','Alerts':'bell',
  'Vector DB':'db','Embedding Service':'spark','LLM':'spark','RAG':'spark','Inference API':'spark',
  'Queue':'queue','Cache':'bolt','Auth':'shield','Notification':'bell','Payment':'card','Search':'search',
};

// palette categories with accent colors
export const PALETTE = [
  { cat:'Frontend',       color:'#38bdf8', items:['Web Client','Mobile App','CDN','Browser'] },
  { cat:'API',            color:'#818cf8', items:['API Gateway','Load Balancer','Reverse Proxy','GraphQL Gateway','REST API'] },
  { cat:'Compute',        color:'#a78bfa', items:['Service','Worker','Cron','Lambda','ECS','Kubernetes Pod'] },
  { cat:'Storage',        color:'#34d399', items:['MySQL','PostgreSQL','Redis','DynamoDB','Cassandra','MongoDB','Elasticsearch','S3'] },
  { cat:'Messaging',      color:'#fbbf24', items:['Kafka','RabbitMQ','SQS','Pub/Sub'] },
  { cat:'Infrastructure', color:'#22d3ee', items:['DNS','CDN','Cache','Firewall','NAT','VPN'] },
  { cat:'Monitoring',     color:'#fb7185', items:['Grafana','Prometheus','Logs','Metrics','Alerts'] },
  { cat:'AI',             color:'#e879f9', items:['Vector DB','Embedding Service','LLM','RAG','Inference API'] },
  { cat:'Other',          color:'#2dd4bf', items:['Queue','Cache','Auth','Notification','Payment','Search'] },
];

// item -> category color lookup
export const ITEM_COLOR = (() => {
  const m = {};
  for (const g of PALETTE) for (const it of g.items) if (!(it in m)) m[it] = g.color;
  return m;
})();

// preset interview questions
export const QUESTIONS = [
  { id:'twitter', title:'Design Twitter', diff:'Hard', topics:['Timelines','Fan-out','Caching'], dur:45,
    tagline:'A social feed at planetary scale.' },
  { id:'whatsapp', title:'Design WhatsApp', diff:'Hard', topics:['Messaging','Presence','E2E'], dur:45, tagline:'Real-time messaging for billions.' },
  { id:'uber', title:'Design Uber', diff:'Hard', topics:['Geo','Matching','Dispatch'], dur:50, tagline:'Match riders and drivers in real time.' },
  { id:'netflix', title:'Design Netflix', diff:'Medium', topics:['CDN','Streaming','Encoding'], dur:45, tagline:'Stream video to millions of screens.' },
  { id:'tinyurl', title:'Design TinyURL', diff:'Easy', topics:['Hashing','KV Store','Redirects'], dur:30, tagline:'A URL shortener warm-up.' },
  { id:'gdocs', title:'Design Google Docs', diff:'Hard', topics:['CRDT','Collab','Sync'], dur:50, tagline:'Concurrent collaborative editing.' },
  { id:'youtube', title:'Design YouTube', diff:'Hard', topics:['Upload','Transcode','CDN'], dur:50, tagline:'Upload, transcode and serve video.' },
  { id:'dropbox', title:'Design Dropbox', diff:'Medium', topics:['Sync','Chunking','Storage'], dur:45, tagline:'File sync and storage.' },
  { id:'instagram', title:'Design Instagram', diff:'Medium', topics:['Feed','Media','Fan-out'], dur:45, tagline:'Photo sharing and feeds.' },
  { id:'search', title:'Design Search', diff:'Hard', topics:['Indexing','Ranking','Crawling'], dur:50, tagline:'Web-scale search & ranking.' },
  { id:'notif', title:'Design Notification Service', diff:'Medium', topics:['Fan-out','Queues','Delivery'], dur:40, tagline:'Multi-channel notifications.' },
  { id:'payment', title:'Design Payment System', diff:'Hard', topics:['Idempotency','Ledger','Consistency'], dur:50, tagline:'Money movement, exactly once.' },
  { id:'delivery', title:'Design Food Delivery', diff:'Medium', topics:['Geo','Orders','Tracking'], dur:45, tagline:'Orders, couriers and live tracking.' },
  { id:'matching', title:'Design Ride Matching', diff:'Medium', topics:['Geo-index','Dispatch','ETA'], dur:40, tagline:'Nearest-driver matching engine.' },
];

// full interviewer specs for every preset question
const QUESTION_DETAILS = {
  twitter: {
    statement: 'Design a Twitter-like service where users post short messages ("tweets") and see a home timeline aggregating tweets from the people they follow.',
    functional: [
      'Users can post a tweet (≤ 280 chars, optional media)',
      'Users can follow / unfollow other users',
      'Home timeline shows recent tweets from followees, newest first',
      'Users can view any user profile timeline',
    ],
    nonFunctional: [
      'Read-heavy: ~100:1 read-to-write ratio',
      'Timeline load p99 < 200 ms',
      'Highly available; eventual consistency acceptable for feeds',
      'Handle celebrity fan-out (10M+ followers)',
    ],
    scale: [
      '300M daily active users',
      '~6,000 tweets/sec average, 15,000/sec peak',
      '~600K timeline reads/sec',
      'Median 200 followees / user',
    ],
    followups: [
      'How do you handle the celebrity fan-out problem?',
      'Push vs pull for timeline generation — where\'s the crossover?',
      'How do you keep the timeline cache warm and consistent?',
    ],
  },
  whatsapp: {
    statement: 'Design WhatsApp-style real-time messaging where users exchange one-to-one and group messages with presence, durable delivery, and end-to-end encryption.',
    functional: [
      'Users can send and receive one-to-one messages',
      'Users can create groups and deliver messages to all members',
      'Clients show online presence, typing state, and delivery/read receipts',
      'Messages sync across a user\'s active devices',
    ],
    nonFunctional: [
      'End-to-end encrypted message payloads',
      'Low latency delivery for online users, durable queueing for offline users',
      'At-least-once delivery with client-side de-duplication',
      'High availability across regions with graceful reconnects',
    ],
    scale: [
      '2B monthly active users',
      '1M+ messages/sec peak globally',
      'Groups up to 1,024 members',
      'Presence fan-out changes far more often than profile data',
    ],
    followups: [
      'How are offline messages stored without breaking E2E encryption?',
      'How do you avoid presence updates becoming a global fan-out bottleneck?',
      'What is the retry and de-duplication strategy after mobile reconnects?',
    ],
  },
  uber: {
    statement: 'Design Uber where riders request trips, nearby drivers are matched in real time, and both sides receive low-latency location, ETA, and trip-state updates.',
    functional: [
      'Riders can request, cancel, and track rides',
      'Drivers can accept or reject dispatches',
      'System matches riders to nearby eligible drivers',
      'Trip state, ETA, fare estimate, and location update live during the ride',
    ],
    nonFunctional: [
      'Dispatch latency under a few seconds in dense cities',
      'Location updates must be fresh but can tolerate short-lived loss',
      'Regional isolation so one city outage does not stop all rides',
      'Strong consistency for payment and final trip state',
    ],
    scale: [
      '10M concurrent riders/drivers during peaks',
      'Millions of location updates per second',
      'Matching radius varies by city density and demand surge',
      'Hot geohashes around airports, events, and commute corridors',
    ],
    followups: [
      'How do you partition the geo index for hot areas?',
      'How does the matching algorithm handle driver rejection and timeout?',
      'Which parts require strong consistency versus eventual consistency?',
    ],
  },
  netflix: {
    statement: 'Design Netflix video streaming where users browse titles and stream adaptive bitrate video globally with high availability and efficient CDN delivery.',
    functional: [
      'Users can browse catalog metadata and recommendations',
      'Users can start, pause, resume, and seek video playback',
      'System serves multiple bitrates and device-specific encodings',
      'Playback position syncs across devices',
    ],
    nonFunctional: [
      'Startup latency and rebuffering must stay low',
      'Video delivery should be CDN-first with origin protection',
      'Catalog and entitlement checks must be highly available',
      'Encoding pipeline can be asynchronous but observable',
    ],
    scale: [
      '250M+ subscribers',
      'Tens of Tbps video traffic during prime time',
      'Large files split into segments for adaptive streaming',
      'Regional catalogs and rights enforcement',
    ],
    followups: [
      'How do you choose what content to pre-position at CDN edges?',
      'What happens when a regional CDN provider degrades?',
      'How are encoding jobs retried and made idempotent?',
    ],
  },
  tinyurl: {
    statement: 'Design TinyURL where users create short aliases for long URLs and visitors are redirected quickly and safely at very high read volume.',
    functional: [
      'Users can create short links for long URLs',
      'Visitors are redirected from short URL to destination URL',
      'Custom aliases and expiration are optionally supported',
      'Abuse detection can disable malicious links',
    ],
    nonFunctional: [
      'Redirect p99 should be very low',
      'Read-heavy workload with cache-friendly data access',
      'Short code generation must avoid collisions',
      'Links should remain durable for years unless expired or blocked',
    ],
    scale: [
      '100M new links per month',
      'Billions of redirects per day',
      'Hot links from social posts can spike suddenly',
      'Global users require edge-friendly caching',
    ],
    followups: [
      'How do you generate collision-free short codes?',
      'Where do you enforce abuse and phishing checks?',
      'How do you invalidate cached redirects after a link is blocked?',
    ],
  },
  gdocs: {
    statement: 'Design Google Docs collaborative editing where multiple users edit a document concurrently, see each other\'s cursors, and recover changes reliably.',
    functional: [
      'Users can create, edit, and share documents',
      'Multiple collaborators can edit concurrently',
      'Clients see live cursors, comments, and version history',
      'Offline edits sync after reconnect',
    ],
    nonFunctional: [
      'Conflict resolution must preserve user intent',
      'Edits should appear to collaborators with low latency',
      'Document state must be durable and recoverable',
      'Access control must be enforced on reads and writes',
    ],
    scale: [
      'Millions of active documents',
      'Dozens of concurrent editors per hot document',
      'Small frequent operations rather than large writes',
      'Long-lived websocket sessions',
    ],
    followups: [
      'Would you use OT or CRDTs, and why?',
      'How do you compact operation logs into snapshots?',
      'How do you handle offline edits that arrive very late?',
    ],
  },
  youtube: {
    statement: 'Design YouTube where creators upload videos, the platform transcodes and moderates them, and viewers stream videos with search, recommendations, and comments.',
    functional: [
      'Creators can upload videos and metadata',
      'System transcodes videos into multiple resolutions',
      'Viewers can search, watch, like, and comment',
      'Creators can see processing status and basic analytics',
    ],
    nonFunctional: [
      'Uploads and transcodes are asynchronous and retryable',
      'Playback should be CDN-backed and globally low latency',
      'Metadata/search can be eventually consistent',
      'Moderation and copyright checks must gate publication',
    ],
    scale: [
      'Hundreds of hours uploaded per minute',
      'Billions of playback sessions per day',
      'Viral videos create extreme hot-object traffic',
      'Large object storage plus derived transcoded renditions',
    ],
    followups: [
      'How do you make video processing idempotent?',
      'How do search and recommendations get updated after upload?',
      'How do you protect origin storage from viral playback spikes?',
    ],
  },
  dropbox: {
    statement: 'Design Dropbox file sync where users upload files, sync changes across devices, share folders, and recover previous versions safely.',
    functional: [
      'Users can upload, download, rename, move, and delete files',
      'Clients sync folder changes across devices',
      'Users can share files and folders with permissions',
      'Version history supports restore after accidental changes',
    ],
    nonFunctional: [
      'File chunks should de-duplicate when possible',
      'Sync must tolerate offline clients and conflicts',
      'Metadata consistency matters more than immediate blob replication',
      'Permissions must be enforced before file download',
    ],
    scale: [
      'Millions of users with billions of files',
      'Large files uploaded in chunks',
      'Many small metadata changes from sync clients',
      'High fan-out for shared team folders',
    ],
    followups: [
      'How do you detect and resolve file conflicts?',
      'How are chunks addressed, stored, and garbage collected?',
      'How do you propagate shared-folder permission changes?',
    ],
  },
  instagram: {
    statement: 'Design Instagram where users upload photos/videos, follow accounts, view feeds and stories, and interact with likes and comments at large scale.',
    functional: [
      'Users can upload media with captions',
      'Home feed shows posts from followed users',
      'Users can like, comment, follow, and view profiles',
      'Stories expire and are visible to permitted viewers',
    ],
    nonFunctional: [
      'Feed reads should be fast and highly available',
      'Media processing can be asynchronous',
      'Hot celebrity accounts require special fan-out handling',
      'Privacy controls must be enforced consistently',
    ],
    scale: [
      '500M+ daily active users',
      'Large image/video objects served via CDN',
      'Read-heavy feed and profile traffic',
      'Burst uploads during events and holidays',
    ],
    followups: [
      'How do you generate feeds for celebrity accounts?',
      'How are media uploads processed before publication?',
      'Where do privacy checks happen in the feed path?',
    ],
  },
  search: {
    statement: 'Design a web search engine that crawls pages, builds an index, ranks documents, and serves low-latency query results with snippets.',
    functional: [
      'Crawler discovers and fetches web pages',
      'Indexer parses, tokenizes, and stores searchable documents',
      'Query service returns ranked results with snippets',
      'System refreshes stale documents and removes deleted pages',
    ],
    nonFunctional: [
      'Query latency must stay low despite a huge corpus',
      'Indexing can be asynchronous but freshness is measurable',
      'Crawler must respect robots.txt and avoid abusive fetch rates',
      'Ranking pipeline should support experimentation',
    ],
    scale: [
      'Tens of billions of pages',
      'Thousands of queries per second per region',
      'Continuous crawl and re-index pipeline',
      'High cache hit rate for popular queries',
    ],
    followups: [
      'How do you partition the inverted index?',
      'How do you balance crawl freshness versus politeness?',
      'Where do ranking features get computed and served?',
    ],
  },
  notif: {
    statement: 'Design a notification service that sends transactional and product notifications over push, email, SMS, and in-app channels with preference controls.',
    functional: [
      'Services can enqueue notifications through an API',
      'Users can configure channel preferences and quiet hours',
      'System sends push, email, SMS, and in-app notifications',
      'Delivery status and failures are tracked per channel',
    ],
    nonFunctional: [
      'Delivery pipeline must absorb bursts and provider outages',
      'Templates and preferences should be evaluated consistently',
      'Retries need backoff, dead-lettering, and idempotency',
      'Critical notifications should have priority lanes',
    ],
    scale: [
      'Hundreds of millions of users',
      'Large fan-out campaigns plus transactional spikes',
      'Multiple external providers with rate limits',
      'Per-user preference checks on every send',
    ],
    followups: [
      'How do you prevent duplicate notifications after retries?',
      'How do you model priority and provider failover?',
      'Where do you enforce user preferences and legal opt-outs?',
    ],
  },
  payment: {
    statement: 'Design a payment system that creates payment intents, authorizes and captures money, records an immutable ledger, and handles retries safely.',
    functional: [
      'Merchants can create and confirm payment intents',
      'System authorizes, captures, refunds, and voids payments',
      'Every money movement is recorded in a ledger',
      'Webhooks notify merchants of state transitions',
    ],
    nonFunctional: [
      'Exactly-once external effects through idempotency keys',
      'Strong consistency for ledger balances and payment state',
      'Provider outages must not corrupt state',
      'Auditability and compliance are first-class requirements',
    ],
    scale: [
      'Thousands of payments/sec at peak',
      'Multiple payment providers and banks',
      'Long-running asynchronous settlement events',
      'Strict reconciliation and dispute workflows',
    ],
    followups: [
      'How do you design idempotency for capture and refund APIs?',
      'What is the ledger schema and consistency boundary?',
      'How do you reconcile provider webhooks with internal state?',
    ],
  },
  delivery: {
    statement: 'Design a food delivery platform where customers place orders, restaurants prepare them, couriers deliver them, and every party sees live status.',
    functional: [
      'Customers can browse restaurants and place orders',
      'Restaurants can accept, prepare, and mark orders ready',
      'Couriers can be assigned and tracked live',
      'Users receive order, ETA, and delivery notifications',
    ],
    nonFunctional: [
      'Order state transitions must be reliable and auditable',
      'Real-time tracking should be fresh but tolerant of mobile loss',
      'Dispatch decisions must adapt to geography and courier supply',
      'Payment and refunds require strong consistency',
    ],
    scale: [
      'City-level traffic spikes around meal times',
      'Large catalog reads plus transactional order writes',
      'Frequent courier GPS updates',
      'Restaurant availability and prep-time changes',
    ],
    followups: [
      'How do you model the order state machine?',
      'How does courier dispatch handle batching and reassignment?',
      'What data is partitioned by city or region?',
    ],
  },
  matching: {
    statement: 'Design a ride matching engine that continuously indexes driver locations and assigns incoming ride requests to the best available driver.',
    functional: [
      'Drivers publish location and availability updates',
      'Riders submit pickup/dropoff ride requests',
      'Engine finds candidate drivers and sends offers',
      'System tracks assignment, timeout, cancellation, and reassignment',
    ],
    nonFunctional: [
      'Matching latency should be under a few seconds',
      'Geo index must handle hot cells without central bottlenecks',
      'Assignments require concurrency control to avoid double-booking',
      'Service should degrade gracefully when location freshness drops',
    ],
    scale: [
      'Millions of active drivers globally',
      'High update rate from mobile GPS streams',
      'Hotspots around airports, venues, and rush-hour zones',
      'Many rejected/expired offers before final assignment',
    ],
    followups: [
      'How do you shard and rebalance the geo index?',
      'How do you prevent assigning one driver to two riders?',
      'Which matching features belong online versus offline?',
    ],
  },
};

export const QUESTION_SPEC = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, QUESTION_DETAILS[question.id]]),
);

// seed architecture placed on the canvas for the Twitter question
export const SEED = {
  comps: [
    { id:'c1', type:'Mobile App',      cat:'Frontend', x:60,  y:150, w:150 },
    { id:'c2', type:'CDN',             cat:'Infrastructure', x:60, y:360, w:150 },
    { id:'c3', type:'API Gateway',     cat:'API',      x:300, y:150, w:150 },
    { id:'c4', type:'Load Balancer',   cat:'API',      x:300, y:340, w:150 },
    { id:'c5', type:'Tweet Service',   base:'Service', cat:'Compute', x:560, y:120, w:160 },
    { id:'c6', type:'Timeline Service',base:'Service', cat:'Compute', x:560, y:330, w:160 },
    { id:'c7', type:'Redis',           cat:'Storage',  x:830, y:120, w:150 },
    { id:'c8', type:'Cassandra',       cat:'Storage',  x:830, y:300, w:150 },
    { id:'c9', type:'Kafka',           cat:'Messaging',x:830, y:470, w:150 },
    { id:'c10',type:'S3',              cat:'Storage',  x:300, y:470, w:150 },
  ],
  edges: [
    { id:'e1', from:'c1', to:'c3', protocol:'HTTP', badge:'120K RPS' },
    { id:'e2', from:'c1', to:'c2', protocol:'HTTP' },
    { id:'e3', from:'c2', to:'c10', protocol:'HTTP' },
    { id:'e4', from:'c3', to:'c4', protocol:'HTTP' },
    { id:'e5', from:'c4', to:'c5', protocol:'gRPC' },
    { id:'e6', from:'c4', to:'c6', protocol:'gRPC' },
    { id:'e7', from:'c5', to:'c8', protocol:'TCP', badge:'40K W/s' },
    { id:'e8', from:'c5', to:'c9', protocol:'Kafka' },
    { id:'e9', from:'c9', to:'c6', protocol:'Kafka' },
    { id:'e10',from:'c6', to:'c7', protocol:'Redis', badge:'2M reads/s' },
    { id:'e11',from:'c6', to:'c8', protocol:'TCP' },
  ],
};

// downstream adjacency for failure propagation (who depends ON a broken node)
export const PROTOCOLS = ['HTTP','gRPC','Kafka','Redis','TCP','Websocket'];

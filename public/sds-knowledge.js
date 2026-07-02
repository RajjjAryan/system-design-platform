// SystemDesign Studio — Knowledge Engine.
// Every component carries production config schema, live metrics, cost model,
// failure modes, and interview knowledge. Schema-driven so the inspector renders generically.

// ---- compact field builders ----
const T=(k,l,def,mono)=>({k,l,t:'text',def:def==null?'':def,mono:mono!==false});
const N=(k,l,def,unit)=>({k,l,t:'num',def,unit:unit||''});
const S=(k,l,opts,def)=>({k,l,t:'sel',opts,def:def==null?opts[0]:def});
const B=(k,l,def)=>({k,l,t:'bool',def:!!def});
const G=(title,fields)=>({title,fields});
const TAB=(id,label,groups)=>({id,label,groups});

// clamp helper for sim
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const money=(n)=>n>=1000?('$'+(n/1000).toFixed(n>=10000?0:1)+'K'):('$'+Math.round(n));

// ================= REDIS =================
const REDIS={
  blurb:'In-memory data store used as a cache or low-latency KV store.',
  tabs:[
    TAB('general','General',[
      G('Cluster',[ T('name','Cluster name','cache-primary',false),
        S('topology','Topology',['Standalone','Sentinel','Cluster'],'Cluster'),
        S('version','Version',['7.2','7.0','6.2']),
        S('memory','Node memory',['4 GB','8 GB','16 GB','32 GB','64 GB'],'16 GB') ]),
      G('Replication',[ N('replicas','Replicas / primary',2), B('multiAz','Multi-AZ',true) ]),
    ]),
    TAB('perf','Performance',[
      G('Memory',[ N('maxmem','Max memory','80','%'),
        S('evict','Eviction policy',['noeviction','allkeys-lru','volatile-lru','allkeys-lfu','volatile-ttl','random']),
        B('lazyfree','Lazy free',true) ]),
    ]),
    TAB('scaling','Scaling',[
      G('Cluster mode',[ B('clusterMode','Cluster mode enabled',true),
        N('shards','Shards',3), N('rf','Replication factor',2),
        B('autoscale','Auto-scaling',false) ]),
    ]),
    TAB('storage','Storage',[
      G('Persistence',[ S('persist','Persistence',['None','RDB','AOF','RDB + AOF'],'RDB'),
        S('snap','Snapshot interval',['off','1 min','5 min','15 min','1 hr'],'5 min') ]),
    ]),
    TAB('net','Networking',[
      G('Access',[ N('port','Port',6379), B('tls','TLS in transit',true),
        S('sg','Security group',['private-subnet','app-tier','public'],'private-subnet') ]),
    ]),
  ],
  failure:[
    {k:'primary',l:'Primary failure',d:'Sentinel/cluster promotes a replica; ~10–30s of write unavailability.'},
    {k:'oom',l:'Out of memory',d:'Eviction policy kicks in or writes are rejected (noeviction).'},
    {k:'partition',l:'Network partition',d:'Split-brain risk; minority side becomes read-only.'},
  ],
  metrics(c,m){
    const hit=cl(96-(m-1)*1.4,55,99);
    const memBase=+String(c.maxmem||80); const mem=cl(memBase*0.6+(m-1)*6,10,100);
    const cpu=cl(22*m,3,100); const ops=Math.round(180000*m);
    const lag=cl((m-1)*4,0,120);
    return [
      {l:'Cache hit ratio',v:hit.toFixed(1),unit:'%',bar:hit/100,warn:hit<80},
      {l:'Memory utilization',v:mem.toFixed(0),unit:'%',bar:mem/100,warn:mem>85},
      {l:'CPU',v:cpu.toFixed(0),unit:'%',bar:cpu/100,warn:cpu>80},
      {l:'Ops / sec',v:(ops/1000).toFixed(0)+'K',bar:cl(ops/1200000,0,1),warn:false},
      {l:'Evictions / sec',v:mem>85?Math.round((mem-85)*900):0,bar:cl((mem-85)/15,0,1),warn:mem>90},
      {l:'Replication lag',v:lag.toFixed(0),unit:'ms',bar:lag/120,warn:lag>50},
      {l:'p99 latency',v:(0.4+(m-1)*0.35).toFixed(1),unit:'ms',bar:cl((0.4+(m-1)*0.35)/8,0,1),warn:false},
    ];
  },
  cost(c,m){ const memGb={'4 GB':4,'8 GB':8,'16 GB':16,'32 GB':32,'64 GB':64}[c.memory||'16 GB']||16;
    const nodes=(+c.shards||3)*((+c.rf||2)); return Math.round(memGb*26*Math.max(1,nodes*0.34)+80*m); },
  tips:{
    pros:['Sub-millisecond reads','Rich data structures (sorted sets, streams)','Cheap horizontal read scaling with replicas'],
    cons:['In-memory — expensive per GB','Durability is best-effort unless AOF everysec','Cluster resharding is operationally heavy'],
    whenUse:['Hot key/value caching in front of a slow store','Rate limiting, leaderboards, sessions','Pub/sub and ephemeral queues'],
    whenNot:['Primary system of record','Datasets far larger than RAM budget','Strong cross-shard transactions'],
    followups:['How do you prevent a cache stampede on a cold key?','Write-through vs write-back vs cache-aside — which and why?','What happens to hit ratio when you 10× traffic?'],
  },
};

// ================= DYNAMODB =================
const DYNAMO={
  blurb:'Fully-managed serverless NoSQL key-value & document store.',
  tabs:[
    TAB('general','General',[
      G('Table',[ T('name','Table name','events',false),
        S('billing','Billing mode',['On-demand','Provisioned']),
        T('pk','Partition key','user_id'), T('sk','Sort key','ts#event_id') ]),
      G('Capacity',[ N('rcu','Read capacity units',4000,'RCU'), N('wcu','Write capacity units',2000,'WCU'),
        B('autoscale','Auto scaling',true) ]),
    ]),
    TAB('scaling','Scaling',[
      G('Partitioning',[ N('itemKb','Avg item size',2,'KB'),
        B('adaptive','Adaptive capacity',true), N('gsi','Global secondary indexes',1), N('lsi','Local secondary indexes',0) ]),
    ]),
    TAB('storage','Storage',[
      G('Features',[ B('ttl','TTL enabled',false), B('streams','Streams',true),
        S('global','Global tables',['Single-region','2 regions','3 regions']) ]),
    ]),
    TAB('security','Security',[
      G('Protection',[ B('encrypt','Encryption at rest',true), B('pitr','Point-in-time recovery',true),
        B('backup','On-demand backups',false) ]),
    ]),
  ],
  failure:[
    {k:'hot',l:'Hot partition',d:'Skewed key concentrates traffic on one partition → throttling despite headroom.'},
    {k:'throttle',l:'Provisioned throttling',d:'Sustained load above RCU/WCU returns ProvisionedThroughputExceeded.'},
  ],
  metrics(c,m){
    const rcu=+c.rcu||4000; const consumed=cl((rcu*0.5*m)/rcu,0,1.4);
    const skew=(c.pk&&/id/.test(c.pk))?0.2:0.6;
    const hot=cl(skew*m*0.5,0,1);
    return [
      {l:'Consumed read capacity',v:(consumed*100).toFixed(0),unit:'%',bar:cl(consumed,0,1),warn:consumed>0.85},
      {l:'Consumed write capacity',v:(cl(m*0.45,0,1.4)*100).toFixed(0),unit:'%',bar:cl(m*0.45,0,1),warn:m*0.45>0.85},
      {l:'Hottest partition',v:(hot*100).toFixed(0),unit:'%',bar:hot,warn:hot>0.7},
      {l:'Throttled requests / s',v:consumed>1?Math.round((consumed-1)*rcu):0,bar:cl(consumed-1,0,1),warn:consumed>1},
      {l:'p99 latency',v:(6+(hot>0.7?18:0)).toFixed(0),unit:'ms',bar:cl((6+(hot>0.7?18:0))/40,0,1),warn:hot>0.7},
      {l:'Est. partition count',v:Math.max(1,Math.round(rcu/3000+(+c.itemKb||2)*0.1)),bar:0.3,warn:false},
    ];
  },
  cost(c,m){ if((c.billing||'On-demand')==='On-demand'){ return Math.round((0.25*(+c.rcu||4000)+1.25*(+c.wcu||2000))*m*0.9+40); }
    return Math.round(((+c.rcu||4000)*0.09+(+c.wcu||2000)*0.47)+30); },
  tips:{
    pros:['Single-digit ms at any scale','No servers to manage; auto-scales','Global tables for multi-region'],
    cons:['Query flexibility limited by key design','Hot partitions punish skewed keys','Cost surprises under bursty writes'],
    whenUse:['High-scale KV / time-series access patterns','Serverless & spiky workloads','Multi-region active-active'],
    whenNot:['Ad-hoc analytical queries / joins','Small apps where RDBMS is simpler','Strong multi-item ACID across partitions'],
    followups:['How do you pick a partition key to avoid hot partitions?','On-demand vs provisioned — where is the cost crossover?','How would you model a many-to-many relationship?'],
  },
};

// ================= KAFKA =================
const KAFKA={
  blurb:'Distributed, partitioned, replicated commit log for event streaming.',
  tabs:[
    TAB('general','General',[
      G('Cluster',[ T('name','Cluster name','events-bus',false),
        N('brokers','Broker count',3), N('rf','Replication factor',3), N('minisr','Min in-sync replicas',2) ]),
    ]),
    TAB('topics','Topics',[
      G('Topic defaults',[ N('partitions','Partitions',24),
        S('retention','Retention',['1 hr','6 hr','24 hr','7 days','30 days'],'7 days'),
        S('cleanup','Cleanup policy',['delete','compact','compact,delete']),
        S('compression','Compression',['none','gzip','snappy','lz4','zstd'],'lz4') ]),
    ]),
    TAB('producer','Producer',[
      G('Delivery',[ S('acks','acks',['0','1','all'],'all'), B('idem','Idempotent producer',true),
        N('batch','Batch size',64,'KB'), N('linger','linger.ms',10,'ms') ]),
    ]),
    TAB('consumer','Consumer',[
      G('Consumption',[ T('group','Consumer group','timeline-fanout'), N('consumers','Consumers',12),
        S('reset','Offset reset',['earliest','latest'],'latest'), B('dlq','Dead-letter queue',false) ]),
    ]),
  ],
  failure:[
    {k:'broker',l:'Broker failure',d:'Partitions with a lost leader trigger election; under-replicated if RF is tight.'},
    {k:'unclean',l:'Under-replicated partitions',d:'ISR shrinks below min.insync.replicas → producer with acks=all blocks.'},
    {k:'lag',l:'Consumer lag blow-up',d:'Consumers fall behind producers; end-to-end latency grows unbounded.'},
  ],
  metrics(c,m){
    const cons=+c.consumers||12; const parts=+c.partitions||24;
    const msg=Math.round(6000*m); const capacity=cons*4000;
    const lag=cl((msg-capacity),0,5000000);
    return [
      {l:'Messages / sec',v:(msg/1000).toFixed(1)+'K',bar:cl(msg/200000,0,1),warn:false},
      {l:'Throughput',v:((msg*1.2)/1000).toFixed(0)+' MB/s',bar:cl(msg/200000,0,1),warn:false},
      {l:'Consumer lag',v:lag>1000?(lag/1000).toFixed(0)+'K':lag.toFixed(0),unit:' msgs',bar:cl(lag/200000,0,1),warn:lag>50000},
      {l:'Partition skew',v:parts<cons?'high':'ok',bar:parts<cons?0.8:0.2,warn:parts<cons},
      {l:'Under-replicated',v:(+c.rf||3)<2?'yes':'0',bar:(+c.rf||3)<2?1:0,warn:(+c.rf||3)<2},
      {l:'End-to-end p99',v:(12+(lag>50000?280:0)).toFixed(0),unit:'ms',bar:cl((12+(lag>50000?280:0))/400,0,1),warn:lag>50000},
    ];
  },
  cost(c,m){ return Math.round((+c.brokers||3)*(210+((+c.rf||3)*40))+ (+c.partitions||24)*1.2 + 60*m); },
  tips:{
    pros:['Durable, replayable event log','Decouples producers from consumers','Scales to millions of msgs/sec'],
    cons:['Operationally complex (ZK/KRaft, rebalancing)','Ordering only within a partition','Consumer lag needs active monitoring'],
    whenUse:['Event-driven architectures & CDC','Fan-out to many independent consumers','Buffering write spikes ahead of a DB'],
    whenNot:['Simple task queues (SQS/RabbitMQ simpler)','Strict global ordering requirements','Tiny low-throughput apps'],
    followups:['How do partitions relate to consumer parallelism?','What does acks=all + min.insync.replicas guarantee?','How do you recover from a broker outage without data loss?'],
  },
};

// ================= LOAD BALANCER =================
const LB={
  blurb:'Distributes traffic across backends with health checking and failover.',
  tabs:[
    TAB('general','General',[
      G('Routing',[ T('name','Name','edge-alb',false),
        S('algo','Algorithm',['Round Robin','Least Connections','Least Response Time','Weighted','IP Hash','Consistent Hash'],'Least Connections'),
        B('sticky','Sticky sessions',false), S('layer','Layer',['L4 (TCP)','L7 (HTTP)'],'L7 (HTTP)') ]),
    ]),
    TAB('health','Resilience',[
      G('Health checks',[ N('hcInterval','HC interval',10,'s'), N('unhealthy','Unhealthy threshold',3) ]),
      G('Reliability',[ B('cb','Circuit breaker',true), N('retries','Retries',2), N('timeout','Timeout',3000,'ms') ]),
    ]),
    TAB('net','Connections',[
      G('Pool',[ N('maxConn','Max connections',100000), N('idle','Idle timeout',60,'s'), B('tls','TLS termination',true) ]),
    ]),
  ],
  failure:[
    {k:'nobackend',l:'All backends unhealthy',d:'LB returns 503; no capacity to route to.'},
    {k:'single',l:'Single backend',d:'No redundancy — the backend is a SPOF behind the LB.'},
  ],
  metrics(c,m){
    const conns=Math.round(24000*m); const max=+c.maxConn||100000;
    return [
      {l:'Active connections',v:(conns/1000).toFixed(0)+'K',bar:cl(conns/max,0,1),warn:conns>max*0.85},
      {l:'Requests / sec',v:(48*m).toFixed(0)+'K',bar:cl(m/8,0,1),warn:false},
      {l:'Healthy backends',v:'—',bar:0.9,warn:false},
      {l:'5xx rate',v:(m>6?((m-6)*0.4).toFixed(1):'0.0'),unit:'%',bar:cl((m-6)/6,0,1),warn:m>6},
      {l:'p95 latency',v:(4+(m-1)*1.1).toFixed(0),unit:'ms',bar:cl((4+(m-1)*1.1)/40,0,1),warn:false},
    ];
  },
  cost(c,m){ return Math.round(22+Math.round((24000*m)/1000)*1.6); },
  tips:{
    pros:['Even load distribution & failover','Health checks eject bad nodes','TLS offload frees backends'],
    cons:['Itself must be redundant (multi-AZ)','L7 inspection adds latency','Sticky sessions hurt even distribution'],
    whenUse:['Any horizontally-scaled service tier','Blue/green & canary deploys','TLS termination at the edge'],
    whenNot:['Single-instance internal tools','When client-side LB / service mesh already handles it'],
    followups:['Least-connections vs round-robin — when does it matter?','How do you avoid the LB being a SPOF?','Where do you put the circuit breaker and why?'],
  },
};

// base registry (extended below)
export const COMPONENTS={ Redis:REDIS, DynamoDB:DYNAMO, Cache:REDIS, Kafka:KAFKA, 'Pub/Sub':KAFKA, 'Load Balancer':LB };

// ================= RELATIONAL (Postgres / MySQL) =================
const SQL=(engine)=>({
  blurb:engine+' relational database with ACID transactions.',
  tabs:[
    TAB('general','General',[
      G('Instance',[ T('name','Name',engine.toLowerCase()+'-primary',false),
        S('class','Instance class',['db.r6g.large','db.r6g.xlarge','db.r6g.2xlarge','db.r6g.4xlarge'],'db.r6g.xlarge'),
        S('version','Version', engine==='PostgreSQL'?['16','15','14']:['8.0','5.7']) ]),
      G('Topology',[ N('replicas','Read replicas',2), B('multiAz','Multi-AZ standby',true), B('failover','Automatic failover',true) ]),
    ]),
    TAB('scaling','Scaling',[
      G('Partitioning',[ B('sharded','Sharded',false), T('shardKey','Shard key','user_id'),
        S('pool','Connection pool',['pgbouncer','proxysql','app-side'], engine==='PostgreSQL'?'pgbouncer':'proxysql'),
        N('poolMax','Max connections',400) ]),
    ]),
    TAB('perf','Performance',[
      G('Query',[ B('qcache','Query cache',false), S('iso','Isolation level',['Read Committed','Repeatable Read','Serializable']),
        B('slowlog','Slow query log',true) ].concat(engine==='PostgreSQL'?[B('autovac','Autovacuum',true)]:[])),
    ]),
    TAB('storage','Storage',[
      G('Disk',[ N('disk','Provisioned disk',500,'GB'), N('iops','Provisioned IOPS',12000),
        B('backup','Automated backups',true), N('backupRet','Backup retention',7,'days') ]),
    ]),
  ],
  failure:[
    {k:'primary',l:'Primary failure',d:'Multi-AZ standby promoted in ~60–120s; single-AZ means an outage.'},
    {k:'conns',l:'Connection exhaustion',d:'Traffic spike opens more connections than the pool allows → errors.'},
    {k:'slow',l:'Slow queries / lock contention',d:'Missing index or long transaction cascades into latency.'},
  ],
  metrics(c,m){
    const poolMax=+c.poolMax||400; const conns=cl(Math.round(120*m),0,poolMax*1.3);
    const cpu=cl(28*m,4,100); const qps=Math.round(9000*m);
    return [
      {l:'QPS',v:(qps/1000).toFixed(1)+'K',bar:cl(qps/120000,0,1),warn:false},
      {l:'CPU',v:cpu.toFixed(0),unit:'%',bar:cpu/100,warn:cpu>80},
      {l:'Connections',v:conns+' / '+poolMax,bar:cl(conns/poolMax,0,1),warn:conns>poolMax*0.85},
      {l:'Replica lag',v:(cl((m-1)*3,0,90)).toFixed(0),unit:'ms',bar:cl((m-1)*3/90,0,1),warn:(m-1)*3>40},
      {l:'Slow query %',v:(cpu>80?((cpu-80)*0.3).toFixed(1):'0.2'),unit:'%',bar:cl((cpu-80)/20,0,1),warn:cpu>85},
      {l:'p99 latency',v:(8+(conns>poolMax*0.85?120:0)).toFixed(0),unit:'ms',bar:cl((8+(conns>poolMax*0.85?120:0))/160,0,1),warn:conns>poolMax*0.85},
      {l:'Disk used',v:(cl(42+(m-1)*3,0,100)).toFixed(0),unit:'%',bar:cl((42+(m-1)*3)/100,0,1),warn:false},
    ];
  },
  cost(c,m){ const base={'db.r6g.large':180,'db.r6g.xlarge':360,'db.r6g.2xlarge':720,'db.r6g.4xlarge':1440}[c.class||'db.r6g.xlarge']||360;
    return Math.round(base*(1+(+c.replicas||2)*0.9)*(c.multiAz?1.9:1)+(+c.disk||500)*0.12); },
  tips:{
    pros:['Strong ACID transactions & joins','Mature tooling and ecosystem','Flexible ad-hoc queries'],
    cons:['Vertical scaling ceiling on writes','Sharding is complex & app-invasive','Failover is not instant'],
    whenUse:['Transactional systems of record','Complex relational queries','Read-heavy with read replicas'],
    whenNot:['Write throughput beyond a single primary','Schemaless / rapidly-changing shapes at scale'],
    followups:['Read replicas vs sharding — when do you reach for each?','How do you scale writes past one primary?','What breaks first when connections spike?'],
  },
});

// ================= MONGODB =================
const MONGO={ blurb:'Document database with replica sets and sharding.',
  tabs:[
    TAB('general','General',[ G('Replica set',[ T('name','Name','app-rs',false), N('members','Members',3),
      S('read','Read preference',['primary','primaryPreferred','secondary','nearest']),
      S('write','Write concern',['1','majority','all'],'majority'), B('journal','Journaling',true) ]) ]),
    TAB('scaling','Scaling',[ G('Sharding',[ B('sharded','Sharded cluster',true), T('shardKey','Shard key','user_id'),
      N('shards','Shards',4), N('chunk','Chunk size',64,'MB'), B('balancer','Balancer',true) ]) ]),
  ],
  failure:[{k:'primary',l:'Primary step-down',d:'Election picks a new primary; brief write unavailability.'},
    {k:'jumbo',l:'Jumbo chunk / bad shard key',d:'Unsplittable chunk concentrates load on one shard.'}],
  metrics(c,m){ const cpu=cl(26*m,4,100); return [
    {l:'Ops / sec',v:(14*m).toFixed(0)+'K',bar:cl(m/10,0,1),warn:false},
    {l:'CPU',v:cpu.toFixed(0),unit:'%',bar:cpu/100,warn:cpu>80},
    {l:'Replication lag',v:((m-1)*4).toFixed(0),unit:'ms',bar:cl((m-1)*4/100,0,1),warn:(m-1)*4>50},
    {l:'Shard balance',v:c.sharded?'even':'n/a',bar:c.sharded?0.25:0,warn:false},
    {l:'p99 latency',v:(9+(m-1)*2).toFixed(0),unit:'ms',bar:cl((9+(m-1)*2)/80,0,1),warn:false} ]; },
  cost(c,m){ return Math.round((+c.shards||4)*(c.sharded?260:0)+(+c.members||3)*140+40*m); },
  tips:{pros:['Flexible document model','Built-in sharding & replica sets','Fast iteration on schema'],
    cons:['Shard-key choice is hard to change','Multi-document transactions costlier','Memory-hungry working set'],
    whenUse:['Document/aggregate access patterns','Rapidly evolving schemas','Geo & catalog data'],
    whenNot:['Heavy relational joins','Strict cross-shard ACID'],
    followups:['How do you choose a shard key?','What is a jumbo chunk and how do you avoid it?']},
};

// ================= ELASTICSEARCH =================
const ES={ blurb:'Distributed search & analytics engine on inverted indexes.',
  tabs:[
    TAB('general','General',[ G('Cluster',[ T('name','Name','search',false), N('nodes','Data nodes',3),
      N('shards','Primary shards',6), N('replicas','Replicas',1), N('heap','Heap / node',16,'GB') ]) ]),
    TAB('perf','Performance',[ G('Indexing',[ S('refresh','Refresh interval',['1s','5s','30s','off'],'5s'),
      S('ilm','Index lifecycle',['none','Hot-Warm','Hot-Warm-Cold'],'Hot-Warm-Cold') ]) ]),
  ],
  failure:[{k:'red',l:'Red cluster',d:'Primary shard unassigned; part of the index is unqueryable.'},
    {k:'heap',l:'Heap pressure / GC',d:'Old-gen GC pauses spike query latency.'}],
  metrics(c,m){ const heap=cl(58+(m-1)*7,20,100); return [
    {l:'Query latency p99',v:(24+(m-1)*9).toFixed(0),unit:'ms',bar:cl((24+(m-1)*9)/200,0,1),warn:(m-1)*9>120},
    {l:'Indexing rate',v:(8*m).toFixed(0)+'K/s',bar:cl(m/8,0,1),warn:false},
    {l:'Heap used',v:heap.toFixed(0),unit:'%',bar:heap/100,warn:heap>85},
    {l:'Index size',v:'1.8 TB',bar:0.4,warn:false},
    {l:'Unassigned shards',v:(+c.replicas||1)<1?'>0':'0',bar:(+c.replicas||1)<1?1:0,warn:(+c.replicas||1)<1} ]; },
  cost(c,m){ return Math.round((+c.nodes||3)*((+c.heap||16)*18)+40*m); },
  tips:{pros:['Powerful full-text & aggregations','Near-real-time search','Horizontal shard scaling'],
    cons:['Not a source of truth','Heap tuning & GC sensitive','Reindexing is expensive'],
    whenUse:['Search, log analytics, observability','Faceted / relevance-ranked queries'],
    whenNot:['Primary transactional store','Simple exact-match lookups (use KV)'],
    followups:['How many shards and why?','How do you keep ES in sync with the source DB?']},
};

// ================= API SERVICE =================
const API={ blurb:'Stateless application service handling business logic.',
  tabs:[
    TAB('general','General',[ G('Runtime',[ T('name','Service name','tweet-service',false),
      S('lang','Language / runtime',['Go','Java (JVM)','Node.js','Python','Rust'],'Go'),
      S('framework','Framework',['gRPC','Spring Boot','Express','FastAPI','Actix'],'gRPC') ]),
      G('Container',[ S('cpu','CPU request',['0.5 vCPU','1 vCPU','2 vCPU','4 vCPU'],'2 vCPU'),
        S('mem','Memory',['512 MB','1 GB','2 GB','4 GB'],'2 GB'), N('replicas','Replicas',6) ]) ]),
    TAB('perf','Performance',[ G('Concurrency',[ N('pool','Worker/thread pool',256), N('timeout','Timeout',3000,'ms'),
      B('cb','Circuit breaker',true), B('retry','Retry policy',true), B('rl','Rate limiter',false) ]) ]),
    TAB('security','Security',[ G('Access',[ B('auth','Authentication',false), B('mtls','mTLS',false),
      S('authz','Authorization',['none','RBAC','ABAC'],'none') ]) ]),
  ],
  failure:[{k:'crash',l:'Pod crash / CrashLoopBackoff',d:'Replicas drop; remaining pods absorb load or saturate.'},
    {k:'sat',l:'CPU saturation',d:'Latency climbs as the worker pool queues under load.'},
    {k:'retrystorm',l:'Retry storm',d:'Retries without backoff amplify load on a struggling dependency.'}],
  metrics(c,m){ const reps=+c.replicas||6; const cpu=cl((30*m)/Math.max(1,reps/6),4,100);
    const err=m>reps?((m-reps)*0.6):0.1; return [
    {l:'QPS',v:(20*m).toFixed(0)+'K',bar:cl(m/10,0,1),warn:false},
    {l:'CPU / pod',v:cpu.toFixed(0),unit:'%',bar:cpu/100,warn:cpu>80},
    {l:'p95 latency',v:(18+(cpu>80?90:0)).toFixed(0),unit:'ms',bar:cl((18+(cpu>80?90:0))/160,0,1),warn:cpu>80},
    {l:'p99 latency',v:(34+(cpu>80?180:0)).toFixed(0),unit:'ms',bar:cl((34+(cpu>80?180:0))/300,0,1),warn:cpu>80},
    {l:'Error rate',v:err.toFixed(1),unit:'%',bar:cl(err/10,0,1),warn:err>1},
    {l:'Open connections',v:Math.round(1400*m),bar:cl(m/12,0,1),warn:false} ]; },
  cost(c,m){ const cpu={'0.5 vCPU':18,'1 vCPU':34,'2 vCPU':66,'4 vCPU':128}[c.cpu||'2 vCPU']||66; return Math.round(cpu*(+c.replicas||6)+20*m); },
  tips:{pros:['Stateless → scales horizontally','Independent deploys','Fault isolation per service'],
    cons:['Network hops add latency','Distributed failure modes','Needs backpressure & timeouts'],
    whenUse:['Clear bounded contexts','Independent scaling of hot paths'],
    whenNot:['Tiny apps (monolith is simpler)','When team can\'t own operational overhead'],
    followups:['Where do circuit breakers and timeouts belong?','How do you prevent a retry storm?','How do you size the worker pool?']},
};

// ================= KUBERNETES POD =================
const K8S={ blurb:'Kubernetes workload with autoscaling and scheduling policy.',
  tabs:[
    TAB('general','General',[ G('Workload',[ T('name','Deployment','api',false), N('replicas','Replicas',6),
      S('cpu','CPU request',['250m','500m','1','2'],'1'), S('mem','Memory',['512Mi','1Gi','2Gi','4Gi'],'2Gi') ]) ]),
    TAB('scaling','Scaling',[ G('Autoscaling',[ B('hpa','HPA',true), N('hpaMin','Min replicas',3), N('hpaMax','Max replicas',30),
      N('hpaCpu','Target CPU',70,'%'), B('vpa','VPA',false) ]),
      G('Scheduling',[ B('anti','Pod anti-affinity',true), T('taints','Tolerations','spot=true') ]) ]),
    TAB('deploy','Deployment',[ G('Rollout',[ S('strategy','Strategy',['RollingUpdate','Recreate','Canary','Blue/Green'],'RollingUpdate'),
      B('probes','Liveness/readiness probes',true), B('pdb','PodDisruptionBudget',false) ]) ]),
  ],
  failure:[{k:'clbo',l:'CrashLoopBackoff',d:'Failing probes restart pods repeatedly; capacity drops.'},
    {k:'evict',l:'Node eviction / spot reclaim',d:'Pods rescheduled; anti-affinity & PDB decide the blast radius.'},
    {k:'noscale',l:'HPA maxed out',d:'At max replicas, extra load has nowhere to go.'}],
  metrics(c,m){ const reps=cl(Math.round((+c.hpaMin||3)*m),(+c.hpaMin||3),(+c.hpaMax||30));
    const cpu=cl((70*m)/(reps/(+c.hpaMin||3)),5,100); return [
    {l:'Running replicas',v:reps+' / '+(+c.hpaMax||30),bar:cl(reps/(+c.hpaMax||30),0,1),warn:reps>=(+c.hpaMax||30)},
    {l:'CPU / pod',v:cpu.toFixed(0),unit:'%',bar:cpu/100,warn:cpu>85},
    {l:'HPA target',v:(+c.hpaCpu||70)+'%',bar:(+c.hpaCpu||70)/100,warn:false},
    {l:'Pending pods',v:reps>=(+c.hpaMax||30)&&cpu>85?'>0':'0',bar:reps>=(+c.hpaMax||30)?1:0,warn:reps>=(+c.hpaMax||30)&&cpu>85},
    {l:'Restart count',v:'0',bar:0,warn:false} ]; },
  cost(c,m){ const cpu={'250m':10,'500m':20,'1':40,'2':80}[c.cpu||'1']||40; const reps=cl(Math.round((+c.hpaMin||3)*m),(+c.hpaMin||3),(+c.hpaMax||30)); return Math.round(cpu*reps+30); },
  tips:{pros:['Declarative autoscaling & self-healing','Portable across clouds','Rich rollout strategies'],
    cons:['High operational complexity','Easy to misconfigure requests/limits','Noisy-neighbor & scheduling pitfalls'],
    whenUse:['Many services needing consistent orchestration','Autoscaling & bin-packing'],
    whenNot:['One or two simple services (use a PaaS)'],
    followups:['How does HPA decide when to scale?','What limits blast radius when a node dies?','requests vs limits — what happens if you get them wrong?']},
};

// ================= ECS =================
const ECS={ blurb:'AWS container orchestration with task definitions and services.',
  tabs:[
    TAB('general','General',[ G('Service',[ T('name','Service','api-svc',false), N('desired','Desired count',6),
      S('cpu','Task CPU',['256','512','1024','2048'],'1024'), S('mem','Task memory',['512','1024','2048','4096'],'2048'),
      S('provider','Capacity provider',['Fargate','Fargate Spot','EC2'],'Fargate') ]) ]),
    TAB('scaling','Scaling',[ G('Auto scaling',[ B('as','Target tracking',true), N('min','Min tasks',3), N('max','Max tasks',30),
      S('deploy','Deployment',['Rolling','Blue/Green','Canary'],'Rolling') ]) ]),
  ],
  failure:[{k:'task',l:'Task failure',d:'Unhealthy tasks drained from the target group and replaced.'},
    {k:'cap',l:'No capacity',d:'Spot reclaim or account limits block new tasks.'}],
  metrics(c,m){ const tasks=cl(Math.round((+c.min||3)*m),(+c.min||3),(+c.max||30)); return [
    {l:'Running tasks',v:tasks+' / '+(+c.max||30),bar:cl(tasks/(+c.max||30),0,1),warn:tasks>=(+c.max||30)},
    {l:'CPU utilization',v:(cl(60*m/(tasks/(+c.min||3)),5,100)).toFixed(0),unit:'%',bar:cl(60*m/100,0,1),warn:60*m/(tasks/(+c.min||3))>85},
    {l:'p95 latency',v:(20+(m-1)*6).toFixed(0),unit:'ms',bar:cl((20+(m-1)*6)/160,0,1),warn:false} ]; },
  cost(c,m){ const cpu={'256':12,'512':24,'1024':48,'2048':96}[c.cpu||'1024']||48; const tasks=cl(Math.round((+c.min||3)*m),(+c.min||3),(+c.max||30)); return Math.round(cpu*tasks*(c.provider==='Fargate Spot'?0.4:1)+20); },
  tips:{pros:['Simpler than K8s on AWS','Fargate = no node management','Tight ALB / IAM integration'],
    cons:['AWS-only','Less flexible than Kubernetes','Fargate cold-ish scaling'],
    whenUse:['AWS-native container workloads','Teams wanting less ops than EKS'],
    whenNot:['Multi-cloud portability required'],
    followups:['Fargate vs EC2 launch type — tradeoffs?','How does target tracking scaling work?']},
};

Object.assign(COMPONENTS,{
  PostgreSQL:SQL('PostgreSQL'), MySQL:SQL('MySQL'), Cassandra:SQL('Cassandra'),
  MongoDB:MONGO, Elasticsearch:ES,
  Service:API, Worker:API, Lambda:API, 'REST API':API, 'GraphQL Gateway':API, 'API Gateway':API, 'Reverse Proxy':LB,
  'Kubernetes Pod':K8S, ECS:ECS, RabbitMQ:KAFKA, SQS:KAFKA, Queue:KAFKA,
});

// ================= GENERIC FALLBACK =================
export const GENERIC={
  blurb:'Infrastructure component.',
  tabs:[
    TAB('general','General',[ G('Basics',[ T('name','Name','',false),
      T('region','Region','us-east-1'), S('tier','Network tier',['public','app-tier','private-subnet'],'app-tier') ]) ]),
    TAB('perf','Performance',[ G('Throughput',[ T('qps','QPS','—'), T('latency','p99 latency','—') ]) ]),
  ],
  failure:[{k:'down',l:'Component failure',d:'This node becomes unavailable; downstream dependents are affected.'}],
  metrics(c,m){ return [
    {l:'Requests / sec',v:(10*m).toFixed(0)+'K',bar:cl(m/10,0,1),warn:false},
    {l:'CPU',v:(cl(25*m,4,100)).toFixed(0),unit:'%',bar:cl(25*m/100,0,1),warn:25*m>80},
    {l:'p99 latency',v:(12+(m-1)*4).toFixed(0),unit:'ms',bar:cl((12+(m-1)*4)/120,0,1),warn:false} ]; },
  cost(c,m){ return Math.round(60*m); },
  tips:{pros:['—'],cons:['—'],whenUse:['—'],whenNot:['—'],followups:['What are the failure modes of this component?']},
};

// ---- resolve spec for a node ----
export function specFor(node){
  return COMPONENTS[node.type] || COMPONENTS[node.base] || GENERIC;
}
// flatten default config for a spec
export function defaultsFor(spec){
  const o={}; spec.tabs.forEach(t=>t.groups.forEach(g=>g.fields.forEach(f=>{ o[f.k]=f.def; }))); return o;
}
// merge stored props over defaults
export function cfgOf(node){
  const spec=specFor(node); const d=defaultsFor(spec); return {...d, ...(node.props||{})};
}

// ================= EDGE SCHEMA =================
export const EDGE_PROTOCOLS=['HTTP','HTTPS','gRPC','Kafka','Redis','MySQL','Postgres','TCP','UDP','Websocket'];
export const EDGE_SERIALIZERS=['JSON','Protobuf','Avro','MessagePack'];

// ================= LIVE VALIDATION =================
// ctx: { comps, edges, byId, adjOut(id)->[ids], adjIn(id)->[ids] }
export function runValidation(ctx){
  const {comps,edges}=ctx; const out=[]; const byType={}; comps.forEach(c=>{(byType[c.type]=byType[c.type]||[]).push(c);});
  const outCount={}, inCount={}; edges.forEach(e=>{outCount[e.from]=(outCount[e.from]||0)+1; inCount[e.to]=(inCount[e.to]||0)+1;});
  const has=(t)=>comps.some(c=>c.type===t||c.base===t);
  const add=(sev,node,title,why,impact,fix)=>out.push({sev,nodeId:node&&node.id,node:node&&node.type,title,why,impact,fix});

  comps.forEach(c=>{
    const cfg=cfgOf(c);
    if((c.type==='Redis'||c.type==='Cache')){
      if((+cfg.replicas||0)<1 || cfg.topology==='Standalone')
        add('critical',c,'Redis has no replica','A standalone cache node has no failover.','Its failure drops all cache reads → thundering herd onto the database.','Enable Cluster/Sentinel with ≥1 replica and Multi-AZ.');
      if(cfg.persist==='None')
        add('warn',c,'No Redis persistence','Persistence is disabled.','A restart loses the whole cache → cold-start latency spike.','Enable RDB snapshots or AOF if warm restart matters.');
    }
    if(c.type==='Kafka'||c.type==='Pub/Sub'){
      if((+cfg.rf||1)<2) add('critical',c,'Kafka replication factor < 2','RF=1 keeps a single copy of each partition.','A broker failure permanently loses those partitions.','Set replication factor ≥3 and min.insync.replicas=2.');
      if((+cfg.partitions||1) < (+cfg.consumers||1)) add('warn',c,'Fewer partitions than consumers','Idle consumers can\'t get a partition.','Consumer parallelism is capped by partition count.','Raise partition count to ≥ consumer count.');
    }
    if(c.type==='DynamoDB'){
      if(!cfg.pk || !/[_#]|id/i.test(cfg.pk)) add('warn',c,'Weak DynamoDB partition key','Partition key looks low-cardinality.','Skewed keys create hot partitions and throttling.','Choose a high-cardinality key or add a sharding suffix.');
      if(!cfg.ttl) add('suggest',c,'No TTL configured','Items never expire automatically.','Unbounded table growth and storage cost.','Enable TTL on ephemeral items.');
    }
    if(c.cat==='Storage'){
      const pub=cfg.tier==='public'||cfg.sg==='public';
      if(pub) add('critical',c,c.type+' exposed publicly','Data store sits in a public tier.','Directly reachable from the internet — major attack surface.','Move it to a private subnet; reach it only via the app tier.');
      if((inCount[c.id]||0)>0 && !edges.some(e=>e.to===c.id && (ctx.byId[e.from]&&(/Cache|Redis/.test(ctx.byId[e.from].type)))) && !comps.some(x=>/Cache|Redis/.test(x.type)))
        add('suggest',c,'No cache in front of '+c.type,'Reads hit the database directly.','DB becomes the bottleneck under read-heavy load.','Add a cache (cache-aside) for hot reads.');
    }
    if(c.cat==='Compute'||c.type==='Service'){
      const cfg2=cfgOf(c);
      if(cfg2.retry && !cfg2.cb) add('warn',c,'Retries without a circuit breaker','Retry is on but no breaker.','Retries can amplify load into a retry storm during an incident.','Pair retries (with backoff+jitter) with a circuit breaker.');
      if(c.type==='API Gateway'||c.type==='REST API'){ if(!cfg2.auth) add('critical',c,c.type+' has no authentication','No auth configured on an entrypoint.','Unauthenticated access to internal services.','Add authN + authZ (OAuth/JWT, RBAC) at the edge.'); }
    }
  });

  // topology-level checks
  edges.forEach(e=>{
    const src=ctx.byId[e.from];
    if(src && /Load Balancer/.test(src.type)){
      const targets=edges.filter(x=>x.from===e.from).length;
      if(targets===1) add('warn',src,'Load balancer points to one backend','Only a single backend behind the LB.','No redundancy — the backend is a SPOF.','Add ≥2 backends across AZs.');
    }
  });
  if(!comps.some(c=>c.cat==='Monitoring')) add('suggest',null,'No monitoring stack','No metrics/observability components.','Blind to latency, errors and saturation in production.','Add Prometheus/Grafana + logs + alerts.');
  if(comps.some(c=>c.cat==='Storage') && !comps.some(c=>cfgOf(c).backup)) add('suggest',null,'No backups configured','No component has automated backups.','Data loss risk with no recovery point.','Enable automated backups on stateful stores.');

  const dedup={}; return out.filter(d=>{ const k=(d.nodeId||'')+d.title; if(dedup[k])return false; dedup[k]=1; return true; });
}

// ================= ARCHITECTURE SCORING =================
export function scoreArchitecture(ctx, diags, load){
  const {comps,edges}=ctx; const n=comps.length||1;
  const crit=diags.filter(d=>d.sev==='critical').length;
  const warn=diags.filter(d=>d.sev==='warn').length;
  const has=(f)=>comps.some(f);
  const redundant=comps.filter(c=>{const cfg=cfgOf(c); return (+cfg.replicas>0)||(+cfg.rf>1)||(+cfg.members>1)||cfg.multiAz||(+cfg.hpaMin>1);}).length;
  const cacheN=comps.filter(c=>/Cache|Redis/.test(c.type)).length;
  const lbN=comps.filter(c=>/Load Balancer/.test(c.type)).length;
  const monN=comps.filter(c=>c.cat==='Monitoring').length;
  const secN=comps.filter(c=>cfgOf(c).auth||cfgOf(c).tls||cfgOf(c).encrypt).length;
  const clamp=(v)=>Math.max(1,Math.min(5,Math.round(v*10)/10));
  const base=(good,bad)=>clamp(3+good-bad);
  const dims={
    Scalability:base((lbN>0?0.7:0)+(cacheN>0?0.6:0)+ (comps.some(c=>c.cat==='Messaging')?0.6:0), (load>50?0.8:0)),
    Availability:base((redundant/n)*2.4+(lbN>0?0.4:0), crit*0.8),
    Reliability:base((redundant/n)*2+(comps.some(c=>c.cat==='Messaging')?0.4:0), crit*0.7+warn*0.25),
    Maintainability:base((monN>0?0.8:0)+ (n<14?0.6:0), (n>22?0.8:0)),
    Cost:base(1.2, (comps.filter(c=>/Cluster|Cassandra/.test(cfgOf(c).topology||'')).length)*0.2),
    Security:base(secN/n*3, comps.filter(c=>cfgOf(c).tier==='public'&&c.cat==='Storage').length*1.2),
    Performance:base((cacheN>0?1:0)+(lbN>0?0.5:0), (load>100?1.2:load>20?0.5:0)),
    Observability:clamp(1+monN*1.3),
    'Fault tolerance':base((redundant/n)*2.2, crit*0.9),
    Consistency:base(1.2, comps.filter(c=>cfgOf(c).write==='1').length*0.3),
  };
  const vals=Object.values(dims); const overall=(vals.reduce((a,b)=>a+b,0)/vals.length);
  return {dims,overall:Math.round(overall*10)/10};
}


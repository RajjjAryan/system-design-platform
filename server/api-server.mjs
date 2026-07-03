import { createHash, randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const publicDir = join(rootDir, 'public');

const DEFAULT_PERMISSIONS = {
  allowCandidateEdit: true,
  diagnosticsDuringInterview: true,
  showHealthToCandidate: false,
  allowFailureInjection: true,
  aiHintsInterviewerOnly: true,
  candidateCanViewQuestion: true,
  panelCanViewReview: true,
};

const DEFAULT_SHARE_TTL_HOURS = 24 * 14;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_ARCHITECTURE_BYTES = 256 * 1024;
const DEFAULT_RATE_LIMITS = {
  auth: { limit: 40, windowMs: 60_000 },
  share: { limit: 240, windowMs: 60_000 },
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function requiredString(value, name, min = 1) {
  const out = String(value || '').trim();
  if (out.length < min) {
    const error = new Error(`${name} is required`);
    error.status = 400;
    throw error;
  }
  return out;
}

function clientError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  throw error;
}

function requiredEmail(value, name = 'email', { optional = false } = {}) {
  const email = normalizeEmail(value);
  if (!email) {
    if (optional) return '';
    clientError(400, `${name} is required`);
  }
  if (!EMAIL_PATTERN.test(email)) {
    clientError(400, 'Email address is invalid', { [name]: ['Use a valid email address'] });
  }
  return email;
}

function passwordValidationIssues(value) {
  const password = String(value || '');
  const issues = [];
  if (password.length < 12) issues.push('Use at least 12 characters');
  return issues;
}

function requiredSignupPassword(value) {
  const password = String(value || '');
  const issues = passwordValidationIssues(password);
  if (issues.length) {
    const error = new Error('Password does not meet the requirements');
    error.status = 400;
    error.details = { password: issues };
    throw error;
  }
  return password;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function signToken(payload, secret) {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token, secret) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const payload = parseJson(fromBase64Url(encoded), null);
  if (!payload || (payload.exp && payload.exp < Date.now())) return null;
  return payload;
}

function websocketFrame(payload, opcode = 0x1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  const length = data.length;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, length]), data]);
  }
  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, data]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, data]);
}

function websocketAcceptKey(key) {
  return createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
}

function websocketSend(socket, payload) {
  if (!socket.destroyed && socket.writable) {
    socket.write(websocketFrame(JSON.stringify(payload)));
  }
}

function websocketClose(socket) {
  if (!socket.destroyed) {
    socket.write(websocketFrame(Buffer.alloc(0), 0x8));
    socket.end();
  }
}

function initDb(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      duration INTEGER NOT NULL,
      status TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      architecture_json TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      review_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_interviews_owner ON interviews(owner_user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS share_tokens (
      token_hash TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_share_tokens_interview ON share_tokens(interview_id);
    CREATE TABLE IF NOT EXISTS interview_events (
      id TEXT PRIMARY KEY,
      interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_interview_events_interview ON interview_events(interview_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      revoked_at TEXT NOT NULL
    );
  `);
  const interviewColumns = new Set(db.prepare('PRAGMA table_info(interviews)').all().map((column) => column.name));
  if (!interviewColumns.has('review_json')) {
    db.exec("ALTER TABLE interviews ADD COLUMN review_json TEXT NOT NULL DEFAULT '{}'");
  }
  const shareColumns = new Set(db.prepare('PRAGMA table_info(share_tokens)').all().map((column) => column.name));
  if (!shareColumns.has('revoked_at')) {
    db.exec('ALTER TABLE share_tokens ADD COLUMN revoked_at TEXT');
  }
  return db;
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString('base64url')}`;
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) clientError(413, 'Request body is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    clientError(400, 'Invalid JSON body');
  }
}

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    clientError(400, message);
  }
}

function requiredPayloadString(value, label, max = 160) {
  const out = String(value || '').trim();
  if (!out) clientError(400, 'Architecture payload is invalid', { architecture: [`${label} is required`] });
  if (out.length > max) clientError(400, 'Architecture payload is invalid', { architecture: [`${label} is too long`] });
  return out;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) clientError(400, 'Architecture payload is invalid', { architecture: ['Coordinates must be finite numbers'] });
  return number;
}

function validateArchitecturePayload(value) {
  assertObject(value, 'Architecture payload is invalid');
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_ARCHITECTURE_BYTES) {
    clientError(413, 'Architecture payload is too large');
  }
  if (!Array.isArray(value.comps) || !Array.isArray(value.edges)) {
    clientError(400, 'Architecture payload is invalid', { architecture: ['Components and edges must be arrays'] });
  }
  const comments = Array.isArray(value.comments) ? value.comments : [];
  if (value.comps.length > 250 || value.edges.length > 500 || comments.length > 250) {
    clientError(400, 'Architecture payload is invalid', { architecture: ['Canvas item count exceeds the launch limit'] });
  }
  return {
    comps: value.comps.map((component) => {
      assertObject(component, 'Architecture payload is invalid');
      return {
        ...component,
        id: requiredPayloadString(component.id, 'Component id'),
        type: requiredPayloadString(component.type, 'Component type'),
        cat: requiredPayloadString(component.cat, 'Component category'),
        x: finiteNumber(component.x),
        y: finiteNumber(component.y),
        ...(component.w === undefined ? {} : { w: finiteNumber(component.w, 150) }),
        props: component.props && typeof component.props === 'object' && !Array.isArray(component.props) ? component.props : {},
      };
    }),
    edges: value.edges.map((edge) => {
      assertObject(edge, 'Architecture payload is invalid');
      return {
        ...edge,
        id: requiredPayloadString(edge.id, 'Edge id'),
        from: requiredPayloadString(edge.from, 'Edge source'),
        to: requiredPayloadString(edge.to, 'Edge target'),
        protocol: String(edge.protocol || 'HTTP').slice(0, 80),
      };
    }),
    comments: comments.map((comment) => {
      assertObject(comment, 'Architecture payload is invalid');
      const text = String(comment.text || '');
      if (text.length > 2000) clientError(400, 'Architecture payload is invalid', { architecture: ['Comment text is too long'] });
      return {
        ...comment,
        id: requiredPayloadString(comment.id, 'Comment id'),
        x: finiteNumber(comment.x),
        y: finiteNumber(comment.y),
        text,
      };
    }),
  };
}

function architectureFromBody(body, fallback) {
  if (!Object.prototype.hasOwnProperty.call(body, 'architecture')) return fallback;
  return validateArchitecturePayload(body.architecture);
}

function validateReviewPayload(status, review) {
  if (status !== 'reviewed' || !review) return review || {};
  const feedback = String(review.feedback || '').trim();
  if (feedback.length < 20) {
    clientError(400, 'Review feedback is required', { review: ['Add at least 20 characters of specific feedback'] });
  }
  return { ...review, feedback };
}

function appendEvent(db, interviewId, kind, actorRole, summary, now = new Date().toISOString()) {
  db.prepare('INSERT INTO interview_events (id, interview_id, kind, actor_role, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id('evt'), interviewId, kind, actorRole, summary, now);
}

function eventsForInterview(db, interviewId) {
  if (!db || !interviewId) return [];
  return db.prepare('SELECT kind, actor_role, summary, created_at FROM interview_events WHERE interview_id = ? ORDER BY created_at DESC LIMIT 25')
    .all(interviewId)
    .map((row) => ({
      kind: row.kind,
      role: row.actor_role,
      summary: row.summary,
      createdAt: row.created_at,
    }));
}

function userRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

function interviewRow(row, role = 'interviewer', db = null) {
  if (!row) return null;
  const permissions = { ...DEFAULT_PERMISSIONS, ...parseJson(row.permissions_json, {}) };
  const visibility = visibilityFor(role, permissions);
  const base = {
    id: row.id,
    ownerUserId: role === 'interviewer' ? row.owner_user_id : undefined,
    questionId: row.question_id,
    title: row.title,
    prompt: visibility.canSeeQuestion ? row.prompt : '',
    candidate: {
      name: row.candidate_name,
      email: role === 'interviewer' ? row.candidate_email : '',
    },
    difficulty: row.difficulty,
    duration: row.duration,
    status: row.status,
    permissions: role === 'interviewer' ? permissions : undefined,
    architecture: visibility.canSeeArchitecture ? parseJson(row.architecture_json, null) : null,
    scores: visibility.canSeeScorecard ? parseJson(row.scores_json, {}) : undefined,
    review: visibility.canSeeScorecard ? parseJson(row.review_json, {}) : undefined,
    events: visibility.canSeeArchitecture ? eventsForInterview(db, row.id) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return Object.fromEntries(Object.entries(base).filter(([, value]) => value !== undefined));
}

function visibilityFor(role, permissions) {
  if (role === 'interviewer') {
    return {
      canSeeQuestion: true,
      canSeeArchitecture: true,
      canEditCanvas: true,
      canSeeHealth: true,
      canInjectFailures: Boolean(permissions.allowFailureInjection),
      canSeeAiHints: true,
      canSeeScorecard: true,
      canSubmitReview: true,
    };
  }
  if (role === 'panel') {
    return {
      canSeeQuestion: true,
      canSeeArchitecture: true,
      canEditCanvas: false,
      canSeeHealth: true,
      canInjectFailures: false,
      canSeeAiHints: false,
      canSeeScorecard: Boolean(permissions.panelCanViewReview),
      canSubmitReview: false,
    };
  }
  return {
    canSeeQuestion: Boolean(permissions.candidateCanViewQuestion),
    canSeeArchitecture: true,
    canEditCanvas: Boolean(permissions.allowCandidateEdit),
    canSeeHealth: Boolean(permissions.showHealthToCandidate),
    canInjectFailures: false,
    canSeeAiHints: !permissions.aiHintsInterviewerOnly,
    canSeeScorecard: false,
    canSubmitReview: false,
  };
}

function userFromToken(token, db, tokenSecret) {
  const payload = verifyToken(token, tokenSecret);
  if (!payload?.sub) return null;
  const revoked = db.prepare('SELECT expires_at FROM revoked_tokens WHERE token_hash = ?').get(hashToken(token));
  if (revoked && Date.parse(revoked.expires_at) > Date.now()) return null;
  return userRow(db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub));
}

function cookieToken(req) {
  return Object.fromEntries(String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim().split('=')))
    .sds_token;
}

function requestToken(req) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  return bearer || cookieToken(req) || '';
}

function authUser(req, db, tokenSecret) {
  return userFromToken(requestToken(req), db, tokenSecret);
}

function requireAuth(req, db, tokenSecret) {
  const user = authUser(req, db, tokenSecret);
  if (!user) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }
  return user;
}

function corsHeaders(req, publicOrigin) {
  const origin = req.headers.origin;
  const allowed = new Set([
    publicOrigin.replace(/\/$/, ''),
    'http://127.0.0.1:4173',
    'http://localhost:4173',
  ]);
  if (origin && allowed.has(origin.replace(/\/$/, ''))) {
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      vary: 'origin',
    };
  }
  return {};
}

function shareUrl(publicOrigin, token) {
  const url = new URL(publicOrigin);
  url.search = '';
  url.hash = '';
  url.searchParams.set('share', token);
  return url.toString();
}

function createTokenForUser(user, tokenSecret) {
  return signToken({ sub: user.id, email: user.email, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }, tokenSecret);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function rateLimitGroup(method, path) {
  if (method === 'POST' && (path === '/api/auth/signup' || path === '/api/auth/login')) return 'auth';
  if (path.startsWith('/api/share/')) return 'share';
  return '';
}

function enforceRateLimit(context, req, path) {
  const group = rateLimitGroup(req.method, path);
  if (!group) return;
  const config = context.rateLimits?.[group];
  if (!config?.limit || !config?.windowMs) return;
  const key = `${group}:${clientIp(req)}`;
  const now = Date.now();
  const current = context.rateLimitStore.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + config.windowMs };
  bucket.count += 1;
  context.rateLimitStore.set(key, bucket);
  if (bucket.count > config.limit) {
    const error = new Error('Too many requests. Try again shortly.');
    error.status = 429;
    throw error;
  }
}

function activeShareRow(db, token) {
  return db.prepare(`
    SELECT share_tokens.role, share_tokens.expires_at, share_tokens.revoked_at, interviews.*
    FROM share_tokens
    JOIN interviews ON interviews.id = share_tokens.interview_id
    WHERE share_tokens.token_hash = ?
  `).get(hashToken(token));
}

function isShareInactive(share, now = Date.now()) {
  if (!share) return false;
  return Boolean(share.revoked_at || (share.expires_at && Date.parse(share.expires_at) <= now));
}

function assertActiveShare(share, cors, res) {
  if (!share) {
    json(res, 404, { error: 'Share link not found' }, cors);
    return false;
  }
  if (isShareInactive(share)) {
    json(res, 410, { error: 'Share link expired or revoked' }, cors);
    return false;
  }
  return true;
}

function shareExpiryFromBody(body) {
  const raw = body && Object.prototype.hasOwnProperty.call(body, 'expiresInHours')
    ? Number(body.expiresInHours)
    : DEFAULT_SHARE_TTL_HOURS;
  const hours = Number.isFinite(raw) ? raw : DEFAULT_SHARE_TTL_HOURS;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function assertExpectedVersion(body, row, role, db) {
  if (!body.expectedUpdatedAt) return;
  if (String(body.expectedUpdatedAt) === String(row.updated_at)) return;
  const error = new Error('Interview changed since you loaded it');
  error.status = 409;
  error.current = interviewRow(row, role, db);
  throw error;
}

function resolveTokenSecret(options) {
  if (options.tokenSecret) return options.tokenSecret;
  if (process.env.SDS_TOKEN_SECRET) return process.env.SDS_TOKEN_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SDS_TOKEN_SECRET is required in production');
  }
  return randomBytes(32).toString('base64url');
}

function defaultArchitecture() {
  return { comps: [], edges: [], selectedId: null, selectedEdgeId: null };
}

function defaultScores() {
  return {
    Scalability: 3,
    Availability: 3,
    Reliability: 3,
    Communication: 3,
    Tradeoffs: 3,
    Security: 3,
  };
}

async function routeApi(req, res, context) {
  const { db, tokenSecret, publicOrigin } = context;
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const cors = corsHeaders(req, publicOrigin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  enforceRateLimit(context, req, path);

  if (req.method === 'POST' && path === '/api/auth/signup') {
    const body = await readBody(req);
    const name = requiredString(body.name, 'name');
    const email = requiredEmail(body.email);
    const password = requiredSignupPassword(body.password);
    const now = new Date().toISOString();
    const user = { id: id('usr'), name, email, createdAt: now };
    try {
      db.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(user.id, user.name, user.email, hashPassword(password), now);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        const duplicate = new Error('Email is already registered');
        duplicate.status = 409;
        throw duplicate;
      }
      throw error;
    }
    const token = createTokenForUser(user, tokenSecret);
    json(res, 201, { user, token }, cors);
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/login') {
    const body = await readBody(req);
    const email = requiredEmail(body.email);
    const password = requiredString(body.password, 'password');
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }
    const user = userRow(row);
    const token = createTokenForUser(user, tokenSecret);
    json(res, 200, { user, token }, cors);
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/logout') {
    const token = requestToken(req);
    const payload = verifyToken(token, tokenSecret);
    if (!payload?.sub) {
      const error = new Error('Authentication required');
      error.status = 401;
      throw error;
    }
    const now = new Date().toISOString();
    const expiresAt = new Date(payload.exp || Date.now()).toISOString();
    db.prepare('INSERT OR REPLACE INTO revoked_tokens (token_hash, expires_at, revoked_at) VALUES (?, ?, ?)')
      .run(hashToken(token), expiresAt, now);
    json(res, 200, { revoked: true }, cors);
    return;
  }

  if (req.method === 'GET' && path === '/api/me') {
    const user = requireAuth(req, db, tokenSecret);
    json(res, 200, { user }, cors);
    return;
  }

  if (req.method === 'GET' && path === '/api/interviews') {
    const user = requireAuth(req, db, tokenSecret);
    const rows = db.prepare('SELECT * FROM interviews WHERE owner_user_id = ? ORDER BY updated_at DESC').all(user.id);
    json(res, 200, { interviews: rows.map((row) => interviewRow(row, 'interviewer', db)) }, cors);
    return;
  }

  if (req.method === 'POST' && path === '/api/interviews') {
    const user = requireAuth(req, db, tokenSecret);
    const body = await readBody(req);
    const now = new Date().toISOString();
    const permissions = { ...DEFAULT_PERMISSIONS, ...(body.permissions || {}) };
    const interview = {
      id: id('int'),
      ownerUserId: user.id,
      questionId: requiredString(body.questionId, 'questionId'),
      title: requiredString(body.title, 'title'),
      prompt: requiredString(body.prompt || body.title, 'prompt'),
      candidateName: requiredString(body.candidateName || 'Candidate', 'candidateName'),
      candidateEmail: requiredEmail(body.candidateEmail, 'candidateEmail', { optional: true }),
      difficulty: body.difficulty || 'Medium',
      duration: Number(body.duration || 45),
      status: 'in-progress',
      permissions,
      architecture: architectureFromBody(body, defaultArchitecture()),
      scores: body.scores || defaultScores(),
      createdAt: now,
      updatedAt: now,
    };
    db.prepare(`
      INSERT INTO interviews (
        id, owner_user_id, question_id, title, prompt, candidate_name, candidate_email,
        difficulty, duration, status, permissions_json, architecture_json, scores_json, review_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      interview.id,
      interview.ownerUserId,
      interview.questionId,
      interview.title,
      interview.prompt,
      interview.candidateName,
      interview.candidateEmail,
      interview.difficulty,
      interview.duration,
      interview.status,
      JSON.stringify(interview.permissions),
      JSON.stringify(interview.architecture),
      JSON.stringify(interview.scores),
      JSON.stringify(body.review || {}),
	      interview.createdAt,
	      interview.updatedAt,
	    );
    appendEvent(db, interview.id, 'created', 'interviewer', 'Interview workspace created', now);
    const row = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interview.id);
    json(res, 201, { interview: interviewRow(row, 'interviewer', db) }, cors);
    return;
  }

  const interviewPatch = path.match(/^\/api\/interviews\/([^/]+)$/);
  if (interviewPatch && req.method === 'DELETE') {
    const user = requireAuth(req, db, tokenSecret);
    const interviewId = interviewPatch[1];
    const row = db.prepare('SELECT id FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, user.id);
    if (!row) {
      json(res, 404, { error: 'Interview not found' }, cors);
      return;
    }
    db.prepare('DELETE FROM interviews WHERE id = ? AND owner_user_id = ?').run(interviewId, user.id);
    json(res, 200, { deleted: true, interviewId }, cors);
    return;
  }

  if (interviewPatch && req.method === 'PATCH') {
    const user = requireAuth(req, db, tokenSecret);
    const interviewId = interviewPatch[1];
    const row = db.prepare('SELECT * FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, user.id);
    if (!row) {
      json(res, 404, { error: 'Interview not found' }, cors);
      return;
    }
    const body = await readBody(req);
    assertExpectedVersion(body, row, 'interviewer', db);
    const permissions = { ...parseJson(row.permissions_json, {}), ...(body.permissions || {}) };
    const status = body.status || row.status;
    const review = validateReviewPayload(status, body.review || parseJson(row.review_json, {}));
    const updated = {
      title: body.title || row.title,
      prompt: body.prompt || row.prompt,
      candidateName: body.candidateName || row.candidate_name,
      candidateEmail: requiredEmail(body.candidateEmail ?? row.candidate_email, 'candidateEmail', { optional: true }),
      difficulty: body.difficulty || row.difficulty,
      duration: Number(body.duration || row.duration),
      status,
      permissions,
      architecture: architectureFromBody(body, parseJson(row.architecture_json, defaultArchitecture())),
      scores: body.scores || parseJson(row.scores_json, defaultScores()),
      review,
      updatedAt: new Date().toISOString(),
    };
    db.prepare(`
      UPDATE interviews
      SET title = ?, prompt = ?, candidate_name = ?, candidate_email = ?, difficulty = ?, duration = ?,
          status = ?, permissions_json = ?, architecture_json = ?, scores_json = ?, review_json = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ?
    `).run(
      updated.title,
      updated.prompt,
      updated.candidateName,
      updated.candidateEmail,
      updated.difficulty,
      updated.duration,
      updated.status,
      JSON.stringify(updated.permissions),
      JSON.stringify(updated.architecture),
      JSON.stringify(updated.scores),
      JSON.stringify(updated.review),
      updated.updatedAt,
      interviewId,
      user.id,
	    );
    const next = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
    appendEvent(db, interviewId, updated.status === 'reviewed' ? 'reviewed' : 'updated', 'interviewer', updated.status === 'reviewed' ? 'Final review submitted' : 'Workspace updated', updated.updatedAt);
    context.broadcastInterviewUpdate(interviewId, updated.updatedAt);
    json(res, 200, { interview: interviewRow(next, 'interviewer', db) }, cors);
    return;
  }

  const shareMatch = path.match(/^\/api\/interviews\/([^/]+)\/share$/);
  if (shareMatch && req.method === 'DELETE') {
    const user = requireAuth(req, db, tokenSecret);
    const interviewId = shareMatch[1];
    const row = db.prepare('SELECT * FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, user.id);
    if (!row) {
      json(res, 404, { error: 'Interview not found' }, cors);
      return;
    }
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE share_tokens SET revoked_at = ? WHERE interview_id = ? AND revoked_at IS NULL')
      .run(now, interviewId);
    appendEvent(db, interviewId, 'share.revoked', 'interviewer', 'Active share links revoked', now);
    json(res, 200, { revoked: true, count: result.changes || 0 }, cors);
    return;
  }

  if (shareMatch && req.method === 'POST') {
    const user = requireAuth(req, db, tokenSecret);
    const interviewId = shareMatch[1];
    const row = db.prepare('SELECT * FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, user.id);
    if (!row) {
      json(res, 404, { error: 'Interview not found' }, cors);
      return;
	    }
    const body = await readBody(req);
    const tokens = {};
    const links = {};
    const now = new Date().toISOString();
    const expiresAt = shareExpiryFromBody(body);
    db.prepare('UPDATE share_tokens SET revoked_at = ? WHERE interview_id = ? AND revoked_at IS NULL').run(now, interviewId);
    for (const role of ['candidate', 'interviewer', 'panel']) {
      const token = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO share_tokens (token_hash, interview_id, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(hashToken(token), interviewId, role, user.id, now, expiresAt);
      tokens[role] = token;
      links[role] = shareUrl(publicOrigin, token);
    }
    appendEvent(db, interviewId, 'share.generated', 'interviewer', 'Fresh role-based share links generated', now);
    json(res, 200, { links, tokens, expiresAt }, cors);
    return;
  }

  const shareLookup = path.match(/^\/api\/share\/([^/]+)$/);
  if (shareLookup && (req.method === 'GET' || req.method === 'PATCH')) {
    const token = shareLookup[1];
    const share = activeShareRow(db, token);
    if (!assertActiveShare(share, cors, res)) return;
    const permissions = { ...DEFAULT_PERMISSIONS, ...parseJson(share.permissions_json, {}) };
    const visibility = visibilityFor(share.role, permissions);
    if (req.method === 'PATCH') {
      if (!visibility.canEditCanvas) {
        json(res, 403, { error: 'This role cannot edit the canvas' }, cors);
        return;
	    }
      const body = await readBody(req);
      assertExpectedVersion(body, share, share.role, db);
      const architecture = architectureFromBody(body, parseJson(share.architecture_json, defaultArchitecture()));
      const canUpdateReview = share.role === 'interviewer';
      const status = canUpdateReview && body.status ? body.status : share.status;
      const scores = canUpdateReview && body.scores ? body.scores : parseJson(share.scores_json, defaultScores());
      const review = validateReviewPayload(status, canUpdateReview && body.review ? body.review : parseJson(share.review_json, {}));
      const updatedAt = new Date().toISOString();
      db.prepare('UPDATE interviews SET architecture_json = ?, scores_json = ?, review_json = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(architecture), JSON.stringify(scores), JSON.stringify(review), status, updatedAt, share.id);
      appendEvent(db, share.id, status === 'reviewed' ? 'reviewed' : 'updated', share.role, status === 'reviewed' ? 'Final review submitted from share link' : `Workspace updated by ${share.role}`, updatedAt);
      context.broadcastInterviewUpdate(share.id, updatedAt);
      const next = activeShareRow(db, token);
      json(res, 200, {
        role: next.role,
        visibility,
        interview: interviewRow(next, next.role, db),
      }, cors);
      return;
    }
    json(res, 200, {
      role: share.role,
      visibility,
      interview: interviewRow(share, share.role, db),
    }, cors);
    return;
  }

  json(res, 404, { error: 'Route not found' }, cors);
}

function authorizeWebSocket(req, interviewId, context) {
  const { db, tokenSecret } = context;
  const url = new URL(req.url, 'http://localhost');
  const shareToken = url.searchParams.get('share') || '';
  if (shareToken) {
    const share = db.prepare('SELECT interview_id, role, expires_at, revoked_at FROM share_tokens WHERE token_hash = ?').get(hashToken(shareToken));
    if (share?.interview_id !== interviewId || isShareInactive(share)) return null;
    return { role: share.role, interviewId, userId: `share:${hashToken(shareToken).slice(0, 12)}` };
  }

  const authToken = url.searchParams.get('auth') || cookieToken(req) || '';
  const user = userFromToken(authToken, db, tokenSecret);
  if (!user) return null;
  const row = db.prepare('SELECT id FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, user.id);
  return row ? { role: 'interviewer', interviewId, userId: user.id } : null;
}

function presenceFor(sockets) {
  const presence = { interviewer: 0, candidate: 0, panel: 0 };
  for (const client of sockets || []) {
    if (Object.prototype.hasOwnProperty.call(presence, client.role)) presence[client.role] += 1;
  }
  return presence;
}

function handleWebSocketUpgrade(req, socket, head, context) {
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(/^\/api\/ws\/interviews\/([^/]+)$/);
  const key = req.headers['sec-websocket-key'];
  if (!match || !key || req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  const interviewId = decodeURIComponent(match[1]);
  const auth = authorizeWebSocket(req, interviewId, context);
  if (!auth) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${websocketAcceptKey(key)}`,
    '\r\n',
  ].join('\r\n'));
  if (head?.length) socket.unshift(head);

  let sockets = context.webSockets.get(interviewId);
  if (!sockets) {
    sockets = new Set();
    context.webSockets.set(interviewId, sockets);
  }
  const client = { socket, role: auth.role, userId: auth.userId };
  sockets.add(client);

  websocketSend(socket, { type: 'connected', interviewId, role: auth.role, presence: presenceFor(sockets) });
  context.broadcastPresence(interviewId);

  socket.on('data', (buffer) => {
    const opcode = buffer[0] & 0x0f;
    if (opcode === 0x8) websocketClose(socket);
    if (opcode === 0x9) socket.write(websocketFrame(Buffer.alloc(0), 0x0a));
  });
  const cleanup = () => {
    if (!sockets.delete(client)) return;
    if (!sockets.size) {
      context.webSockets.delete(interviewId);
      return;
    }
    context.broadcastPresence(interviewId);
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = resolve(publicDir, `.${requested}`);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    const fallback = join(publicDir, 'index.html');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(fallback));
    return;
  }
  res.writeHead(200, {
    'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  res.end(readFileSync(filePath));
}

export function createApiServer(options = {}) {
  const db = initDb(options.dbPath || process.env.SDS_DB_PATH || join(rootDir, '.data', 'systemdesign.sqlite'));
  const context = {
    db,
    publicOrigin: options.publicOrigin || process.env.SDS_PUBLIC_ORIGIN || 'http://127.0.0.1:8787/',
    tokenSecret: resolveTokenSecret(options),
    webSockets: new Map(),
    rateLimitStore: new Map(),
    rateLimits: { ...DEFAULT_RATE_LIMITS, ...(options.rateLimits || {}) },
    broadcastInterviewUpdate(interviewId, updatedAt) {
      const sockets = this.webSockets.get(interviewId);
      if (!sockets?.size) return;
      for (const client of sockets) {
        websocketSend(client.socket, { type: 'interview.updated', interviewId, updatedAt });
      }
    },
    broadcastPresence(interviewId) {
      const sockets = this.webSockets.get(interviewId);
      if (!sockets?.size) return;
      const presence = presenceFor(sockets);
      for (const client of sockets) {
        websocketSend(client.socket, { type: 'presence.updated', interviewId, presence });
      }
    },
  };

  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        await routeApi(req, res, context);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        text(res, 405, 'Method not allowed');
        return;
      }
      serveStatic(req, res);
    } catch (error) {
      const status = error.status || 500;
      json(res, status, {
        error: status >= 500 ? 'Internal server error' : error.message,
        ...(status < 500 && error.details ? { details: error.details } : {}),
        ...(status === 409 && error.current ? { current: error.current } : {}),
      }, corsHeaders(req, context.publicOrigin));
    }
  });
  server.on('upgrade', (req, socket, head) => {
    handleWebSocketUpgrade(req, socket, head, context);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  createApiServer().listen(port, () => {
    console.log(`SystemDesign Studio API listening on http://127.0.0.1:${port}`);
  });
}

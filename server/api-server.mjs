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
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_share_tokens_interview ON share_tokens(interview_id);
  `);
  const interviewColumns = new Set(db.prepare('PRAGMA table_info(interviews)').all().map((column) => column.name));
  if (!interviewColumns.has('review_json')) {
    db.exec("ALTER TABLE interviews ADD COLUMN review_json TEXT NOT NULL DEFAULT '{}'");
  }
  return db;
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString('base64url')}`;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
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

function interviewRow(row, role = 'interviewer') {
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

function authUser(req, db, tokenSecret) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const cookieToken = Object.fromEntries(String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim().split('=')))
    .sds_token;
  const payload = verifyToken(bearer || cookieToken, tokenSecret);
  if (!payload?.sub) return null;
  return userRow(db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub));
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

  if (req.method === 'POST' && path === '/api/auth/signup') {
    const body = await readBody(req);
    const name = requiredString(body.name, 'name');
    const email = normalizeEmail(requiredString(body.email, 'email'));
    const password = requiredString(body.password, 'password', 12);
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
    const email = normalizeEmail(requiredString(body.email, 'email'));
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

  if (req.method === 'GET' && path === '/api/me') {
    const user = requireAuth(req, db, tokenSecret);
    json(res, 200, { user }, cors);
    return;
  }

  if (req.method === 'GET' && path === '/api/interviews') {
    const user = requireAuth(req, db, tokenSecret);
    const rows = db.prepare('SELECT * FROM interviews WHERE owner_user_id = ? ORDER BY updated_at DESC').all(user.id);
    json(res, 200, { interviews: rows.map((row) => interviewRow(row, 'interviewer')) }, cors);
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
      candidateEmail: normalizeEmail(body.candidateEmail),
      difficulty: body.difficulty || 'Medium',
      duration: Number(body.duration || 45),
      status: 'in-progress',
      permissions,
      architecture: body.architecture || defaultArchitecture(),
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
    const row = db.prepare('SELECT * FROM interviews WHERE id = ?').get(interview.id);
    json(res, 201, { interview: interviewRow(row, 'interviewer') }, cors);
    return;
  }

  const interviewPatch = path.match(/^\/api\/interviews\/([^/]+)$/);
  if (interviewPatch && req.method === 'PATCH') {
    const user = requireAuth(req, db, tokenSecret);
    const interviewId = interviewPatch[1];
    const row = db.prepare('SELECT * FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, user.id);
    if (!row) {
      json(res, 404, { error: 'Interview not found' }, cors);
      return;
    }
    const body = await readBody(req);
    const permissions = { ...parseJson(row.permissions_json, {}), ...(body.permissions || {}) };
    const updated = {
      title: body.title || row.title,
      prompt: body.prompt || row.prompt,
      candidateName: body.candidateName || row.candidate_name,
      candidateEmail: normalizeEmail(body.candidateEmail ?? row.candidate_email),
      difficulty: body.difficulty || row.difficulty,
      duration: Number(body.duration || row.duration),
      status: body.status || row.status,
      permissions,
      architecture: body.architecture || parseJson(row.architecture_json, defaultArchitecture()),
      scores: body.scores || parseJson(row.scores_json, defaultScores()),
      review: body.review || parseJson(row.review_json, {}),
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
    json(res, 200, { interview: interviewRow(next, 'interviewer') }, cors);
    return;
  }

  const shareMatch = path.match(/^\/api\/interviews\/([^/]+)\/share$/);
  if (shareMatch && req.method === 'POST') {
    const user = requireAuth(req, db, tokenSecret);
    const interviewId = shareMatch[1];
    const row = db.prepare('SELECT * FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, user.id);
    if (!row) {
      json(res, 404, { error: 'Interview not found' }, cors);
      return;
    }
    const tokens = {};
    const links = {};
    const now = new Date().toISOString();
    for (const role of ['candidate', 'interviewer', 'panel']) {
      const token = randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO share_tokens (token_hash, interview_id, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(hashToken(token), interviewId, role, user.id, now, null);
      tokens[role] = token;
      links[role] = shareUrl(publicOrigin, token);
    }
    json(res, 200, { links, tokens }, cors);
    return;
  }

  const shareLookup = path.match(/^\/api\/share\/([^/]+)$/);
  if (shareLookup && (req.method === 'GET' || req.method === 'PATCH')) {
    const token = shareLookup[1];
    const share = db.prepare(`
      SELECT share_tokens.role, interviews.*
      FROM share_tokens
      JOIN interviews ON interviews.id = share_tokens.interview_id
      WHERE share_tokens.token_hash = ?
    `).get(hashToken(token));
    if (!share) {
      json(res, 404, { error: 'Share link not found' }, cors);
      return;
    }
    const permissions = { ...DEFAULT_PERMISSIONS, ...parseJson(share.permissions_json, {}) };
    const visibility = visibilityFor(share.role, permissions);
    if (req.method === 'PATCH') {
      if (!visibility.canEditCanvas) {
        json(res, 403, { error: 'This role cannot edit the canvas' }, cors);
        return;
      }
      const body = await readBody(req);
      const architecture = body.architecture || parseJson(share.architecture_json, defaultArchitecture());
      const canUpdateReview = share.role === 'interviewer';
      const scores = canUpdateReview && body.scores ? body.scores : parseJson(share.scores_json, defaultScores());
      const review = canUpdateReview && body.review ? body.review : parseJson(share.review_json, {});
      const status = canUpdateReview && body.status ? body.status : share.status;
      const updatedAt = new Date().toISOString();
      db.prepare('UPDATE interviews SET architecture_json = ?, scores_json = ?, review_json = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(architecture), JSON.stringify(scores), JSON.stringify(review), status, updatedAt, share.id);
      const next = db.prepare(`
        SELECT share_tokens.role, interviews.*
        FROM share_tokens
        JOIN interviews ON interviews.id = share_tokens.interview_id
        WHERE share_tokens.token_hash = ?
      `).get(hashToken(token));
      json(res, 200, {
        role: next.role,
        visibility,
        interview: interviewRow(next, next.role),
      }, cors);
      return;
    }
    json(res, 200, {
      role: share.role,
      visibility,
      interview: interviewRow(share, share.role),
    }, cors);
    return;
  }

  json(res, 404, { error: 'Route not found' }, cors);
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
  };

  return createServer(async (req, res) => {
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
      json(res, status, { error: status >= 500 ? 'Internal server error' : error.message }, corsHeaders(req, context.publicOrigin));
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  createApiServer().listen(port, () => {
    console.log(`SystemDesign Studio API listening on http://127.0.0.1:${port}`);
  });
}

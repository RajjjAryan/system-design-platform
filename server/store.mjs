import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import pg from 'pg';

const { Pool } = pg;

function sqliteMigrate(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified_at TEXT,
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
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, type);
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
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT,
      role TEXT,
      path TEXT,
      properties_json TEXT NOT NULL,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event, created_at DESC);
  `);
  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
  if (!userColumns.has('email_verified_at')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
  }
  const interviewColumns = new Set(db.prepare('PRAGMA table_info(interviews)').all().map((column) => column.name));
  if (!interviewColumns.has('review_json')) {
    db.exec("ALTER TABLE interviews ADD COLUMN review_json TEXT NOT NULL DEFAULT '{}'");
  }
  const shareColumns = new Set(db.prepare('PRAGMA table_info(share_tokens)').all().map((column) => column.name));
  if (!shareColumns.has('revoked_at')) {
    db.exec('ALTER TABLE share_tokens ADD COLUMN revoked_at TEXT');
  }
}

async function postgresMigrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified_at TEXT,
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
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, type);
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
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT,
      role TEXT,
      path TEXT,
      properties_json TEXT NOT NULL,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event, created_at DESC);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT;
    ALTER TABLE interviews ADD COLUMN IF NOT EXISTS review_json TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS revoked_at TEXT;
  `);
}

function pgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

class SqliteStore {
  constructor(db) {
    this.provider = 'sqlite';
    this.db = db;
  }

  async close() {
    this.db.close?.();
  }

  async healthCheck() {
    this.db.prepare('SELECT 1 AS ok').get();
    return true;
  }

  async getUserById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  async getUserByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  async insertUser(user) {
    this.db.prepare('INSERT INTO users (id, name, email, email_verified_at, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(user.id, user.name, user.email, user.emailVerifiedAt || null, user.passwordHash, user.createdAt);
  }

  async markEmailVerified(userId, verifiedAt) {
    this.db.prepare('UPDATE users SET email_verified_at = ? WHERE id = ?').run(verifiedAt, userId);
  }

  async updatePassword(userId, passwordHash) {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  }

  async getRevokedToken(tokenHash) {
    return this.db.prepare('SELECT expires_at FROM revoked_tokens WHERE token_hash = ?').get(tokenHash);
  }

  async revokeToken(tokenHash, expiresAt, revokedAt) {
    this.db.prepare('INSERT OR REPLACE INTO revoked_tokens (token_hash, expires_at, revoked_at) VALUES (?, ?, ?)')
      .run(tokenHash, expiresAt, revokedAt);
  }

  async insertAuthToken(token) {
    this.db.prepare('INSERT OR REPLACE INTO auth_tokens (token_hash, user_id, type, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(token.tokenHash, token.userId, token.type, token.createdAt, token.expiresAt, token.usedAt || null);
  }

  async getActiveAuthToken(tokenHash, type) {
    return this.db.prepare(`
      SELECT auth_tokens.*, users.*
      FROM auth_tokens
      JOIN users ON users.id = auth_tokens.user_id
      WHERE auth_tokens.token_hash = ? AND auth_tokens.type = ? AND auth_tokens.used_at IS NULL
    `).get(tokenHash, type);
  }

  async useAuthToken(tokenHash, usedAt) {
    this.db.prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?').run(usedAt, tokenHash);
  }

  async listInterviewsByOwner(ownerId) {
    return this.db.prepare('SELECT * FROM interviews WHERE owner_user_id = ? ORDER BY updated_at DESC').all(ownerId);
  }

  async getInterviewForOwner(interviewId, ownerId) {
    return this.db.prepare('SELECT * FROM interviews WHERE id = ? AND owner_user_id = ?').get(interviewId, ownerId);
  }

  async getInterviewById(interviewId) {
    return this.db.prepare('SELECT * FROM interviews WHERE id = ?').get(interviewId);
  }

  async insertInterview(interview, review = {}) {
    this.db.prepare(`
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
      JSON.stringify(review),
      interview.createdAt,
      interview.updatedAt,
    );
  }

  async updateInterviewForOwner(interviewId, ownerId, updated) {
    this.db.prepare(`
      UPDATE interviews
      SET title = ?, prompt = ?, candidate_name = ?, candidate_email = ?, difficulty = ?, duration = ?,
          status = ?, permissions_json = ?, architecture_json = ?, scores_json = ?, review_json = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ?
    `).run(...interviewUpdateParams(updated), interviewId, ownerId);
  }

  async updateSharedInterview(interviewId, updated) {
    this.db.prepare('UPDATE interviews SET architecture_json = ?, scores_json = ?, review_json = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(updated.architecture), JSON.stringify(updated.scores), JSON.stringify(updated.review), updated.status, updated.updatedAt, interviewId);
  }

  async deleteInterviewForOwner(interviewId, ownerId) {
    this.db.prepare('DELETE FROM interviews WHERE id = ? AND owner_user_id = ?').run(interviewId, ownerId);
  }

  async getShareByTokenHash(tokenHash) {
    return this.db.prepare(`
      SELECT share_tokens.role, share_tokens.expires_at, share_tokens.revoked_at, interviews.*
      FROM share_tokens
      JOIN interviews ON interviews.id = share_tokens.interview_id
      WHERE share_tokens.token_hash = ?
    `).get(tokenHash);
  }

  async insertShareToken(token) {
    this.db.prepare('INSERT INTO share_tokens (token_hash, interview_id, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(token.tokenHash, token.interviewId, token.role, token.createdBy, token.createdAt, token.expiresAt);
  }

  async revokeShareTokens(interviewId, revokedAt) {
    const result = this.db.prepare('UPDATE share_tokens SET revoked_at = ? WHERE interview_id = ? AND revoked_at IS NULL')
      .run(revokedAt, interviewId);
    return result.changes || 0;
  }

  async appendEvent(event) {
    this.db.prepare('INSERT INTO interview_events (id, interview_id, kind, actor_role, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(event.id, event.interviewId, event.kind, event.actorRole, event.summary, event.createdAt);
  }

  async listEvents(interviewId) {
    return this.db.prepare('SELECT kind, actor_role, summary, created_at FROM interview_events WHERE interview_id = ? ORDER BY created_at DESC LIMIT 25')
      .all(interviewId);
  }

  async insertAnalyticsEvent(event) {
    this.db.prepare(`
      INSERT INTO analytics_events (id, event, user_id, session_id, role, path, properties_json, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.event,
      event.userId || null,
      event.sessionId || null,
      event.role || null,
      event.path || null,
      JSON.stringify(event.properties || {}),
      event.ipHash || null,
      event.createdAt,
    );
  }
}

class PostgresStore {
  constructor(pool) {
    this.provider = 'postgres';
    this.pool = pool;
  }

  async query(sql, params = []) {
    return this.pool.query(pgSql(sql), params);
  }

  async close() {
    await this.pool.end();
  }

  async healthCheck() {
    await this.query('SELECT 1 AS ok');
    return true;
  }

  async getUserById(id) {
    return (await this.query('SELECT * FROM users WHERE id = ?', [id])).rows[0] || null;
  }

  async getUserByEmail(email) {
    return (await this.query('SELECT * FROM users WHERE email = ?', [email])).rows[0] || null;
  }

  async insertUser(user) {
    await this.query('INSERT INTO users (id, name, email, email_verified_at, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      user.id, user.name, user.email, user.emailVerifiedAt || null, user.passwordHash, user.createdAt,
    ]);
  }

  async markEmailVerified(userId, verifiedAt) {
    await this.query('UPDATE users SET email_verified_at = ? WHERE id = ?', [verifiedAt, userId]);
  }

  async updatePassword(userId, passwordHash) {
    await this.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  }

  async getRevokedToken(tokenHash) {
    return (await this.query('SELECT expires_at FROM revoked_tokens WHERE token_hash = ?', [tokenHash])).rows[0] || null;
  }

  async revokeToken(tokenHash, expiresAt, revokedAt) {
    await this.query(`
      INSERT INTO revoked_tokens (token_hash, expires_at, revoked_at)
      VALUES (?, ?, ?)
      ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked_at = EXCLUDED.revoked_at
    `, [tokenHash, expiresAt, revokedAt]);
  }

  async insertAuthToken(token) {
    await this.query(`
      INSERT INTO auth_tokens (token_hash, user_id, type, created_at, expires_at, used_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (token_hash) DO UPDATE SET user_id = EXCLUDED.user_id, type = EXCLUDED.type, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at, used_at = EXCLUDED.used_at
    `, [token.tokenHash, token.userId, token.type, token.createdAt, token.expiresAt, token.usedAt || null]);
  }

  async getActiveAuthToken(tokenHash, type) {
    return (await this.query(`
      SELECT auth_tokens.*, users.*
      FROM auth_tokens
      JOIN users ON users.id = auth_tokens.user_id
      WHERE auth_tokens.token_hash = ? AND auth_tokens.type = ? AND auth_tokens.used_at IS NULL
    `, [tokenHash, type])).rows[0] || null;
  }

  async useAuthToken(tokenHash, usedAt) {
    await this.query('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?', [usedAt, tokenHash]);
  }

  async listInterviewsByOwner(ownerId) {
    return (await this.query('SELECT * FROM interviews WHERE owner_user_id = ? ORDER BY updated_at DESC', [ownerId])).rows;
  }

  async getInterviewForOwner(interviewId, ownerId) {
    return (await this.query('SELECT * FROM interviews WHERE id = ? AND owner_user_id = ?', [interviewId, ownerId])).rows[0] || null;
  }

  async getInterviewById(interviewId) {
    return (await this.query('SELECT * FROM interviews WHERE id = ?', [interviewId])).rows[0] || null;
  }

  async insertInterview(interview, review = {}) {
    await this.query(`
      INSERT INTO interviews (
        id, owner_user_id, question_id, title, prompt, candidate_name, candidate_email,
        difficulty, duration, status, permissions_json, architecture_json, scores_json, review_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
      JSON.stringify(review),
      interview.createdAt,
      interview.updatedAt,
    ]);
  }

  async updateInterviewForOwner(interviewId, ownerId, updated) {
    await this.query(`
      UPDATE interviews
      SET title = ?, prompt = ?, candidate_name = ?, candidate_email = ?, difficulty = ?, duration = ?,
          status = ?, permissions_json = ?, architecture_json = ?, scores_json = ?, review_json = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ?
    `, [...interviewUpdateParams(updated), interviewId, ownerId]);
  }

  async updateSharedInterview(interviewId, updated) {
    await this.query('UPDATE interviews SET architecture_json = ?, scores_json = ?, review_json = ?, status = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(updated.architecture), JSON.stringify(updated.scores), JSON.stringify(updated.review), updated.status, updated.updatedAt, interviewId,
    ]);
  }

  async deleteInterviewForOwner(interviewId, ownerId) {
    await this.query('DELETE FROM interviews WHERE id = ? AND owner_user_id = ?', [interviewId, ownerId]);
  }

  async getShareByTokenHash(tokenHash) {
    return (await this.query(`
      SELECT share_tokens.role, share_tokens.expires_at, share_tokens.revoked_at, interviews.*
      FROM share_tokens
      JOIN interviews ON interviews.id = share_tokens.interview_id
      WHERE share_tokens.token_hash = ?
    `, [tokenHash])).rows[0] || null;
  }

  async insertShareToken(token) {
    await this.query('INSERT INTO share_tokens (token_hash, interview_id, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [
      token.tokenHash, token.interviewId, token.role, token.createdBy, token.createdAt, token.expiresAt,
    ]);
  }

  async revokeShareTokens(interviewId, revokedAt) {
    return (await this.query('UPDATE share_tokens SET revoked_at = ? WHERE interview_id = ? AND revoked_at IS NULL', [revokedAt, interviewId])).rowCount || 0;
  }

  async appendEvent(event) {
    await this.query('INSERT INTO interview_events (id, interview_id, kind, actor_role, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
      event.id, event.interviewId, event.kind, event.actorRole, event.summary, event.createdAt,
    ]);
  }

  async listEvents(interviewId) {
    return (await this.query('SELECT kind, actor_role, summary, created_at FROM interview_events WHERE interview_id = ? ORDER BY created_at DESC LIMIT 25', [interviewId])).rows;
  }

  async insertAnalyticsEvent(event) {
    await this.query(`
      INSERT INTO analytics_events (id, event, user_id, session_id, role, path, properties_json, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      event.id,
      event.event,
      event.userId || null,
      event.sessionId || null,
      event.role || null,
      event.path || null,
      JSON.stringify(event.properties || {}),
      event.ipHash || null,
      event.createdAt,
    ]);
  }
}

function interviewUpdateParams(updated) {
  return [
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
  ];
}

function postgresSsl(databaseUrl) {
  const explicit = process.env.DATABASE_SSL;
  if (explicit === 'false' || explicit === 'disable') return false;
  if (explicit === 'true' || explicit === 'require') return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' };
  return /sslmode=require/i.test(databaseUrl) ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false;
}

export async function createStore(options = {}) {
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || '';
  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: postgresSsl(databaseUrl),
      max: Number(process.env.DATABASE_POOL_MAX || 10),
    });
    await postgresMigrate(pool);
    return new PostgresStore(pool);
  }

  const dbPath = options.dbPath || process.env.SDS_DB_PATH;
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  sqliteMigrate(db);
  return new SqliteStore(db);
}

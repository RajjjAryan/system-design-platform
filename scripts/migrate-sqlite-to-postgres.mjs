import { DatabaseSync } from 'node:sqlite';

import { createStore } from '../server/store.mjs';

function readRows(db, table) {
  try {
    return db.prepare(`SELECT * FROM ${table}`).all();
  } catch {
    return [];
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const sqlitePath = process.argv[2];
if (!sqlitePath) {
  console.error('Usage: node scripts/migrate-sqlite-to-postgres.mjs /path/to/systemdesign.sqlite');
  process.exit(1);
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const store = await createStore({ databaseUrl: process.env.DATABASE_URL });

const counts = {
  users: 0,
  interviews: 0,
  shareTokens: 0,
  interviewEvents: 0,
  revokedTokens: 0,
};

for (const row of readRows(sqlite, 'users')) {
  const existing = await store.getUserById(row.id);
  if (existing) continue;
  await store.insertUser({
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerifiedAt: row.email_verified_at || row.created_at,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  });
  counts.users += 1;
}

for (const row of readRows(sqlite, 'interviews')) {
  const existing = await store.getInterviewById(row.id);
  if (existing) continue;
  await store.insertInterview({
    id: row.id,
    ownerUserId: row.owner_user_id,
    questionId: row.question_id,
    title: row.title,
    prompt: row.prompt,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    difficulty: row.difficulty,
    duration: Number(row.duration || 45),
    status: row.status,
    permissions: parseJson(row.permissions_json, {}),
    architecture: parseJson(row.architecture_json, { comps: [], edges: [], comments: [] }),
    scores: parseJson(row.scores_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }, parseJson(row.review_json, {}));
  counts.interviews += 1;
}

for (const row of readRows(sqlite, 'share_tokens')) {
  const existing = await store.getShareByTokenHash(row.token_hash);
  if (existing) continue;
  await store.insertShareToken({
    tokenHash: row.token_hash,
    interviewId: row.interview_id,
    role: row.role,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  });
  if (row.revoked_at) await store.revokeShareTokens(row.interview_id, row.revoked_at);
  counts.shareTokens += 1;
}

for (const row of readRows(sqlite, 'interview_events')) {
  await store.appendEvent({
    id: row.id,
    interviewId: row.interview_id,
    kind: row.kind,
    actorRole: row.actor_role,
    summary: row.summary,
    createdAt: row.created_at,
  });
  counts.interviewEvents += 1;
}

for (const row of readRows(sqlite, 'revoked_tokens')) {
  await store.revokeToken(row.token_hash, row.expires_at, row.revoked_at);
  counts.revokedTokens += 1;
}

sqlite.close();
await store.close();
console.log(JSON.stringify(counts));

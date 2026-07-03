import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApiServer } from '../server/api-server.mjs';

async function startServer() {
  const dir = mkdtempSync(join(tmpdir(), 'sds-api-'));
  const dbPath = join(dir, 'test.sqlite');
  const server = createApiServer({
    dbPath,
    publicOrigin: 'https://rajjjaryan.github.io/system-design-platform/',
    tokenSecret: 'test-secret',
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function request(baseUrl, method, path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

const app = await startServer();

try {
  const anonymous = await request(app.baseUrl, 'GET', '/api/interviews');
  assert.equal(anonymous.response.status, 401);

  const weakPassword = await request(app.baseUrl, 'POST', '/api/auth/signup', {
    name: 'Weak Password',
    email: 'weak@example.com',
    password: 'short',
  });
  assert.equal(weakPassword.response.status, 400);
  assert.equal(weakPassword.json.error, 'Password does not meet the requirements');
  assert.deepEqual(weakPassword.json.details.password, ['Use at least 12 characters']);

  const signup = await request(app.baseUrl, 'POST', '/api/auth/signup', {
    name: 'Neha Rao',
    email: 'neha@example.com',
    password: 'correct horse battery staple',
  });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.json.user.email, 'neha@example.com');
  assert.ok(signup.json.token.length > 40);

  const create = await request(app.baseUrl, 'POST', '/api/interviews', {
    questionId: 'payment',
    title: 'Payment API interview',
    candidateName: 'Sam Lee',
    candidateEmail: 'sam@example.com',
    duration: 60,
    difficulty: 'Hard',
    permissions: {
      allowCandidateEdit: false,
      showHealthToCandidate: false,
      allowFailureInjection: true,
      aiHintsInterviewerOnly: true,
    },
  }, signup.json.token);

  assert.equal(create.response.status, 201);
  assert.equal(create.json.interview.questionId, 'payment');
  assert.equal(create.json.interview.candidate.email, 'sam@example.com');

  const mine = await request(app.baseUrl, 'GET', '/api/interviews', null, signup.json.token);
  assert.equal(mine.response.status, 200);
  assert.equal(mine.json.interviews.length, 1);
  assert.equal(mine.json.interviews[0].title, 'Payment API interview');

  const share = await request(app.baseUrl, 'POST', `/api/interviews/${create.json.interview.id}/share`, null, signup.json.token);
  assert.equal(share.response.status, 200);
  assert.match(share.json.links.candidate, /^https:\/\/rajjjaryan\.github\.io\/system-design-platform\/\?share=/);
  assert.match(share.json.tokens.candidate, /^[A-Za-z0-9_-]{32,}$/);

  const shared = await request(app.baseUrl, 'GET', `/api/share/${share.json.tokens.candidate}`);
  assert.equal(shared.response.status, 200);
  assert.equal(shared.json.role, 'candidate');
  assert.equal(shared.json.interview.questionId, 'payment');
  assert.equal(shared.json.visibility.canEditCanvas, false);
  assert.equal(shared.json.visibility.canSeeHealth, false);
  assert.equal(shared.json.visibility.canInjectFailures, false);
  assert.equal(shared.json.visibility.canSeeScorecard, false);
  assert.equal(shared.json.interview.scores, undefined);

  const otherSignup = await request(app.baseUrl, 'POST', '/api/auth/signup', {
    name: 'Other User',
    email: 'other@example.com',
    password: 'correct horse battery staple',
  });
  assert.equal(otherSignup.response.status, 201);

  const others = await request(app.baseUrl, 'GET', '/api/interviews', null, otherSignup.json.token);
  assert.equal(others.response.status, 200);
  assert.equal(others.json.interviews.length, 0);
} finally {
  await app.close();
}

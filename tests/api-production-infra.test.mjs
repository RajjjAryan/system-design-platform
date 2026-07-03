import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApiServer } from '../server/api-server.mjs';

async function startServer(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'sds-infra-'));
  const server = createApiServer({
    dbPath: join(dir, 'test.sqlite'),
    publicOrigin: 'https://studio.example.test/',
    tokenSecret: 'infra-test-secret',
    ...options,
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

function tokenFromMail(message, param) {
  const body = `${message.text || ''}\n${message.html || ''}`;
  const match = body.match(new RegExp(`${param}=([A-Za-z0-9_-]+)`));
  assert.ok(match, `Expected ${param} token in email body`);
  return match[1];
}

const sent = [];
const mailer = {
  configured: true,
  async sendMail(message) {
    sent.push(message);
    return { messageId: `test-${sent.length}` };
  },
};

const app = await startServer({ mailer, requireEmailVerification: true });

try {
  const health = await request(app.baseUrl, 'GET', '/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.json.status, 'ok');
  assert.equal(health.json.database.provider, 'sqlite');
  assert.equal(health.json.email.configured, true);
  assert.equal(health.json.monitoring.sentry, false);
  assert.equal(health.json.analytics.provider, 'database');

  const ready = await request(app.baseUrl, 'GET', '/api/ready');
  assert.equal(ready.response.status, 200);
  assert.equal(ready.json.ready, true);

  const analytics = await request(app.baseUrl, 'POST', '/api/analytics/events', {
    event: 'workspace.opened',
    sessionId: 'int_test',
    role: 'interviewer',
    path: '/workspace',
    properties: { source: 'test' },
  });
  assert.equal(analytics.response.status, 202);
  assert.equal(analytics.json.accepted, true);

  const signup = await request(app.baseUrl, 'POST', '/api/auth/signup', {
    name: 'Verified User',
    email: 'verified@example.com',
    password: 'correct horse battery staple',
  });
  assert.equal(signup.response.status, 201);
  assert.equal(signup.json.user.emailVerified, false);
  assert.equal(signup.json.verificationRequired, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'verified@example.com');

  const blockedLogin = await request(app.baseUrl, 'POST', '/api/auth/login', {
    email: 'verified@example.com',
    password: 'correct horse battery staple',
  });
  assert.equal(blockedLogin.response.status, 403);
  assert.equal(blockedLogin.json.error, 'Email verification required');

  const verifyToken = tokenFromMail(sent[0], 'verify');
  const verified = await request(app.baseUrl, 'POST', '/api/auth/verify-email', { token: verifyToken });
  assert.equal(verified.response.status, 200);
  assert.equal(verified.json.verified, true);
  assert.equal(verified.json.user.emailVerified, true);

  const login = await request(app.baseUrl, 'POST', '/api/auth/login', {
    email: 'verified@example.com',
    password: 'correct horse battery staple',
  });
  assert.equal(login.response.status, 200);

  const resetRequest = await request(app.baseUrl, 'POST', '/api/auth/request-password-reset', {
    email: 'verified@example.com',
  });
  assert.equal(resetRequest.response.status, 202);
  assert.equal(resetRequest.json.sent, true);
  assert.equal(sent.length, 2);

  const resetToken = tokenFromMail(sent[1], 'reset');
  const reset = await request(app.baseUrl, 'POST', '/api/auth/reset-password', {
    token: resetToken,
    password: 'new correct horse battery staple',
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.json.reset, true);

  const oldPassword = await request(app.baseUrl, 'POST', '/api/auth/login', {
    email: 'verified@example.com',
    password: 'correct horse battery staple',
  });
  assert.equal(oldPassword.response.status, 401);

  const newPassword = await request(app.baseUrl, 'POST', '/api/auth/login', {
    email: 'verified@example.com',
    password: 'new correct horse battery staple',
  });
  assert.equal(newPassword.response.status, 200);
} finally {
  await app.close();
}

const noEmailApp = await startServer({ mailer: { configured: false } });

try {
  const resetRequest = await request(noEmailApp.baseUrl, 'POST', '/api/auth/request-password-reset', {
    email: 'nobody@example.com',
  });
  assert.equal(resetRequest.response.status, 503);
  assert.equal(resetRequest.json.error, 'Email provider is not configured');
} finally {
  await noEmailApp.close();
}

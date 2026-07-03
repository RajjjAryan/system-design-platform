import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApiServer } from '../server/api-server.mjs';

async function startServer() {
  const dir = mkdtempSync(join(tmpdir(), 'sds-ws-'));
  const server = createApiServer({
    dbPath: join(dir, 'test.sqlite'),
    publicOrigin: 'http://127.0.0.1:8787/',
    tokenSecret: 'websocket-test-secret',
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

function openSocket(url) {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out opening ${url}`)), 1000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`Failed to open ${url}`));
    }, { once: true });
  });
}

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for websocket message')), 1500);
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      if (!predicate(payload)) return;
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const app = await startServer();

try {
  const signup = await request(app.baseUrl, 'POST', '/api/auth/signup', {
    name: 'Owner User',
    email: 'owner-ws@example.com',
    password: 'correct horse battery staple',
  });
  assert.equal(signup.response.status, 201);

  const created = await request(app.baseUrl, 'POST', '/api/interviews', {
    questionId: 'payment',
    title: 'Payment websocket interview',
    prompt: 'Design a payment platform',
    candidateName: 'Sam Lee',
    candidateEmail: 'sam@example.com',
    duration: 60,
    difficulty: 'Hard',
    permissions: { allowCandidateEdit: true },
    architecture: {
      comps: [{ id: 'api', type: 'API Service', cat: 'Compute', x: 120, y: 120 }],
      edges: [],
      comments: [],
    },
  }, signup.json.token);
  assert.equal(created.response.status, 201);

  const share = await request(app.baseUrl, 'POST', `/api/interviews/${created.json.interview.id}/share`, null, signup.json.token);
  assert.equal(share.response.status, 200);

  const wsBase = app.baseUrl.replace(/^http:/, 'ws:');
  const ownerSocket = await openSocket(`${wsBase}/api/ws/interviews/${created.json.interview.id}?auth=${encodeURIComponent(signup.json.token)}`);
  const candidateSocket = await openSocket(`${wsBase}/api/ws/interviews/${created.json.interview.id}?share=${encodeURIComponent(share.json.tokens.candidate)}`);

  const updateMessage = waitForMessage(ownerSocket, (payload) => payload.type === 'interview.updated');
  const edited = await request(app.baseUrl, 'PATCH', `/api/share/${share.json.tokens.candidate}`, {
    architecture: {
      comps: [
        { id: 'api', type: 'API Service', cat: 'Compute', x: 120, y: 120 },
        { id: 'db', type: 'PostgreSQL', cat: 'Storage', x: 360, y: 160 },
      ],
      edges: [{ id: 'edge1', from: 'api', to: 'db', protocol: 'SQL/TLS' }],
      comments: [],
    },
  });
  assert.equal(edited.response.status, 200);

  const message = await updateMessage;
  assert.equal(message.interviewId, created.json.interview.id);
  assert.equal(typeof message.updatedAt, 'string');

  ownerSocket.close();
  candidateSocket.close();
} finally {
  await app.close();
}

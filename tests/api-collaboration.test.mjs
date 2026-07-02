import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApiServer } from '../server/api-server.mjs';

async function startServer() {
  const dir = mkdtempSync(join(tmpdir(), 'sds-collab-'));
  const server = createApiServer({
    dbPath: join(dir, 'test.sqlite'),
    publicOrigin: 'https://rajjjaryan.github.io/system-design-platform/',
    tokenSecret: 'collaboration-test-secret',
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

async function signup(baseUrl, suffix) {
  const result = await request(baseUrl, 'POST', '/api/auth/signup', {
    name: `Owner ${suffix}`,
    email: `owner-${suffix}@example.com`,
    password: 'correct horse battery staple',
  });
  assert.equal(result.response.status, 201);
  return result.json;
}

async function createInterview(baseUrl, token, permissions = {}) {
  const result = await request(baseUrl, 'POST', '/api/interviews', {
    questionId: 'payment',
    title: 'Payment collaboration interview',
    prompt: 'Design a production payment platform',
    candidateName: 'Sam Lee',
    candidateEmail: 'sam@example.com',
    duration: 60,
    difficulty: 'Hard',
    permissions: {
      allowCandidateEdit: true,
      showHealthToCandidate: false,
      panelCanViewReview: true,
      ...permissions,
    },
    architecture: {
      comps: [{ id: 'api', type: 'API Gateway', cat: 'API', x: 100, y: 120 }],
      edges: [],
      comments: [],
    },
  }, token);
  assert.equal(result.response.status, 201);
  return result.json.interview;
}

const app = await startServer();

try {
  const owner = await signup(app.baseUrl, 'collab');
  const interview = await createInterview(app.baseUrl, owner.token);
  const share = await request(app.baseUrl, 'POST', `/api/interviews/${interview.id}/share`, null, owner.token);
  assert.equal(share.response.status, 200);

  const candidate = await request(app.baseUrl, 'GET', `/api/share/${share.json.tokens.candidate}`);
  assert.equal(candidate.response.status, 200);
  assert.equal(candidate.json.interview.architecture.comps.length, 1);
  assert.equal(candidate.json.visibility.canEditCanvas, true);

  const edited = await request(app.baseUrl, 'PATCH', `/api/share/${share.json.tokens.candidate}`, {
    architecture: {
      comps: [
        { id: 'api', type: 'API Gateway', cat: 'API', x: 100, y: 120 },
        { id: 'ledger', type: 'Ledger Service', cat: 'Compute', x: 340, y: 160 },
      ],
      edges: [{ id: 'edge1', from: 'api', to: 'ledger', protocol: 'gRPC' }],
      comments: [{ id: 'note1', x: 260, y: 90, text: 'Ask about idempotency.' }],
    },
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.json.interview.architecture.comps.length, 2);
  assert.equal(edited.json.interview.architecture.comments[0].text, 'Ask about idempotency.');

  const ownerView = await request(app.baseUrl, 'GET', '/api/interviews', null, owner.token);
  assert.equal(ownerView.response.status, 200);
  assert.equal(ownerView.json.interviews[0].architecture.comps.length, 2);
  assert.equal(ownerView.json.interviews[0].architecture.edges.length, 1);

  const review = await request(app.baseUrl, 'PATCH', `/api/interviews/${interview.id}`, {
    status: 'reviewed',
    scores: { Scalability: 4, Reliability: 5 },
    review: {
      decision: 'advance',
      feedback: 'Strong consistency discussion and good tradeoffs.',
    },
  }, owner.token);
  assert.equal(review.response.status, 200);
  assert.equal(review.json.interview.review.decision, 'advance');
  assert.equal(review.json.interview.review.feedback, 'Strong consistency discussion and good tradeoffs.');

  const panel = await request(app.baseUrl, 'GET', `/api/share/${share.json.tokens.panel}`);
  assert.equal(panel.response.status, 200);
  assert.equal(panel.json.visibility.canSeeScorecard, true);
  assert.equal(panel.json.interview.review.decision, 'advance');

  const interviewerShareReview = await request(app.baseUrl, 'PATCH', `/api/share/${share.json.tokens.interviewer}`, {
    status: 'reviewed',
    scores: { Scalability: 5 },
    review: {
      decision: 'strong-hire',
      feedback: 'Saved by an interviewer share link.',
    },
  });
  assert.equal(interviewerShareReview.response.status, 200);
  assert.equal(interviewerShareReview.json.interview.review.decision, 'strong-hire');
  assert.equal(interviewerShareReview.json.interview.scores.Scalability, 5);

  const locked = await createInterview(app.baseUrl, owner.token, { allowCandidateEdit: false });
  const lockedShare = await request(app.baseUrl, 'POST', `/api/interviews/${locked.id}/share`, null, owner.token);
  const forbidden = await request(app.baseUrl, 'PATCH', `/api/share/${lockedShare.json.tokens.candidate}`, {
    architecture: { comps: [], edges: [], comments: [] },
  });
  assert.equal(forbidden.response.status, 403);
} finally {
  await app.close();
}

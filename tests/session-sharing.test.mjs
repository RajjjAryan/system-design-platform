import assert from 'node:assert/strict';

import { QUESTIONS, QUESTION_SPEC } from '../public/sds-data.js';
import {
  buildShareUrl,
  createDefaultDraft,
  createInitialState,
  createSessionFromDraft,
  parseSharedInvite,
} from '../public/app.js';

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

for (const question of QUESTIONS) {
  const spec = QUESTION_SPEC[question.id];
  assert.ok(spec, `Expected ${question.id} to have a full question spec`);
  assert.ok(spec.statement.length > 80, `Expected ${question.id} statement to be developed`);
  assert.ok(spec.functional.length >= 3, `Expected ${question.id} functional requirements`);
  assert.ok(spec.nonFunctional.length >= 3, `Expected ${question.id} non-functional requirements`);
  assert.ok(spec.scale.length >= 2, `Expected ${question.id} scale assumptions`);
  assert.ok(spec.followups.length >= 2, `Expected ${question.id} interviewer follow-ups`);
}

const owner = { name: 'Neha Rao', email: 'neha@example.com' };
const draft = createDefaultDraft(owner, 'payment');
draft.candidateName = 'Sam Lee';
draft.candidateEmail = 'sam@example.com';
draft.duration = 60;

const session = createSessionFromDraft({ user: owner, draft, questionId: 'payment' });

assert.equal(session.owner.email, 'neha@example.com');
assert.equal(session.candidate.name, 'Sam Lee');
assert.equal(session.candidate.email, 'sam@example.com');
assert.equal(session.questionId, 'payment');
assert.equal(session.permissions.showHealthToCandidate, false);
assert.equal(session.permissions.allowCandidateEdit, true);
assert.doesNotMatch(session.title, /Twitter|Priya/i);

const candidateUrl = buildShareUrl({
  baseUrl: 'https://rajjjaryan.github.io/system-design-platform/',
  role: 'candidate',
  session,
});

assert.match(candidateUrl, /^https:\/\/rajjjaryan\.github\.io\/system-design-platform\/\?role=candidate&invite=/);

const parsed = parseSharedInvite(new URL(candidateUrl));
assert.equal(parsed.role, 'candidate');
assert.equal(parsed.session.id, session.id);
assert.equal(parsed.session.questionId, 'payment');
assert.equal(parsed.session.candidate.name, 'Sam Lee');

const anonymousState = createInitialState({
  location: new URL('https://rajjjaryan.github.io/system-design-platform/'),
  storage: memoryStorage(),
});
assert.equal(anonymousState.screen, 'login');

const signedInState = createInitialState({
  location: new URL('https://rajjjaryan.github.io/system-design-platform/'),
  storage: memoryStorage({
    'sds.currentUser': JSON.stringify(owner),
    'sds.sessions': JSON.stringify([session]),
  }),
});
assert.equal(signedInState.screen, 'dashboard');
assert.equal(signedInState.currentUser.name, 'Neha Rao');
assert.equal(signedInState.sessions[0].questionId, 'payment');

const invitedState = createInitialState({
  location: new URL(candidateUrl),
  storage: memoryStorage(),
});
assert.equal(invitedState.screen, 'login');
assert.equal(invitedState.pendingInvite.role, 'candidate');
assert.equal(invitedState.pendingInvite.session.questionId, 'payment');

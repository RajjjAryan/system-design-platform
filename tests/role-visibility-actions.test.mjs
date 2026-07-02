import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/app.js', 'utf8');

const requiredSnippets = [
  "screen === 'login'",
  "screen === 'join'",
  'data-action="signIn"',
  'data-action="signOut"',
  'data-action="copyShareLink"',
  'data-action="previewRole"',
  'data-action="acceptInvite"',
  'data-action="authMode"',
  'data-session-field="candidateName"',
  'data-session-field="candidateEmail"',
  'data-permission="${esc(key)}"',
  "'allowCandidateEdit'",
  "'showHealthToCandidate'",
  'data-role-link="${esc(role)}"',
  "'candidate'",
  "'interviewer'",
  'Candidate screen',
  'Interviewer screen',
  'this.canEdit()',
  'this.canInjectFailures()',
  'this.api.createInterview',
  'this.api.shareInterview',
  'clipboard.writeText',
];

for (const snippet of requiredSnippets) {
  assert.ok(source.includes(snippet), `Expected app source to include ${JSON.stringify(snippet)}`);
}

for (const tool of ['select', 'pan', 'connect', 'comment']) {
  assert.ok(
    source.includes(`data-action="tool" data-tool="${tool}"`),
    `Expected workspace toolbar ${tool} button to have an action`,
  );
}

assert.doesNotMatch(source, /Good afternoon, Aarav|Candidate: Priya S\.|systemdesign\.studio\/i\//);

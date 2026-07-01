import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('SystemDesign Studio Platform/SystemDesign Studio.dc.html', 'utf8');

const requiredSnippets = [
  'isCreateInterview',
  'isLinkGenerated',
  'openCreateInterview',
  'generateCandidateLink',
  'Dashboard / Create Interview / Setup',
  'Dashboard / Create Interview / Link Generated',
  'Candidate link',
  'Interviewer controls',
  'Permissions',
  'Start workspace',
];

for (const snippet of requiredSnippets) {
  assert.ok(
    source.includes(snippet),
    `Expected prototype source to include ${JSON.stringify(snippet)}`,
  );
}

assert.ok(
  /onClick="\{\{ openCreateInterview \}\}"[\s\S]{0,500}Create interview/.test(source),
  'Expected dashboard Create interview button to open the setup flow',
);

assert.ok(
  /onClick="\{\{ generateCandidateLink \}\}"[\s\S]{0,500}Generate candidate link/.test(source),
  'Expected setup flow to expose candidate link generation',
);

assert.ok(
  /onClick="\{\{ startWorkspace \}\}"[\s\S]{0,500}Start workspace/.test(source),
  'Expected setup flow to start the workspace',
);

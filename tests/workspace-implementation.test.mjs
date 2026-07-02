import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/app.js', 'utf8');

const requiredImplementationMarkers = [
  'handleCanvasClick',
  'createConnection',
  'addCanvasComment',
  'persistArchitecture',
  'saveReview',
  'renderComments',
  'renderDynamicAiHints',
  'data-palette-search',
  'data-comment-id',
  'data-review-field="feedback"',
  'data-decision="advance"',
  'data-decision="no-hire"',
  'this.api.updateInterview',
  'this.api.updateSharedInterview',
  'transform:translate(${this.state.pan.x}px, ${this.state.pan.y}px)',
];

for (const marker of requiredImplementationMarkers) {
  assert.ok(source.includes(marker), `Expected workspace implementation to include ${JSON.stringify(marker)}`);
}

assert.doesNotMatch(source, /Saved locally|deployable static artifact|Evaluation submitted|No generated answers/);

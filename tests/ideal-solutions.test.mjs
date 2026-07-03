import assert from 'node:assert/strict';

import { IDEAL_SOLUTIONS, QUESTIONS } from '../public/sds-data.js';

for (const question of QUESTIONS) {
  const ideal = IDEAL_SOLUTIONS[question.id];

  assert.ok(ideal, `Expected ideal solution for ${question.id}`);
  assert.equal(ideal.title.includes(question.title.replace(/^Design\s+/, '')), true);
  assert.ok(ideal.components.length >= 5, `${question.id} should define core components`);
  assert.ok(ideal.edges.length >= 4, `${question.id} should define core edges`);
  assert.ok(ideal.keyPoints.length >= 4, `${question.id} should define assessment points`);
  assert.ok(ideal.rubric.length >= 5, `${question.id} should define scoring rubric`);
  assert.equal(ideal.rubric.reduce((sum, item) => sum + item.weight, 0), 100);
}

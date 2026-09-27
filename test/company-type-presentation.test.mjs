import test from 'node:test';
import assert from 'node:assert/strict';
import { companyTypeTag } from '../public/job-presentation.js';

test('company type is presented as one neutral tag while scoring stays separate', () => {
  assert.deepEqual(companyTypeTag('Recruiting intermediary'), {
    label: 'Recruiting intermediary',
    tone: 'neutral',
  });
  assert.equal(companyTypeTag(null), null);
});

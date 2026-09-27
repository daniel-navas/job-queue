import test from 'node:test';
import assert from 'node:assert/strict';
import { companyTypeTag } from '../public/job-presentation.js';

test('company type tag reflects its configured score while the number stays separate', () => {
  assert.deepEqual(companyTypeTag('Product company', 1), {
    label: 'Product company',
    tone: 'positive',
  });
  assert.deepEqual(companyTypeTag('Outsourcing company', -1), {
    label: 'Outsourcing company',
    tone: 'negative',
  });
  assert.deepEqual(companyTypeTag('Not determined', 0), {
    label: 'Not determined',
    tone: 'neutral',
  });
  assert.deepEqual(companyTypeTag('Recruiting intermediary', -1), {
    label: 'Recruiting intermediary',
    tone: 'negative',
  });
  assert.equal(companyTypeTag(null), null);
});

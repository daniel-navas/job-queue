import test from 'node:test';
import assert from 'node:assert/strict';

test('unrecognized search layouts and detail extraction failures cannot count as successful empty searches', async () => {
  const { verifyCaptureHealth } = await import('../src/linkedin/extract.mjs');
  assert.throws(() => verifyCaptureHealth({ observed: 0, explicitEmpty: false, attempted: 0, completed: 0 }), /recognize/i);
  assert.doesNotThrow(() => verifyCaptureHealth({ observed: 0, explicitEmpty: true, attempted: 0, completed: 0 }));
  assert.throws(() => verifyCaptureHealth({ observed: 4, explicitEmpty: false, attempted: 4, completed: 0 }), /descriptions/i);
  assert.doesNotThrow(() => verifyCaptureHealth({ observed: 4, attempted: 0, completed: 0 }));
  assert.doesNotThrow(() => verifyCaptureHealth({ observed: 4, attempted: 4, completed: 1 }));
});

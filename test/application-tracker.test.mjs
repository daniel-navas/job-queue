import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Queue, mergeJobs } from '../src/queue.mjs';
import { applicationView } from '../src/application-tracker.mjs';

test('submission persists independently of review and rediscovery', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-application-'));
  try {
    const queue = new Queue(root);
    queue.state.jobs = [{ id: '123', title: 'Backend', description: 'Full description', status: 'interesting', history: [], availability: { status: 'closed' } }];
    await queue.save();
    await queue.updateApplication('123', { type: 'submit', date: '2026-09-21' });
    await queue.updateApplication('123', { type: 'submit', date: '2026-09-21' });
    await queue.updateApplication('123', { type: 'update-submission', date: '2026-09-20' });
    const restored = new Queue(root); await restored.load();
    const job = mergeJobs(restored.state.jobs, [{ id: '123', title: 'Updated backend' }], '2026-09-22', 'search')[0];
    assert.equal(job.status, 'interesting');
    assert.equal(job.availability.status, 'closed');
    assert.equal(job.application.submission.date, '2026-09-20');
    assert.equal(job.application.submission.source, 'manual');
    assert.match(job.application.submission.id, /^[0-9a-f-]{36}$/);
    assert.equal(job.application.events.length, 0);
    assert.deepEqual(applicationView(job.application), { stage: 'applied', closed: false, nextAction: 'Waiting for response', nextAt: null, priority: 2 });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('interviews move from scheduling to upcoming to waiting without auto-completion', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-interviews-'));
  try {
    const queue = new Queue(root); queue.state.jobs = [{ id: 'one', status: 'new', history: [] }]; await queue.save();
    await queue.updateApplication('one', { type: 'submit', date: '2026-09-21' });
    await queue.updateApplication('one', { type: 'add-interview', name: 'Technical', state: 'needs-scheduling' });
    let application = queue.state.jobs[0].application;
    const interviewId = application.events[0].id;
    assert.deepEqual(applicationView(application), { stage: 'interviewing', closed: false, nextAction: 'Schedule Technical', nextAt: null, priority: 0 });
    await queue.updateApplication('one', { type: 'update-interview', eventId: interviewId, name: 'System design', state: 'scheduled', scheduledAt: '2026-09-25T15:00:00-05:00' });
    application = queue.state.jobs[0].application;
    assert.deepEqual(applicationView(application, new Date('2026-09-22T12:00:00Z')), { stage: 'interviewing', closed: false, nextAction: 'System design', nextAt: '2026-09-25T15:00:00-05:00', priority: 1 });
    assert.equal(applicationView(application, new Date('2026-09-26T12:00:00Z')).nextAction, 'Update System design');
    await queue.updateApplication('one', { type: 'update-interview', eventId: interviewId, name: 'System design', state: 'completed', completedAt: '2026-09-25' });
    assert.equal(applicationView(queue.state.jobs[0].application).nextAction, 'Waiting for response');
    await queue.updateApplication('one', { type: 'add-interview', name: 'Hiring manager', state: 'needs-scheduling' });
    assert.equal(applicationView(queue.state.jobs[0].application).nextAction, 'Schedule Hiring manager');
    const secondId = queue.state.jobs[0].application.events[1].id;
    await queue.updateApplication('one', { type: 'remove-event', eventId: secondId });
    assert.equal(applicationView(queue.state.jobs[0].application).nextAction, 'Waiting for response');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('outcome closes, reopening retains history, and invalid edits roll back', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-outcome-'));
  try {
    const queue = new Queue(root); queue.state.jobs = [{ id: 'one', status: 'new', history: [] }]; await queue.save();
    await queue.updateApplication('one', { type: 'submit', date: '2026-09-21' });
    await queue.updateApplication('one', { type: 'outcome', outcome: 'rejected', date: '2026-09-30' });
    assert.equal(applicationView(queue.state.jobs[0].application).closed, true);
    await queue.updateApplication('one', { type: 'reopen' });
    assert.equal(applicationView(queue.state.jobs[0].application).stage, 'applied');
    assert.equal(queue.state.jobs[0].application.events.length, 2);
    const before = structuredClone(queue.state);
    await assert.rejects(queue.updateApplication('one', { type: 'add-interview', name: '', state: 'scheduled' }), /Invalid/);
    assert.deepEqual(queue.state, before);
    const restored = new Queue(root); await restored.load();
    assert.deepEqual(restored.state, before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('corrections cannot claim acceptance without a recorded offer', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-corrections-'));
  try {
    const queue = new Queue(root); queue.state.jobs = [{ id: 'one', status: 'new', history: [] }]; await queue.save();
    await queue.updateApplication('one', { type: 'submit', date: '2026-09-21' });
    await queue.updateApplication('one', { type: 'outcome', outcome: 'rejected', date: '2026-09-22' });
    const outcomeId = queue.state.jobs[0].application.events[0].id;
    await assert.rejects(queue.updateApplication('one', { type: 'update-outcome', eventId: outcomeId, outcome: 'accepted', date: '2026-09-22' }), /offer/i);
    await queue.updateApplication('one', { type: 'remove-event', eventId: outcomeId });
    assert.equal(applicationView(queue.state.jobs[0].application).closed, false);
    await queue.updateApplication('one', { type: 'undo-submit' });
    assert.equal(queue.state.jobs[0].application, undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('reopening an accepted offer restores offer stage without erasing history', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-offer-reopen-'));
  try {
    const queue = new Queue(root); queue.state.jobs = [{ id: 'one', status: 'new', history: [] }]; await queue.save();
    await queue.updateApplication('one', { type: 'submit', date: '2026-09-21' });
    await queue.updateApplication('one', { type: 'outcome', outcome: 'offer-received', date: '2026-09-22' });
    await queue.updateApplication('one', { type: 'outcome', outcome: 'accepted', date: '2026-09-23' });
    await queue.updateApplication('one', { type: 'reopen' });
    assert.equal(applicationView(queue.state.jobs[0].application).stage, 'offer-received');
    assert.equal(queue.state.jobs[0].application.events.length, 3);
  } finally { await rm(root, { recursive: true, force: true }); }
});

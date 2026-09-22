import { randomUUID } from 'node:crypto';

const terminal = new Set(['rejected', 'withdrawn', 'no-response', 'accepted']);
const outcomes = new Set([...terminal, 'offer-received']);
const states = new Set(['needs-scheduling', 'scheduled', 'completed']);
const fail = message => { throw new Error(`Invalid application update: ${message}`); };
const plain = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('text');
  return value.trim();
};
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) fail('date');
  return value;
};
const instant = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail('scheduled time');
  return value;
};
const note = value => plain(value ?? '', 2000);
const interviewFields = change => {
  const name = plain(change.name, 100, true);
  if (!states.has(change.state)) fail('interview state');
  return { name, state: change.state, scheduledAt: change.state === 'scheduled' ? instant(change.scheduledAt) : null,
    completedAt: change.state === 'completed' ? date(change.completedAt) : null, note: note(change.note) };
};

export function applicationView(application, now = new Date()) {
  if (!application) return null;
  let closed = false, outcome = null, offerReceived = false;
  for (const event of application.events) {
    if (event.type === 'reopen') { closed = false; outcome = offerReceived ? 'offer-received' : null; }
    if (event.type === 'outcome') { outcome = event.outcome; if (outcome === 'offer-received') offerReceived = true; closed = terminal.has(outcome); }
  }
  const interviews = application.events.filter(event => event.type === 'interview');
  const stage = closed ? outcome : outcome === 'offer-received' ? 'offer-received' : interviews.length ? 'interviewing' : 'applied';
  if (closed) return { stage, closed, nextAction: null, nextAt: null, priority: 3 };
  if (stage === 'offer-received') return { stage, closed, nextAction: 'Offer received', nextAt: null, priority: 2 };
  const unresolved = interviews.filter(event => event.state !== 'completed');
  const overdue = unresolved.filter(event => event.state === 'scheduled' && Date.parse(event.scheduledAt) < now.getTime()).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
  if (overdue) return { stage, closed, nextAction: `Update ${overdue.name}`, nextAt: overdue.scheduledAt, priority: 0 };
  const toSchedule = unresolved.find(event => event.state === 'needs-scheduling');
  if (toSchedule) return { stage, closed, nextAction: `Schedule ${toSchedule.name}`, nextAt: null, priority: 0 };
  const upcoming = unresolved.sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];
  if (upcoming) return { stage, closed, nextAction: upcoming.name, nextAt: upcoming.scheduledAt, priority: 1 };
  return { stage, closed, nextAction: 'Waiting for response', nextAt: null, priority: 2 };
}

export function changeApplication(application, change, now = new Date()) {
  if (!change || typeof change !== 'object' || Array.isArray(change)) fail('action');
  if (change.type === 'submit') {
    if (application) return application;
    return { submission: { id: randomUUID(), type: 'submission', date: date(change.date), note: '', at: now.toISOString(), source: 'manual' }, events: [] };
  }
  if (!application) fail('mark as applied first');
  const copy = structuredClone(application);
  if (change.type === 'update-submission') { copy.submission.date = date(change.date); return copy; }
  if (change.type === 'undo-submit') {
    if (copy.events.length) fail('later updates exist');
    return null;
  }
  const view = applicationView(copy, now);
  if (change.type === 'reopen') {
    if (!view.closed) fail('process is already active');
    copy.events.push({ id: randomUUID(), type: 'reopen', at: now.toISOString(), source: 'manual' });
    return copy;
  }
  if (change.type === 'update-interview' || change.type === 'update-outcome' || change.type === 'remove-event') {
    const index = copy.events.findIndex(event => event.id === change.eventId);
    if (index < 0 || copy.events[index].type === 'reopen') fail('milestone not found');
    if (change.type === 'remove-event') {
      if (copy.events[index].outcome === 'offer-received' && copy.events.slice(index + 1).some(event => event.outcome === 'accepted')) fail('remove acceptance first');
      copy.events.splice(index, 1); return copy;
    }
    const event = copy.events[index];
    if (event.type !== (change.type === 'update-interview' ? 'interview' : 'outcome')) fail('milestone type');
    if (change.type === 'update-interview') Object.assign(event, interviewFields(change));
    else {
      if (!outcomes.has(change.outcome)) fail('outcome');
      if (change.outcome === 'accepted' && !copy.events.slice(0, index).some(item => item.outcome === 'offer-received')) fail('record offer first');
      if (event.outcome === 'offer-received' && change.outcome !== 'offer-received' && copy.events.slice(index + 1).some(item => item.outcome === 'accepted')) fail('remove acceptance first');
      Object.assign(event, { outcome: change.outcome, date: date(change.date), note: note(change.note) });
    }
    return copy;
  }
  if (view.closed) fail('reopen the process first');
  if (change.type === 'add-interview') {
    copy.events.push({ id: randomUUID(), type: 'interview', ...interviewFields(change), at: now.toISOString(), source: 'manual' });
  } else if (change.type === 'outcome') {
    if (!outcomes.has(change.outcome)) fail('outcome');
    if (change.outcome === 'accepted' && view.stage !== 'offer-received') fail('record offer first');
    copy.events.push({ id: randomUUID(), type: 'outcome', outcome: change.outcome, date: date(change.date), note: note(change.note), at: now.toISOString(), source: 'manual' });
  } else fail('action');
  return copy;
}

import { compareJobs, workplaceMode, roleFocus } from '/rating.js';
import { initSearches, provenanceHTML } from '/searches.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let data = { jobs: [] }, active = 'new', selected, rejecting, view = 'opportunities', applicationFilter = 'active', editingEvent = null;
let discoveryFilter = null;
let profileFilter = 'pending', profileSelected = null, profileShowAll = false;
const profileSelections = {};
const labels = { new: 'New', interesting: 'Interesting', dismissed: 'Dismissed', all: 'All jobs' };
async function api(url, body) { const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; }
function error(err) { $('#error').textContent = err.message; }
async function refresh() { data = await api('/api/jobs'); render(); }
function render() {
  const tracking = view === 'applications';
  const profiling = view === 'profile';
  const review = data.profileReview || { pendingCount: 0, activeUnmappedJobs: 0, items: [], allFacts: [] };
  for (const button of document.querySelectorAll('#views [data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  $('#views [data-view="profile"]').textContent = review.pendingCount ? `Profile ${review.pendingCount}` : 'Profile';
  for (const id of ['searches-open', 'scan', 'summarize']) $(`#${id}`).hidden = tracking || profiling;
  $('#run-status').hidden = tracking || profiling;
  $('#ai-status').hidden = tracking || profiling;
  $('#view-heading').hidden = !profiling;
  $('#jobs').setAttribute('aria-label', profiling ? 'Profile facts' : tracking ? 'Applications' : 'Jobs');
  $('#detail').setAttribute('aria-label', profiling ? 'Profile fact details' : tracking ? 'Application details' : 'Job details');
  $('#search').placeholder = profiling ? 'Search profile facts…' : tracking ? 'Search applications or ID…' : 'Search jobs or ID…';
  $('#search').setAttribute('aria-label', profiling ? 'Search profile facts' : tracking ? 'Search applications' : 'Search jobs');
  $('#tabs').setAttribute('aria-label', profiling ? 'Profile facts' : tracking ? 'Application status' : 'Job status');
  if (profiling) { renderProfile(review); return; }
  if (tracking) { renderApplications(); return; }
  const reviewable = job => job.availability?.status !== 'closed' && !job.application;
  $('#tabs').innerHTML = Object.entries(labels).map(([key, label]) => `<button data-tab="${key}" class="tab ${active === key ? 'active' : ''}" aria-pressed="${active === key}">${label} <span>${data.jobs.filter(j => key === 'all' || (j.status === key && reviewable(j))).length}</span></button>`).join('');
  const query = $('#search').value.toLowerCase();
  const jobs = data.jobs.filter(j => (active === 'all' || (j.status === active && reviewable(j))) && (!discoveryFilter || j.discoveries?.some(d => d.search.provider === discoveryFilter.provider && d.search.id === discoveryFilter.id && d.search.revision === discoveryFilter.revision)) && `${j.reference} ${j.id} ${j.title} ${j.company} ${j.location}`.toLowerCase().includes(query)).sort(compareJobs);
  if (!jobs.some(j => j.id === selected)) selected = jobs[0]?.id;
  $('#count').textContent = `${jobs.length} jobs${discoveryFilter ? ` · ${discoveryFilter.query}` : ''}`;
  $('#clear-discovery').hidden = !discoveryFilter;
  const enabled = data.searches?.searches?.filter(s => s.enabled) ?? [];
  $('#scan').disabled = data.scan?.running || data.connection?.running || !enabled.length;
  $('#summarize').disabled = data.ai?.running || !data.ai?.pending;
  const pendingCount = data.ai?.pending ?? 0;
  const nextBatch = Math.min(2, pendingCount);
  $('#summarize').innerHTML = data.ai?.running ? `<span class="spinner" aria-hidden="true"></span>${data.ai.processed}/${data.ai.total} ready` : `Process ${nextBatch} · ${pendingCount} pending`;
  $('#summarize').title = `Summarize the next ${nextBatch} of ${pendingCount} eligible jobs using Codex`;
  $('#ai-status').textContent = data.ai?.error ? data.ai.message : '';
  $('#ai-status').classList.toggle('failure', !!data.ai?.error);
  $('#scan').innerHTML = data.scan?.running ? `<span class="spinner" aria-hidden="true"></span>${escape(/^Searching \d+\/\d+$/.test(data.scan.message) ? data.scan.message : 'Searching…')}` : 'Find jobs';
  const scanStatus = data.scan?.running ? (data.scan.message === 'Sign in to LinkedIn' ? data.scan.message : '') : data.scan?.finishedAt ? (data.scan.error ? data.scan.message : `${data.scan.added ?? 0} jobs added`) : '';
  const reviewStatus = data.catalogReview?.recommended && !data.scan?.running && !data.scan?.error && !data.ai?.running && !data.ai?.error && !data.connection?.running && !data.connection?.error
    ? `${data.catalogReview.pending} tag${data.catalogReview.pending === 1 ? '' : 's'} pending review` : '';
  $('#run-status').textContent = [scanStatus, reviewStatus].filter(Boolean).join(' · ');
  $('#run-status').title = $('#run-status').textContent;
  $('#scan').title = enabled.length ? (data.scan?.running && data.scan.query ? data.scan.query : `${enabled.length} LinkedIn searches`) : 'Enable a search in Searches';
  $('#run-status').classList.toggle('failure', !!data.scan?.error);
  $('#jobs').innerHTML = jobs.map(job => `<article class="job ${job.id === selected ? 'selected' : ''} ${job.availability?.status === 'closed' ? 'job-closed' : ''}"><button class="job-open" data-open="${job.id}"><span class="job-copy"><span class="list-top"><span class="company">${escape(job.company || 'Company not provided')}</span><span class="list-states">${evaluationBadge(job.evaluation)}${active === 'all' && job.application ? `<span class="application-stage">${escape(stageLabels[job.applicationView?.stage] || 'Applied')}</span>` : ''}${job.availability?.status === 'closed' ? '<span class="availability-state">Closed</span>' : ''}</span></span><span class="list-title"><h2>${escape(job.title)}</h2>${ratingBadge(job.rating.total, job.rating.total === null ? 'No current AI summary' : 'Weighted priority score')}</span><span class="list-footer"><span class="muted">${escape(job.location || 'Location not provided')}</span><span class="list-reference">${escape(job.reference)}</span></span></span></button></article>`).join('') || '<div class="empty"><h2>You’re all caught up.</h2><p>Try another tab, clear your search, or find more jobs.</p></div>';
  const job = data.jobs.find(j => j.id === selected);
  $('#detail').innerHTML = job ? `<div class="detail-head"><a class="external detail-link" href="${escape(job.url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><div class="detail-title"><h2>${escape(job.title)}</h2>${ratingBadge(job.rating.total, 'Weighted priority score')}${job.application ? `<span class="application-stage">${escape(stageLabels[job.applicationView?.stage] || 'Applied')}</span>` : ''}${job.availability?.status === 'closed' ? '<span class="availability-state">Closed</span>' : ''}</div><div class="detail-meta"><span>${escape(job.company || 'Company not provided')}</span>${publishedHTML(job)}<button class="detail-id" data-copy-id="${escape(job.reference)}" title="Copy job ID">${escape(job.reference)}</button></div>${jobActions(job)}</div>${job.reason ? `<div class="feedback"><strong>Your feedback</strong><p>${escape(job.reason)}</p></div>` : ''}<hr>${summaryHTML(job)}<details class="original"><summary>Full description</summary><div class="description">${escape(job.description || 'Description not captured. Open LinkedIn for details.')}</div></details>` : '<div class="empty">Select a job to see the details.</div>';
}

const levelChoices = [
  ['none', 'None', 'no practical experience.'],
  ['basic', 'Basic', 'can perform bounded tasks with support.'],
  ['independent', 'Independent', 'can use it in real work without regular supervision.'],
  ['advanced', 'Advanced', 'can solve complex cases and guide others.']
];
const presenceChoices = [['none', 'No', 'not present.'], ['present', 'Yes', 'present.']];
function profileFactControls(fact, editable) {
  if (!editable) return `<div class="profile-known"><span>${escape(fact.label)}</span><strong>${escape(fact.value)}</strong></div>`;
  const choices = fact.mode === 'presence' ? presenceChoices : levelChoices;
  const selectedValue = Object.hasOwn(profileSelections, fact.key) ? profileSelections[fact.key] : fact.value;
  return `<fieldset class="profile-fact"><legend>${escape(fact.label)}</legend><div class="profile-choices">${choices.map(([value, label, description]) => `<button type="button" data-profile-key="${escape(fact.key)}" data-profile-value="${value}" aria-pressed="${selectedValue === value}" aria-label="${label}: ${description}"><strong>${label}</strong><small>${description}</small></button>`).join('')}</div></fieldset>`;
}
function renderProfile(review) {
  const pending = profileFilter === 'pending';
  $('#view-heading h1').textContent = pending ? 'Complete your profile' : 'Your profile';
  $('#view-heading p').textContent = pending ? 'Answer facts that active jobs need to evaluate.' : 'Review and change facts already in your profile.';
  $('#tabs').innerHTML = `<button data-tab="pending" class="tab ${pending ? 'active' : ''}" aria-pressed="${pending}">Needs info <span>${review.pendingCount}</span></button><button data-tab="all" class="tab ${!pending ? 'active' : ''}" aria-pressed="${!pending}">All facts <span>${review.allFacts.length}</span></button>`;
  const items = pending ? review.items : review.allFacts.map(fact => {
    const source = review.items.find(item => item.facts.some(candidate => candidate.key === fact.key));
    return { id: `all:${fact.key}`, label: fact.label, activeJobCount: source?.activeJobCount || 0, facts: [fact], jobs: source?.jobs || [] };
  });
  const query = $('#search').value.trim().toLowerCase();
  const filtered = items.filter(item => `${item.label} ${item.facts.map(fact => fact.label).join(' ')}`.toLowerCase().includes(query));
  if (!filtered.some(item => item.id === profileSelected)) profileSelected = filtered[0]?.id || null;
  $('#count').textContent = pending ? `${review.pendingCount} facts need info` : `${filtered.length} profile facts`;
  $('#clear-discovery').hidden = true;
  if (pending && !items.length) {
    $('#jobs').innerHTML = `<div class="empty"><h2>Your profile is complete</h2><p>${review.activeUnmappedJobs ? '<span>Some active jobs still need tag review.</span> Those criteria cannot be answered in Profile.' : 'No active job is waiting for profile information.'}</p></div>`;
    $('#detail').innerHTML = '<div class="empty">New questions can appear after processing a job or reviewing its tags.</div>';
    return;
  }
  $('#jobs').innerHTML = filtered.map(item => `<article class="job profile-item ${item.id === profileSelected ? 'selected' : ''}"><button class="job-open" data-profile-item="${escape(item.id)}"><span class="job-copy"><span class="list-top"><span class="company">${item.facts.length} ${item.facts.length === 1 ? 'fact' : 'facts'}</span>${item.activeJobCount ? `<span class="profile-impact">${item.activeJobCount} active ${item.activeJobCount === 1 ? 'job' : 'jobs'}</span>` : ''}</span><span class="list-title"><h2>${escape(item.label)}</h2></span></span></button></article>`).join('') || '<div class="empty"><h2>No matching facts</h2><p>Try a different search.</p></div>';
  const item = items.find(candidate => candidate.id === profileSelected);
  if (!item) { $('#detail').innerHTML = '<div class="empty">Select a fact to see its details.</div>'; return; }
  const editableFacts = pending ? item.facts.filter(fact => fact.pending) : item.facts;
  const knownFacts = pending ? item.facts.filter(fact => !fact.pending) : [];
  const jobs = profileShowAll ? item.jobs : item.jobs.slice(0, 3);
  const jobContext = item.jobs.length ? `<section class="profile-jobs"><h3>Affected jobs</h3>${jobs.map(job => `<button data-profile-job="${escape(job.id)}"><span><strong>${escape(job.title)}</strong><small>${escape(job.company)} · ${escape(job.reference)}</small></span>${ratingBadge(job.score, 'Weighted priority score')}${job.quotes?.length ? `<q>${escape(job.quotes.join(' · '))}</q>` : ''}</button>`).join('')}${item.jobs.length > 3 && !profileShowAll ? '<button class="profile-show-all" data-profile-show-all>Show all</button>' : ''}</section>` : '';
  $('#detail').innerHTML = `<div class="profile-detail"><h2>${escape(item.label)}</h2><p class="muted">${pending ? 'Choose an answer for every missing fact.' : 'Change the saved value for this fact.'}</p>${editableFacts.map(fact => profileFactControls(fact, true)).join('')}${knownFacts.length ? `<section class="profile-known-list"><h3>Already known</h3>${knownFacts.map(fact => profileFactControls(fact, false)).join('')}</section>` : ''}${jobContext}<p id="profile-error" role="alert"></p><button class="primary profile-save" data-profile-save>${pending ? 'Save and continue' : 'Save change'}</button></div>`;
}
function jobActions(job) {
  const closed = job.availability?.status === 'closed';
  const more = `<details class="detail-more"><summary aria-label="More actions" title="More actions">···</summary><div class="detail-menu"><button data-availability="${closed ? 'open' : 'closed'}" aria-pressed="${closed}">Closed</button></div></details>`;
  if (job.application) return `<div class="detail-actions detail-actions-minimal">${more}</div>`;
  const interested = job.status === 'interesting';
  const dismissed = job.status === 'dismissed';
  const dismiss = dismissed
    ? `<button class="dismissed-active" data-status="${escape(job.reviewStatusBeforeDismissal || 'new')}" aria-pressed="true" title="Undo dismissal">Dismissed</button>`
    : `<button data-reject="${escape(job.id)}" aria-pressed="false">Dismiss</button>`;
  return `<div class="detail-actions"><button class="${interested ? 'primary' : ''}" data-status="${interested ? 'new' : 'interesting'}" aria-pressed="${interested}">Interested</button>${dismiss}<button data-app-start>Applied</button>${more}</div>`;
}
const stageLabels = { applied: 'Applied', interviewing: 'Interviewing', 'offer-received': 'Offer received', rejected: 'Rejected', withdrawn: 'Withdrawn', 'no-response': 'No response', accepted: 'Accepted' };
const localDate = value => { const date = value ? new Date(value) : new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const localTime = value => { const date = new Date(value); return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; };
const offsetTime = value => { const date = new Date(value); const offset = -date.getTimezoneOffset(); const sign = offset < 0 ? '-' : '+'; const minutes = Math.abs(offset); return `${value}:00${sign}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };
const shownDate = value => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleString(undefined, value.length === 10 ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }) : '';
function renderApplications() {
  const tracked = data.jobs.filter(job => job.application);
  const activeJobs = tracked.filter(job => !job.applicationView?.closed);
  const closedJobs = tracked.filter(job => job.applicationView?.closed);
  $('#tabs').innerHTML = `<button data-tab="active" class="tab ${applicationFilter === 'active' ? 'active' : ''}" aria-pressed="${applicationFilter === 'active'}">Active <span>${activeJobs.length}</span></button><button data-tab="closed" class="tab ${applicationFilter === 'closed' ? 'active' : ''}" aria-pressed="${applicationFilter === 'closed'}">Closed <span>${closedJobs.length}</span></button>`;
  const query = $('#search').value.toLowerCase();
  const jobs = (applicationFilter === 'active' ? activeJobs : closedJobs).filter(job => `${job.reference} ${job.id} ${job.title} ${job.company}`.toLowerCase().includes(query))
    .sort((a, b) => (a.applicationView.priority - b.applicationView.priority) || (a.applicationView.nextAt || '').localeCompare(b.applicationView.nextAt || '') || a.company.localeCompare(b.company));
  if (!jobs.some(job => job.id === selected)) selected = jobs[0]?.id;
  $('#count').textContent = `${jobs.length} ${applicationFilter === 'active' ? 'active applications' : 'closed applications'}`;
  $('#clear-discovery').hidden = true;
  $('#jobs').innerHTML = jobs.map(job => `<article class="job ${job.id === selected ? 'selected' : ''}"><button class="job-open" data-open="${escape(job.id)}"><span class="job-copy"><span class="list-top"><span class="company">${escape(job.company || 'Company not provided')}</span><span class="application-stage">${escape(stageLabels[job.applicationView.stage])}</span></span><span class="list-title"><h2>${escape(job.title)}</h2></span><span class="list-footer"><span class="muted">${escape(job.applicationView.nextAction || stageLabels[job.applicationView.stage])}${job.applicationView.nextAt ? ` · ${escape(shownDate(job.applicationView.nextAt))}` : ''}</span><span class="list-reference">${escape(job.reference)}</span></span></span></button></article>`).join('') || `<div class="empty"><h2>${applicationFilter === 'active' && !tracked.length ? 'No applications yet' : 'No applications here'}</h2><p>${applicationFilter === 'active' && !tracked.length ? 'Use Applied from Jobs to start tracking one.' : 'Try another filter or search.'}</p></div>`;
  const job = data.jobs.find(item => item.id === selected);
  $('#detail').innerHTML = job ? applicationDetail(job) : '<div class="empty">Select an application to see its progress.</div>';
}
function applicationDetail(job) {
  const application = job.application, progress = job.applicationView;
  const timeline = [application.submission, ...application.events].map(event => {
    const label = event.type === 'submission' ? 'Application submitted' : event.type === 'interview' ? `${event.name} · ${event.state === 'needs-scheduling' ? 'Needs scheduling' : event.state === 'scheduled' ? 'Scheduled' : 'Completed'}` : event.type === 'reopen' ? 'Process reopened' : stageLabels[event.outcome];
    const when = event.type === 'interview' ? event.scheduledAt || event.completedAt : event.date || event.at;
    return `<li><span><strong>${escape(label)}</strong>${when ? `<small>${escape(shownDate(when))}</small>` : ''}${event.note ? `<p>${escape(event.note)}</p>` : ''}</span>${event.type === 'reopen' ? '' : `<button data-app-${event.type === 'submission' ? 'submission' : 'edit'}${event.id ? `="${escape(event.id)}"` : ''} aria-label="Edit ${escape(label)}">Edit</button>`}</li>`;
  }).join('');
  const correction = application.events.length ? '' : '<details class="detail-more"><summary aria-label="More actions" title="More actions">···</summary><div class="detail-menu"><button data-app-undo>Not applied</button></div></details>';
  return `<div class="detail-head"><a class="external detail-link" href="${escape(job.url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><div class="detail-title"><h2>${escape(job.title)}</h2></div><p class="muted">${escape(job.company || 'Company not provided')} · ${escape(job.reference)}</p></div><div class="application-progress"><span class="application-stage">${escape(stageLabels[progress.stage])}</span><strong>${escape(progress.nextAction || stageLabels[progress.stage])}</strong>${progress.nextAt ? `<span>${escape(shownDate(progress.nextAt))}</span>` : ''}</div><div class="actions application-actions">${progress.closed ? '<button class="primary" data-app-reopen>Reopen process</button>' : '<button class="primary" data-app-update>Update progress</button>'}${correction}</div><h3>Timeline</h3><ol class="application-timeline">${timeline}</ol>`;
}
function setApplicationFields() {
  const action = $('#application-action').value;
  const isSubmit = action === 'submit' || action === 'update-submission';
  const isInterview = action === 'add-interview' || action === 'update-interview';
  $('#application-action-label').hidden = $('#application-action').hidden = isSubmit || action.startsWith('update-');
  $('#interview-fields').hidden = !isInterview;
  $('#outcome-field').hidden = action !== 'outcome' && action !== 'update-outcome';
  $('#application-date-field').hidden = isInterview && $('#interview-state').value !== 'completed';
  $('#interview-time-field').hidden = !isInterview || $('#interview-state').value !== 'scheduled';
  $('#application-note-field').hidden = isSubmit;
  $('#interview-name').required = isInterview;
  $('#interview-time').required = isInterview && $('#interview-state').value === 'scheduled';
  $('#application-date').required = !$('#application-date-field').hidden;
}
function openApplicationDialog(action, eventId = null) {
  const job = data.jobs.find(item => item.id === selected);
  const event = eventId ? job.application?.events.find(item => item.id === eventId) : null;
  editingEvent = event || null;
  $('#application-form').reset();
  $('#application-action').value = action === 'edit' ? (event.type === 'interview' ? 'update-interview' : 'update-outcome') : action;
  $('#application-title').textContent = action === 'submit' ? 'Applied' : action === 'submission' ? 'Edit application date' : action === 'edit' ? 'Edit update' : 'Update progress';
  if (action === 'submission') $('#application-action').value = 'update-submission';
  $('#application-save').textContent = action === 'submit' ? 'Save application' : 'Save update';
  $('#application-date').value = action === 'submission' ? job.application.submission.date : event?.date || event?.completedAt || localDate();
  $('#interview-name').value = event?.name || '';
  $('#interview-state').value = event?.state || 'needs-scheduling';
  $('#interview-time').value = event?.scheduledAt ? localTime(event.scheduledAt) : '';
  $('#application-outcome').value = event?.outcome || 'rejected';
  $('#application-note').value = event?.note || '';
  $('#application-remove').hidden = !event;
  $('#application-error').textContent = '';
  setApplicationFields();
  $('#application-dialog').showModal();
}
$('#application-action').onchange = setApplicationFields;
$('#interview-state').onchange = setApplicationFields;
$('#application-cancel').onclick = () => $('#application-dialog').close();
$('#application-form').onsubmit = async event => {
  event.preventDefault();
  const action = $('#application-action').value;
  const change = { type: action };
  if (action === 'submit' || action === 'update-submission') change.date = $('#application-date').value;
  if (action === 'add-interview' || action === 'update-interview') Object.assign(change, { name: $('#interview-name').value, state: $('#interview-state').value, note: $('#application-note').value, ...(editingEvent ? { eventId: editingEvent.id } : {}) });
  if (change.state === 'scheduled') change.scheduledAt = offsetTime($('#interview-time').value);
  if (change.state === 'completed') change.completedAt = $('#application-date').value;
  if (action === 'outcome' || action === 'update-outcome') Object.assign(change, { outcome: $('#application-outcome').value, date: $('#application-date').value, note: $('#application-note').value, ...(editingEvent ? { eventId: editingEvent.id } : {}) });
  try { await api('/api/application', { id: selected, change }); $('#application-dialog').close(); await refresh(); }
  catch (err) { $('#application-error').textContent = err.message; }
};
$('#application-remove').onclick = async () => {
  if (!editingEvent || !confirm('Remove this update?')) return;
  try { await api('/api/application', { id: selected, change: { type: 'remove-event', eventId: editingEvent.id } }); $('#application-dialog').close(); await refresh(); }
  catch (err) { $('#application-error').textContent = err.message; }
};
$('#views').onclick = event => { const button = event.target.closest('[data-view]'); if (button) { view = button.dataset.view; selected = null; $('#search').value = ''; render(); } };
$('#tabs').onclick = event => { const tab = event.target.closest('[data-tab]'); if (tab) { if (view === 'applications') applicationFilter = tab.dataset.tab; else if (view === 'profile') { profileFilter = tab.dataset.tab; profileSelected = null; } else active = tab.dataset.tab; render(); } };
$('#search').oninput = render;
$('#jobs').onclick = event => {
  const profileItem = event.target.closest('[data-profile-item]');
  if (profileItem) { profileSelected = profileItem.dataset.profileItem; profileShowAll = false; render(); return; }
  const item = event.target.closest('[data-open]');
  if (item) { selected = item.dataset.open; render(); }
};
$('#detail').onclick = async event => {
  if (view === 'profile') {
    const choice = event.target.closest('[data-profile-value]');
    if (choice) { profileSelections[choice.dataset.profileKey] = choice.dataset.profileValue; render(); return; }
    if (event.target.closest('[data-profile-show-all]')) { profileShowAll = true; render(); return; }
    const job = event.target.closest('[data-profile-job]');
    if (job) { view = 'opportunities'; active = 'all'; selected = job.dataset.profileJob; $('#search').value = ''; render(); return; }
    if (event.target.closest('[data-profile-save]')) {
      const review = data.profileReview;
      const allFact = review.allFacts.find(fact => `all:${fact.key}` === profileSelected);
      const item = profileFilter === 'pending' ? review.items.find(candidate => candidate.id === profileSelected) : allFact && { facts: [allFact] };
      const editable = profileFilter === 'pending' ? item?.facts.filter(fact => fact.pending) || [] : item?.facts || [];
      const changes = editable.map(fact => ({ key: fact.key, value: profileSelections[fact.key] ?? fact.value })).filter(change => change.value != null);
      if (changes.length !== editable.length) { $('#profile-error').textContent = 'Choose an answer for every fact before saving.'; return; }
      try {
        await api('/api/profile', { changes });
        for (const fact of editable) delete profileSelections[fact.key];
        profileSelected = null;
        profileShowAll = false;
        await refresh();
      } catch (err) { $('#profile-error').textContent = err.message; }
    }
    return;
  }
  const copy = event.target.closest('[data-copy-id]');
  if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copyId); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = copy.dataset.copyId; }, 900); } catch { error(new Error('Could not copy the job ID.')); } return; }
  const source = event.target.closest('[data-source]');
  if (source) { const quote = document.getElementById(`source-${source.dataset.source}`); quote.hidden = !quote.hidden; source.setAttribute('aria-expanded', String(!quote.hidden)); return; }
  const reject = event.target.closest('[data-reject]');
  if (reject) { rejecting = selected; const job = data.jobs.find(j => j.id === rejecting); $('#reject-title').textContent = job.title; $('#reason').value = job.reason; $('#reject-dialog').showModal(); return; }
  if (event.target.closest('[data-app-start]')) { openApplicationDialog('submit'); return; }
  if (event.target.closest('[data-app-update]')) { openApplicationDialog('add-interview'); return; }
  if (event.target.closest('[data-app-reopen]')) { try { await api('/api/application', { id: selected, change: { type: 'reopen' } }); applicationFilter = 'active'; await refresh(); } catch (err) { error(err); } return; }
  const edit = event.target.closest('[data-app-edit]');
  if (edit) { openApplicationDialog('edit', edit.dataset.appEdit); return; }
  if (event.target.closest('[data-app-undo]')) {
    if (!confirm('Remove this application from JobQueue? This only corrects the tracker.')) return;
    const job = data.jobs.find(item => item.id === selected);
    const previousStatus = job.application?.previousReview?.status || job.status || 'new';
    try { await api('/api/application', { id: selected, change: { type: 'undo-submit' } }); view = 'opportunities'; active = previousStatus; await refresh(); }
    catch (err) { error(err); }
    return;
  }
  if (event.target.closest('[data-app-submission]')) { openApplicationDialog('submission'); return; }
  const button = event.target.closest('[data-status]');
  if (button) { try { await api('/api/review', { id: selected, status: button.dataset.status }); await refresh(); } catch (err) { error(err); } }
  const availability = event.target.closest('[data-availability]');
  if (availability) { try { await api('/api/availability', { id: selected, status: availability.dataset.availability }); await refresh(); } catch (err) { error(err); } }
};
$('#cancel').onclick = () => $('#reject-dialog').close();
$('#reject-form').onsubmit = async event => { event.preventDefault(); try { await api('/api/review', { id: rejecting, status: 'dismissed', reason: $('#reason').value }); $('#reject-dialog').close(); await refresh(); } catch (err) { error(err); } };
$('#scan').onclick = async () => { try { $('#error').textContent = ''; await api('/api/scan', {}); await refresh(); } catch (err) { error(err); } };
$('#summarize').onclick = async () => { try { $('#error').textContent = ''; await api('/api/summarize', { id: selected }); await refresh(); } catch (err) { error(err); } };
initSearches(api, refresh, search => { discoveryFilter = search; view = 'opportunities'; active = 'all'; $('#search').value = ''; render(); });
$('#clear-discovery').onclick = () => { discoveryFilter = null; render(); };
refresh().catch(error);
setInterval(() => { if (data.scan?.running || data.ai?.running || data.connection?.running) refresh().catch(error); }, 3000);

function summaryHTML(job) {
  if (!job.summary) return provenanceHTML(job) + `<p class="muted">${job.description ? 'Summary pending. Use Process pending to prepare decision cards.' : 'Description not captured yet.'}</p>`;
  const roleFit = [['roleFocus', 'Role focus'], ['requirements', 'Requirements'], ['preferred', 'Nice to have'], ['experience', 'Experience'], ['stack', 'Company stack'], ['language', 'Language']];
  const opportunity = [['salary', 'Salary'], ['companyType', 'Company type'], ['project', 'Project'], ['culture', 'Work culture']];
  const workConditions = [['workplace', 'Work mode']];
  if (job.summary.fields.workCountry) workConditions.push(['workCountry', 'Work country']);
  if (job.summary.fields.timezoneOverlap) workConditions.push(['timezoneOverlap', 'Time overlap']);
  if (job.summary.fields.visaSupport || data.preferences?.relocation?.countries?.includes(job.summary.fields.workCountry?.value)) workConditions.push(['visaSupport', 'Visa support']);
  if (job.summary.fields.relocationFunding) workConditions.push(['relocationFunding', 'Moving expenses']);
  const row = ([key, label]) => {
    const fact = job.summary.fields[key];
    const rating = job.rating.fields[key] || { score: 0, reason: 'Neutral' };
    const tags = job.tags?.[key];
    const workplaceDetail = job.summary.fields.workCountry || job.summary.fields.timezoneOverlap ? '' : (fact?.value || job.location || '');
    if (key === 'stack' && !tags?.length) return '';
    return `<div class="fact-row"><dt><span>${label}</span>${['requirements', 'preferred', 'experience', 'stack'].includes(key) && tags?.length ? coverageBadge(tags, rating) : contributionBadge(rating)}</dt><dd><span>${key === 'roleFocus' ? `<strong>${escape(roleFocus(job, data.preferences).label)}</strong>` : key === 'workplace' ? `<strong>${escape(workplaceMode(job, data.preferences).label)}</strong>${workplaceDetail ? `<span class="workplace-detail">${escape(workplaceDetail)}</span>` : ''}` : tags?.length ? tagsHTML(tags, key) : key === 'salary' && job.monthlySalary ? salaryHTML(job) : key === 'project' && fact ? projectHTML(fact.value) : fact ? escape(fact.value) : '<span class="muted">Not stated</span>'}${key === 'project' && job.projectTags?.length ? tagsHTML(job.projectTags, 'project') : ''}${key === 'companyType' && job.summary.fields.client ? `<small class="client-context">Client: ${escape(job.summary.fields.client.value)} <button class="source-toggle" aria-label="Client source" aria-expanded="false" data-source="client">Source</button></small>` : ''}</span><span class="field-tools">${fact ? `<button class="source-toggle" aria-label="Source for ${label}" aria-expanded="false" data-source="${key}">Source</button>` : ''}</span>${key === 'companyType' && job.summary.fields.client ? `<blockquote id="source-client" class="source-quote" hidden>${escape(job.summary.fields.client.evidence)}</blockquote>` : ''}${fact ? `<blockquote id="source-${key}" class="source-quote" hidden>${escape(fact.evidence)}</blockquote>` : ''}</dd></div>`;
  };
  const group = (label, entries) => `<section class="fact-group"><h3>${label}</h3><dl>${entries.map(row).join('')}</dl></section>`;
  return provenanceHTML(job) + `<div class="facts">${group('Role fit', roleFit)}${group('Opportunity', opportunity)}${group('Work conditions', workConditions)}</div>`;
}

function ratingBadge(score, reason) { const value = score === null ? '—' : Number(score.toFixed(2)).toString(); return `<span class="rating ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'}" title="${escape(reason)}" aria-label="${escape(reason)}: ${score ?? 'unrated'}">${score > 0 ? '+' : ''}${value}</span>`; }

function evaluationBadge(evaluation = {}) {
  const status = evaluation.status || 'pending-analysis';
  const labels = { complete: 'Complete', 'needs-info': `Needs info · ${evaluation.resolved ?? 0}/${evaluation.total ?? 0}`, 'pending-analysis': 'Pending analysis' };
  return `<span class="processing-state state-${status}"><i aria-hidden="true"></i>${labels[status]}</span>`;
}

function contributionBadge(rating) {
  const contribution = rating.contribution ?? rating.score;
  const reason = `${rating.reason} Weight ${rating.weight ?? 1}; contribution ${contribution > 0 ? '+' : ''}${contribution}.`;
  return ratingBadge(contribution, reason);
}

function publishedHTML(job) {
  if (!job.publishedAt) return '';
  const days = Math.max(0, Math.floor((Date.now() - job.publishedAt) / 86400000));
  const relative = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
  const rating = job.rating.fields.publishedRecency;
  return `<span class="published" title="${escape(new Date(job.publishedAt).toLocaleString())}">Published ${relative}${rating ? contributionBadge(rating) : ''}</span>`;
}

function projectHTML(value) {
  const parts = value.match(/^Software:\s*([\s\S]*?)\s+Work:\s*([\s\S]*)$/i);
  if (!parts) return escape(value);
  return `<span class="project-lines"><span><strong>Software:</strong> ${escape(parts[1])}</span><span><strong>Work:</strong> ${escape(parts[2])}</span></span>`;
}

function salaryHTML(job) {
  const salary = job.monthlySalary;
  const format = value => Math.round(value).toLocaleString('en-US');
  const range = value => `${format(value.min)}${value.max !== value.min ? '–' + format(value.max) : ''}`;
  const estimate = salary.assumption === 'Published monthly amount' ? '' : '≈ ';
  const qualifier = salary.qualifier ? ` ${salary.qualifier}` : '';
  return `<strong title="${escape(salary.assumption)}">${estimate}${salary.currency || '(currency unspecified)'} ${range(salary)}/month${qualifier}</strong>${salary.cop ? ` <span title="Converted ${salary.cop.date}">· ≈ COP ${range(salary.cop)}/month</span>` : salary.conversionUnavailable ? ' <small>COP rate unavailable</small>' : ''}`;
}

function tagsHTML(tags, group) {
  return '<span class="match-tags">' + tags.map(tag => {
    if (!tag.assessment) return `<span tabindex="0" class="match-tag ${tag.score > 0 ? 'positive' : tag.score < 0 ? 'negative' : 'neutral'}" title="${escape('Assessment: ' + tag.evidence + '\nOffer: ' + tag.source)}">${escape(tag.label)}</span>`;
    const required = group === 'requirements' || group === 'experience';
    const presentation = tag.assessment === 'match'
      ? { icon: '✓', className: 'assessment-match', meaning: 'Match' }
      : tag.assessment === 'no-match' && required
        ? { icon: '×', className: 'assessment-no-match-required', meaning: 'Required non-match' }
        : tag.assessment === 'no-match'
          ? { icon: '–', className: 'assessment-no-match-optional', meaning: 'Optional non-match' }
          : tag.assessment === 'unknown'
            ? { icon: '?', className: 'assessment-unknown', meaning: 'Profile information needed' }
            : { icon: '◇', className: 'assessment-unmapped', meaning: 'Unmapped' };
    const tooltip = tag.profileSummary?.join('\n') || (tag.assessment === 'unknown'
      ? 'Profile information missing'
      : tag.assessment === 'unmapped'
        ? 'Catalog mapping needed'
        : tag.assessment === 'match'
          ? 'Confirmed'
          : 'Not confirmed');
    const visibleLabel = required && tag.assessment === 'no-match' && tag.shortfall ? `${tag.label} · ${tag.shortfall.hint}` : tag.label;
    return `<span tabindex="0" class="match-tag ${presentation.className}" aria-label="${escape(tag.label + ': ' + presentation.meaning + '. ' + tooltip)}" title="${escape(tooltip)}"><b aria-hidden="true">${presentation.icon}</b>${escape(visibleLabel)}</span>`;
  }).join('') + '</span>';
}

function coverageBadge(tags, rating) { const matched = tags.filter(tag => tag.score === 1).length; return `<span class="score-parts"><span class="coverage" title="Backed profile matches">${matched}/${tags.length}</span>${contributionBadge(rating)}</span>`; }

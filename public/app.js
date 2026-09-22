import { compareJobs, workplaceMode, roleFocus } from '/rating.js';
import { initSearches, provenanceHTML } from '/searches.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let data = { jobs: [] }, active = 'new', selected, rejecting, view = 'opportunities', applicationFilter = 'active', editingEvent = null;
let discoveryFilter = null;
const labels = { new: 'New', interesting: 'Interesting', dismissed: 'Dismissed', all: 'All opportunities' };
async function api(url, body) { const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; }
function error(err) { $('#error').textContent = err.message; }
async function refresh() { data = await api('/api/jobs'); render(); }
function render() {
  const tracking = view === 'applications';
  for (const button of document.querySelectorAll('#views [data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  for (const id of ['searches-open', 'scan', 'summarize']) $(`#${id}`).hidden = tracking;
  $('#run-status').hidden = tracking;
  $('#ai-status').hidden = tracking;
  $('#jobs').setAttribute('aria-label', tracking ? 'Applications' : 'Opportunities');
  $('#detail').setAttribute('aria-label', tracking ? 'Application details' : 'Opportunity details');
  $('#search').placeholder = tracking ? 'Search applications or ID…' : 'Search offers or ID…';
  $('#search').setAttribute('aria-label', tracking ? 'Search applications' : 'Search opportunities');
  $('#tabs').setAttribute('aria-label', tracking ? 'Application status' : 'Opportunity status');
  if (tracking) { renderApplications(); return; }
  const reviewable = job => job.availability?.status !== 'closed' && !job.application;
  $('#tabs').innerHTML = Object.entries(labels).map(([key, label]) => `<button data-tab="${key}" class="tab ${active === key ? 'active' : ''}" aria-pressed="${active === key}">${label} <span>${data.jobs.filter(j => key === 'all' || (j.status === key && reviewable(j))).length}</span></button>`).join('');
  const query = $('#search').value.toLowerCase();
  const jobs = data.jobs.filter(j => (active === 'all' || (j.status === active && reviewable(j))) && (!discoveryFilter || j.discoveries?.some(d => d.search.provider === discoveryFilter.provider && d.search.id === discoveryFilter.id && d.search.revision === discoveryFilter.revision)) && `${j.reference} ${j.id} ${j.title} ${j.company} ${j.location}`.toLowerCase().includes(query)).sort(compareJobs);
  if (!jobs.some(j => j.id === selected)) selected = jobs[0]?.id;
  $('#count').textContent = `${jobs.length} opportunities${discoveryFilter ? ` · ${discoveryFilter.query}` : ''}`;
  $('#clear-discovery').hidden = !discoveryFilter;
  const enabled = data.searches?.searches?.filter(s => s.enabled) ?? [];
  $('#scan').disabled = data.scan?.running || data.connection?.running || !enabled.length;
  $('#summarize').disabled = data.ai?.running || !data.ai?.pending;
  const pendingCount = data.ai?.pending ?? 0;
  const nextBatch = Math.min(2, pendingCount);
  $('#summarize').innerHTML = data.ai?.running ? `<span class="spinner" aria-hidden="true"></span>${data.ai.processed}/${data.ai.total} ready` : `Process ${nextBatch} · ${pendingCount} pending`;
  $('#summarize').title = `Summarize the next ${nextBatch} of ${pendingCount} eligible offers using Codex`;
  $('#ai-status').textContent = data.ai?.error ? data.ai.message : '';
  $('#ai-status').classList.toggle('failure', !!data.ai?.error);
  $('#scan').innerHTML = data.scan?.running ? `<span class="spinner" aria-hidden="true"></span>${escape(/^Searching \d+\/\d+$/.test(data.scan.message) ? data.scan.message : 'Searching…')}` : 'Find opportunities';
  const scanStatus = data.scan?.running ? (data.scan.message === 'Sign in to LinkedIn' ? data.scan.message : '') : data.scan?.finishedAt ? (data.scan.error ? data.scan.message : `${data.scan.added ?? 0} offers added`) : '';
  const reviewStatus = data.catalogReview?.recommended && !data.scan?.running && !data.scan?.error && !data.ai?.running && !data.ai?.error && !data.connection?.running && !data.connection?.error
    ? `${data.catalogReview.pending} tag${data.catalogReview.pending === 1 ? '' : 's'} pending review` : '';
  $('#run-status').textContent = [scanStatus, reviewStatus].filter(Boolean).join(' · ');
  $('#run-status').title = $('#run-status').textContent;
  $('#scan').title = enabled.length ? (data.scan?.running && data.scan.query ? data.scan.query : `${enabled.length} LinkedIn searches`) : 'Enable a search in Searches';
  $('#run-status').classList.toggle('failure', !!data.scan?.error);
  $('#jobs').innerHTML = jobs.map(job => `<article class="job ${job.id === selected ? 'selected' : ''} ${job.availability?.status === 'closed' ? 'job-closed' : ''}"><button class="job-open" data-open="${job.id}"><span class="job-copy"><span class="list-top"><span class="company">${escape(job.company || 'Company not provided')}</span><span class="list-states">${evaluationBadge(job.evaluation)}${active === 'all' && job.application ? `<span class="application-stage">${escape(stageLabels[job.applicationView?.stage] || 'Applied')}</span>` : ''}${job.availability?.status === 'closed' ? '<span class="availability-state">Closed</span>' : ''}</span></span><span class="list-title"><h2>${escape(job.title)}</h2>${ratingBadge(job.rating.total, job.rating.total === null ? 'No current AI summary' : 'Weighted priority score')}</span><span class="list-footer"><span class="muted">${escape(job.location || 'Location not provided')}</span><span class="list-reference">${escape(job.reference)}</span></span></span></button></article>`).join('') || '<div class="empty"><h2>You’re all caught up.</h2><p>Try another tab, clear your search, or find more opportunities.</p></div>';
  const job = data.jobs.find(j => j.id === selected);
  $('#detail').innerHTML = job ? `<div class="detail-head"><a class="external detail-link" href="${escape(job.url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><div class="detail-title"><h2>${escape(job.title)}</h2>${ratingBadge(job.rating.total, 'Weighted priority score')}${job.availability?.status === 'closed' ? '<span class="availability-state">Closed</span>' : ''}</div><div class="detail-meta"><span>${escape(job.company || 'Company not provided')}</span>${publishedHTML(job)}<button class="detail-id" data-copy-id="${escape(job.reference)}" title="Copy offer ID">${escape(job.reference)}</button></div><div class="detail-actions"><button class="primary" data-status="interesting">${job.status === 'interesting' ? '✓ Interesting' : '☆ Interested'}</button><button data-reject="${job.id}">Dismiss</button><button data-app-start>${job.application ? 'View application' : 'Mark as applied'}</button><details class="detail-more"><summary aria-label="More actions" title="More actions">···</summary><div class="detail-menu">${job.status !== 'new' ? '<button data-status="new">Restore to new</button>' : ''}<button data-availability="${job.availability?.status === 'closed' ? 'open' : 'closed'}">${job.availability?.status === 'closed' ? 'Reopen' : 'Mark as closed'}</button></div></details></div></div>${evaluationSummary(job.evaluation)}${job.reason ? `<div class="feedback"><strong>Your feedback</strong><p>${escape(job.reason)}</p></div>` : ''}<hr>${summaryHTML(job)}<details class="original"><summary>Full description</summary><div class="description">${escape(job.description || 'Description not captured. Open LinkedIn for details.')}</div></details>` : '<div class="empty">Select an opportunity to see the details.</div>';
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
  $('#jobs').innerHTML = jobs.map(job => `<article class="job ${job.id === selected ? 'selected' : ''}"><button class="job-open" data-open="${escape(job.id)}"><span class="job-copy"><span class="list-top"><span class="company">${escape(job.company || 'Company not provided')}</span><span class="application-stage">${escape(stageLabels[job.applicationView.stage])}</span></span><span class="list-title"><h2>${escape(job.title)}</h2></span><span class="list-footer"><span class="muted">${escape(job.applicationView.nextAction || stageLabels[job.applicationView.stage])}${job.applicationView.nextAt ? ` · ${escape(shownDate(job.applicationView.nextAt))}` : ''}</span><span class="list-reference">${escape(job.reference)}</span></span></span></button></article>`).join('') || `<div class="empty"><h2>${applicationFilter === 'active' && !tracked.length ? 'No applications yet' : 'No applications here'}</h2><p>${applicationFilter === 'active' && !tracked.length ? 'Mark a job as applied from Opportunities to start tracking it.' : 'Try another filter or search.'}</p></div>`;
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
  return `<div class="detail-head"><a class="external detail-link" href="${escape(job.url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><div class="detail-title"><h2>${escape(job.title)}</h2></div><p class="muted">${escape(job.company || 'Company not provided')} · ${escape(job.reference)}</p></div><div class="application-progress"><span class="application-stage">${escape(stageLabels[progress.stage])}</span><strong>${escape(progress.nextAction || stageLabels[progress.stage])}</strong>${progress.nextAt ? `<span>${escape(shownDate(progress.nextAt))}</span>` : ''}</div><div class="actions">${progress.closed ? '<button class="primary" data-app-reopen>Reopen process</button>' : '<button class="primary" data-app-update>Update progress</button>'}${application.events.length ? '' : '<button data-app-undo>Undo applied</button>'}</div><h3>Timeline</h3><ol class="application-timeline">${timeline}</ol>`;
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
  $('#application-title').textContent = action === 'submit' ? 'Mark as applied' : action === 'submission' ? 'Edit application date' : action === 'edit' ? 'Edit update' : 'Update progress';
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
$('#tabs').onclick = event => { const tab = event.target.closest('[data-tab]'); if (tab) { if (view === 'applications') applicationFilter = tab.dataset.tab; else active = tab.dataset.tab; render(); } };
$('#search').oninput = render;
$('#jobs').onclick = event => { const item = event.target.closest('[data-open]'); if (item) { selected = item.dataset.open; render(); } };
$('#detail').onclick = async event => {
  const copy = event.target.closest('[data-copy-id]');
  if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copyId); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = copy.dataset.copyId; }, 900); } catch { error(new Error('Could not copy the offer ID.')); } return; }
  const source = event.target.closest('[data-source]');
  if (source) { const quote = document.getElementById(`source-${source.dataset.source}`); quote.hidden = !quote.hidden; source.setAttribute('aria-expanded', String(!quote.hidden)); return; }
  const reject = event.target.closest('[data-reject]');
  if (reject) { rejecting = selected; const job = data.jobs.find(j => j.id === rejecting); $('#reject-title').textContent = job.title; $('#reason').value = job.reason; $('#reject-dialog').showModal(); return; }
  if (event.target.closest('[data-app-start]')) { const job = data.jobs.find(j => j.id === selected); if (job.application) { view = 'applications'; applicationFilter = job.applicationView?.closed ? 'closed' : 'active'; render(); } else openApplicationDialog('submit'); return; }
  if (event.target.closest('[data-app-update]')) { openApplicationDialog('add-interview'); return; }
  if (event.target.closest('[data-app-reopen]')) { try { await api('/api/application', { id: selected, change: { type: 'reopen' } }); applicationFilter = 'active'; await refresh(); } catch (err) { error(err); } return; }
  const edit = event.target.closest('[data-app-edit]');
  if (edit) { openApplicationDialog('edit', edit.dataset.appEdit); return; }
  if (event.target.closest('[data-app-undo]')) { try { await api('/api/application', { id: selected, change: { type: 'undo-submit' } }); await refresh(); } catch (err) { error(err); } return; }
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
  const names = { roleFocus: 'Role focus', salary: 'Salary', companyType: 'Company type', requiredTechnologies: 'Requirements', preferredTechnologies: 'Nice to have', experience: 'Experience', language: 'Language', workplace: 'Work mode', project: 'Project', culture: 'Work culture' };
  if (job.summary.fields.workCountry) names.workCountry = 'Work country';
  if (job.summary.fields.visaSupport || data.preferences?.relocation?.countries?.includes(job.summary.fields.workCountry?.value)) names.visaSupport = 'Visa support';
  if (job.summary.fields.relocationFunding) names.relocationFunding = 'Moving expenses';
  return provenanceHTML(job) + '<dl class="facts">' + Object.entries(names).map(([key, label]) => {
    const fact = job.summary.fields[key];
    const rating = job.rating.fields[key] || { score: 0, reason: 'Neutral' };
    return `<div><dt><span>${label}</span>${['requiredTechnologies', 'preferredTechnologies', 'experience'].includes(key) && job.tags?.[key]?.length ? coverageBadge(job.tags[key], rating) : contributionBadge(rating)}</dt><dd><span>${key === 'roleFocus' ? `<strong>${escape(roleFocus(job, data.preferences).label)}</strong>` : key === 'workplace' ? `<strong>${escape(workplaceMode(job, data.preferences).label)}</strong><span class="workplace-detail">${escape(fact?.value || job.location || '')}</span>` : job.tags?.[key]?.length ? tagsHTML(job.tags[key], key) : key === 'salary' && job.monthlySalary ? salaryHTML(job) : key === 'project' && fact ? projectHTML(fact.value) : fact ? escape(fact.value) : '<span class="muted">Not stated</span>'}${key === 'project' && job.projectTags?.length ? tagsHTML(job.projectTags, 'project') : ''}${key === 'companyType' && job.summary.fields.client ? `<small class="client-context">Client: ${escape(job.summary.fields.client.value)} <button class="source-toggle" aria-label="Client source" aria-expanded="false" data-source="client">Source</button></small>` : ''}</span><span class="field-tools">${fact ? `<button class="source-toggle" aria-label="Source for ${label}" aria-expanded="false" data-source="${key}">Source</button>` : ''}</span>${key === 'companyType' && job.summary.fields.client ? `<blockquote id="source-client" class="source-quote" hidden>${escape(job.summary.fields.client.evidence)}</blockquote>` : ''}${fact ? `<blockquote id="source-${key}" class="source-quote" hidden>${escape(fact.evidence)}</blockquote>` : ''}</dd></div>`;
  }).join('') + (job.tags?.stack?.length ? `<div><dt><span>Company stack</span>${coverageBadge(job.tags.stack, job.rating.fields.stack)}</dt><dd>${tagsHTML(job.tags.stack, 'stack')}</dd></div>` : '') + '</dl>';
}

function ratingBadge(score, reason) { const value = score === null ? '—' : Number(score.toFixed(2)).toString(); return `<span class="rating ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'}" title="${escape(reason)}" aria-label="${escape(reason)}: ${score ?? 'unrated'}">${score > 0 ? '+' : ''}${value}</span>`; }

function evaluationBadge(evaluation = {}) {
  const status = evaluation.status || 'pending-analysis';
  const labels = { complete: 'Complete', 'needs-info': `Needs info · ${evaluation.resolved ?? 0}/${evaluation.total ?? 0}`, 'pending-analysis': 'Pending analysis' };
  return `<span class="processing-state state-${status}"><i aria-hidden="true"></i>${labels[status]}</span>`;
}

function evaluationSummary(evaluation = {}) {
  if (evaluation.status === 'complete') return '<p class="evaluation-summary">Evaluation · Complete</p>';
  if (evaluation.status !== 'needs-info') return '<p class="evaluation-summary">Evaluation · Pending analysis</p>';
  const segments = [`${evaluation.resolved}/${evaluation.total} resolved`];
  if (evaluation.profileGaps) segments.push(`${evaluation.profileGaps} profile gap${evaluation.profileGaps === 1 ? '' : 's'}`);
  if (evaluation.unmapped) segments.push(`${evaluation.unmapped} unmapped`);
  return `<p class="evaluation-summary">Evaluation · ${segments.join(' · ')}</p>`;
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
    const required = group === 'requiredTechnologies' || group === 'experience';
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

import { compareJobs, workplaceMode, roleFocus } from '/rating.js';
import { initSearches, provenanceHTML } from '/searches.js';
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let data = { jobs: [] }, active = 'new', selected, rejecting;
let discoveryFilter = null;
const labels = { new: 'New', interesting: 'Interesting', dismissed: 'Dismissed', all: 'All opportunities' };
async function api(url, body) { const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; }
function error(err) { $('#error').textContent = err.message; }
async function refresh() { data = await api('/api/jobs'); render(); }
function render() {
  $('#tabs').innerHTML = Object.entries(labels).map(([key, label]) => `<button data-tab="${key}" class="tab ${active === key ? 'active' : ''}" aria-pressed="${active === key}">${label} <span>${data.jobs.filter(j => key === 'all' || j.status === key).length}</span></button>`).join('');
  const query = $('#search').value.toLowerCase();
  const jobs = data.jobs.filter(j => (active === 'all' || j.status === active) && (!discoveryFilter || j.discoveries?.some(d => d.search.provider === discoveryFilter.provider && d.search.id === discoveryFilter.id && d.search.revision === discoveryFilter.revision)) && `${j.reference} ${j.id} ${j.title} ${j.company} ${j.location}`.toLowerCase().includes(query)).sort(compareJobs);
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
  $('#run-status').textContent = data.scan?.running ? (data.scan.message === 'Sign in to LinkedIn' ? data.scan.message : '') : data.scan?.finishedAt ? (data.scan.error ? data.scan.message : `${data.scan.added ?? 0} offers added`) : '';
  $('#run-status').title = $('#run-status').textContent;
  $('#scan').title = enabled.length ? (data.scan?.running && data.scan.query ? data.scan.query : `${enabled.length} LinkedIn searches`) : 'Enable a search in Searches';
  $('#run-status').classList.toggle('failure', !!data.scan?.error);
  $('#jobs').innerHTML = jobs.map(job => `<article class="job ${job.id === selected ? 'selected' : ''}"><button class="job-open" data-open="${job.id}"><span class="job-copy"><span class="list-top"><span class="company">${escape(job.company || 'Company not provided')}</span>${processingBadge(job.processingStatus)}</span><span class="list-title"><h2>${escape(job.title)}</h2>${ratingBadge(job.rating.total, job.rating.total === null ? 'No current AI summary' : 'Weighted priority score')}</span><span class="list-footer"><span class="muted">${escape(job.location || 'Location not provided')}</span><span class="list-reference">${escape(job.reference)}</span></span></span></button></article>`).join('') || '<div class="empty"><h2>You’re all caught up.</h2><p>Try another tab, clear your search, or find more opportunities.</p></div>';
  const job = data.jobs.find(j => j.id === selected);
  $('#detail').innerHTML = job ? `<div class="detail-head"><a class="external detail-link" href="${escape(job.url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a><div class="detail-title"><h2>${escape(job.title)}</h2>${ratingBadge(job.rating.total, 'Weighted priority score')}</div><div class="detail-subrow"><div class="detail-meta"><span>${escape(job.company || 'Company not provided')}</span>${publishedHTML(job)}</div><div class="detail-controls"><div class="actions"><button class="primary" data-status="interesting">${job.status === 'interesting' ? '✓ Interesting' : '☆ Interested'}</button><button data-reject="${job.id}">Dismiss</button>${job.status !== 'new' ? '<button data-status="new">Restore to new</button>' : ''}</div><button class="detail-id" data-copy-id="${escape(job.reference)}" title="Copy offer ID">${escape(job.reference)}</button></div></div></div>${job.reason ? `<div class="feedback"><strong>Your feedback</strong><p>${escape(job.reason)}</p></div>` : ''}<hr>${summaryHTML(job)}<details class="original"><summary>Full description</summary><div class="description">${escape(job.description || 'Description not captured. Open LinkedIn for details.')}</div></details>` : '<div class="empty">Select an opportunity to see the details.</div>';
}
$('#tabs').onclick = event => { const tab = event.target.closest('[data-tab]'); if (tab) { active = tab.dataset.tab; render(); } };
$('#search').oninput = render;
$('#jobs').onclick = event => { const item = event.target.closest('[data-open]'); if (item) { selected = item.dataset.open; render(); } };
$('#detail').onclick = async event => {
  const copy = event.target.closest('[data-copy-id]');
  if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copyId); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = copy.dataset.copyId; }, 900); } catch { error(new Error('Could not copy the offer ID.')); } return; }
  const source = event.target.closest('[data-source]');
  if (source) { const quote = document.getElementById(`source-${source.dataset.source}`); quote.hidden = !quote.hidden; source.setAttribute('aria-expanded', String(!quote.hidden)); return; }
  const reject = event.target.closest('[data-reject]');
  if (reject) { rejecting = selected; const job = data.jobs.find(j => j.id === rejecting); $('#reject-title').textContent = job.title; $('#reason').value = job.reason; $('#reject-dialog').showModal(); return; }
  const button = event.target.closest('[data-status]');
  if (button) { try { await api('/api/review', { id: selected, status: button.dataset.status }); await refresh(); } catch (err) { error(err); } }
};
$('#cancel').onclick = () => $('#reject-dialog').close();
$('#reject-form').onsubmit = async event => { event.preventDefault(); try { await api('/api/review', { id: rejecting, status: 'dismissed', reason: $('#reason').value }); $('#reject-dialog').close(); await refresh(); } catch (err) { error(err); } };
$('#scan').onclick = async () => { try { $('#error').textContent = ''; await api('/api/scan', {}); await refresh(); } catch (err) { error(err); } };
$('#summarize').onclick = async () => { try { $('#error').textContent = ''; await api('/api/summarize', { id: selected }); await refresh(); } catch (err) { error(err); } };
initSearches(api, refresh, search => { discoveryFilter = search; active = 'all'; $('#search').value = ''; render(); });
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
    return `<div><dt><span>${label}</span>${['requiredTechnologies', 'preferredTechnologies', 'experience'].includes(key) && job.tags?.[key]?.length ? coverageBadge(job.tags[key], rating) : contributionBadge(rating)}</dt><dd><span>${key === 'roleFocus' ? `<strong>${escape(roleFocus(job, data.preferences).label)}</strong>` : key === 'workplace' ? `<strong>${escape(workplaceMode(job, data.preferences).label)}</strong><span class="workplace-detail">${escape(fact?.value || job.location || '')}</span>` : job.tags?.[key]?.length ? tagsHTML(job.tags[key]) : key === 'salary' && job.monthlySalary ? salaryHTML(job) : key === 'project' && fact ? projectHTML(fact.value) : fact ? escape(fact.value) : '<span class="muted">Not stated</span>'}${key === 'project' && job.projectTags?.length ? tagsHTML(job.projectTags) : ''}${key === 'companyType' && job.summary.fields.client ? `<small class="client-context">Client: ${escape(job.summary.fields.client.value)} <button class="source-toggle" aria-label="Client source" aria-expanded="false" data-source="client">Source</button></small>` : ''}</span><span class="field-tools">${fact ? `<button class="source-toggle" aria-label="Source for ${label}" aria-expanded="false" data-source="${key}">Source</button>` : ''}</span>${key === 'companyType' && job.summary.fields.client ? `<blockquote id="source-client" class="source-quote" hidden>${escape(job.summary.fields.client.evidence)}</blockquote>` : ''}${fact ? `<blockquote id="source-${key}" class="source-quote" hidden>${escape(fact.evidence)}</blockquote>` : ''}</dd></div>`;
  }).join('') + (job.tags?.stack?.length ? `<div><dt><span>Company stack</span></dt><dd>${tagsHTML(job.tags.stack)}</dd></div>` : '') + '</dl>';
}

function ratingBadge(score, reason) { const value = score === null ? '—' : Number(score.toFixed(2)).toString(); return `<span class="rating ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'}" title="${escape(reason)}" aria-label="${escape(reason)}: ${score ?? 'unrated'}">${score > 0 ? '+' : ''}${value}</span>`; }

function processingBadge(status) {
  const labels = { processed: 'Processed', pending: 'Pending', 'no-description': 'No description' };
  return `<span class="processing-state state-${status}"><i aria-hidden="true"></i>${labels[status] || 'Pending'}</span>`;
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

function tagsHTML(tags) {
  return '<span class="match-tags">' + tags.map(tag => `<span tabindex="0" class="match-tag ${tag.score > 0 ? 'positive' : tag.score < 0 ? 'negative' : 'neutral'}" title="${escape('Assessment: ' + tag.evidence + '\nOffer: ' + tag.source)}">${escape(tag.label)}</span>`).join('') + '</span>';
}

function coverageBadge(tags, rating) { const matched = tags.filter(tag => tag.score === 1).length; return `<span class="score-parts"><span class="coverage" title="Backed profile matches">${matched}/${tags.length}</span>${contributionBadge(rating)}</span>`; }

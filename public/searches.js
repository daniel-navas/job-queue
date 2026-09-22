const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const period = { any: 'Any date', day: 'Past 24 hours', week: 'Past week', month: 'Past month' };
const criteria = s => `${s.location} · ${s.workplace === 'remote' ? 'Remote' : 'Any work mode'} · ${period[s.datePosted] || 'Date not recorded'}`;
const listCriteria = s => [
  `Location: ${s.location}`,
  ...(s.workplace === 'remote' ? ['Work mode: Remote'] : []),
  ...(s.datePosted !== 'any' && period[s.datePosted] ? [`Date posted: ${period[s.datePosted]}`] : []),
].map(line => `<span>${escape(line)}</span>`).join('');

export function provenanceHTML(job) {
  const origins = job.discoveries ?? [];
  return `<details class="search-origin"><summary>Found via ${origins.length ? origins.map(d => escape(d.search.query)).join(' · ') : 'search not recorded'}</summary>${origins.map(({ search, firstSeen, lastSeen }) => `<div><strong>${escape(search.query)}</strong><small>${escape(criteria(search))}</small><small>${search.legacy ? 'Legacy record · exact discovery history unavailable' : `First found ${escape(firstSeen?.slice(0, 10))} · Last seen ${escape(lastSeen?.slice(0, 10))}`}</small><a href="${escape(search.url)}" target="_blank" rel="noopener noreferrer">Open saved search ↗</a></div>`).join('')}</details>`;
}

export function initSearches(api, refresh, filterOffers) {
  const dialog = document.createElement('dialog');
  dialog.id = 'searches-dialog'; dialog.setAttribute('aria-labelledby', 'searches-title');
  dialog.innerHTML = `<div class="searches-head"><h2 id="searches-title">Searches</h2><button type="button" id="searches-close" aria-label="Close searches">✕</button></div>
    <div id="searches-list-view"><div class="searches-provider"><strong>LinkedIn</strong><div class="actions"><button id="linkedin-connect" type="button" title="Open Chrome to sign in or renew the LinkedIn connection">Connect LinkedIn</button><button id="search-add" type="button">Add search</button></div></div><div id="searches-list"></div></div>
    <form id="search-editor" hidden><h3 id="search-editor-title">Edit search</h3>
      <label for="search-query">Query</label><textarea id="search-query" required maxlength="500" rows="2"></textarea>
      <label for="search-location">Location</label><input id="search-location" required maxlength="150">
      <div class="search-fields"><div><label for="search-workplace">Work mode</label><select id="search-workplace"><option value="any">Any</option><option value="remote">Remote</option></select></div><div><label for="search-date">Date posted</label><select id="search-date"><option value="month">Past month</option><option value="week">Past week</option><option value="day">Past 24 hours</option><option value="any">Any date</option></select></div></div>
      <p class="searches-note">Search intent does not confirm a job’s location or visa support.</p>
      <div class="actions"><button type="button" id="search-cancel">Cancel</button><button class="primary" type="submit">Save search</button></div>
    </form><p id="searches-error" role="alert"></p>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let state, editing, editVersion, busy = false;
  let connectionTimer;
  const message = error => { $('#searches-error').textContent = error?.message || ''; };
  function render() {
    $('#searches-list').innerHTML = state.searches.map(search => {
      const stats = state.stats?.find(s => s.id === search.id && s.provider === search.provider) ?? {};
      return `<div class="search-row"><input type="checkbox" data-enable="${escape(search.id)}" aria-label="Enable ${escape(search.query)}" ${search.enabled ? 'checked' : ''}>
        <div class="search-copy"><strong>${escape(search.query)}</strong>${listCriteria(search)}</div>
        <div class="search-metrics"><button data-offers="${escape(search.id)}" title="Show jobs found with these criteria">${stats.captured ?? 0} jobs</button><small>${stats.processed ?? 0} processed · avg ${stats.meanRating ?? '—'}</small><small>${stats.exclusive ?? 0} exclusive · ${stats.interesting ?? 0} interested</small><small>${stats.runs ? `${stats.runs} runs · last ${escape(stats.lastRun?.capturedAt?.slice(0, 10))}${stats.lastRun?.status !== 'complete' ? ' · interrupted' : ''}` : 'Not run yet'}${stats.historicalCaptured > stats.captured ? ` · ${stats.historicalCaptured} across all criteria` : ''}</small></div>
        <button class="search-edit" data-edit="${escape(search.id)}" aria-label="Edit ${escape(search.query)}">Edit</button></div>`;
    }).join('') || '<p class="muted">Add your first LinkedIn search.</p>';
  }
  async function loadConnection() {
    clearTimeout(connectionTimer);
    const connection = await api('/api/linkedin/connection');
    $('#linkedin-connect').disabled = connection.running;
    $('#linkedin-connect').textContent = connection.running ? 'Connecting…' : connection.connected ? 'Reconnect LinkedIn' : 'Connect LinkedIn';
    if (connection.error) message(new Error(connection.error));
    if (connection.running && dialog.open) connectionTimer = setTimeout(() => loadConnection().catch(message), 2000);
  }
  async function load() { state = await api('/api/searches'); render(); await loadConnection(); }
  function showEditor(search) {
    editing = search; editVersion = state.version;
    $('#searches-list-view').hidden = true; $('#search-editor').hidden = false;
    $('#search-editor-title').textContent = search ? 'Edit search' : 'Add search';
    for (const key of ['query', 'location', 'workplace']) $(`#search-${key}`).value = search?.[key] ?? ({ location: 'Colombia', workplace: 'any' }[key] || '');
    $('#search-date').value = search?.datePosted ?? 'month';
    message(); $('#search-query').focus();
  }
  function showList() { $('#search-editor').hidden = true; $('#searches-list-view').hidden = false; message(); }
  document.querySelector('#searches-open').onclick = async () => {
    showList(); dialog.showModal(); $('#searches-list').textContent = 'Loading…';
    try { await load(); } catch (error) { message(error); }
  };
  $('#searches-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => clearTimeout(connectionTimer));
  $('#linkedin-connect').onclick = async () => {
    $('#linkedin-connect').disabled = true; message();
    try { await api('/api/linkedin/connect', {}); await loadConnection(); await refresh(); }
    catch (error) { message(error); $('#linkedin-connect').disabled = false; }
  };
  $('#search-add').onclick = () => { if (state && !busy) showEditor(null); };
  $('#search-cancel').onclick = async () => { showList(); try { await load(); } catch (error) { message(error); } };
  $('#searches-list').onclick = event => {
    if (busy) return;
    const button = event.target.closest('[data-edit], [data-offers]');
    if (!button) return;
    const search = state.searches.find(s => s.id === (button.dataset.edit || button.dataset.offers));
    if (button.dataset.edit) showEditor(search);
    else { dialog.close(); filterOffers(search); }
  };
  $('#searches-list').onchange = async event => {
    const id = event.target.dataset.enable;
    if (!id || busy) return;
    const search = state.searches.find(s => s.id === id);
    busy = true; $('#searches-list').inert = true;
    try { await api('/api/searches', { search: { ...search, enabled: event.target.checked }, version: state.version }); await load(); await refresh(); message(); }
    catch (error) { try { await load(); } catch {} message(error); }
    finally { busy = false; $('#searches-list').inert = false; }
  };
  $('#search-editor').onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    busy = true; const save = event.submitter; save.disabled = true;
    const search = { id: editing?.id, provider: 'linkedin', name: $('#search-query').value.trim().slice(0, 100), query: $('#search-query').value, location: $('#search-location').value, workplace: $('#search-workplace').value, datePosted: $('#search-date').value, enabled: editing?.enabled ?? true };
    try { await api('/api/searches', { search, version: editVersion }); await load(); showList(); await refresh(); }
    catch (error) { message(error); }
    finally { busy = false; save.disabled = false; }
  };
}

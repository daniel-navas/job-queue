// Read-only smoke test against the running local app; never presses Process.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4317');
  await page.locator('.job').first().waitFor();
  assert.equal(await page.locator('.sidebar').count(), 0);
  assert.equal(await page.getByText('Your next move.').count(), 0);
  assert.equal(await page.locator('.original').getAttribute('open'), null);
  assert.ok((await page.locator('#jobs').boundingBox()).y < 160);
  assert.equal(await page.locator('#jobs .detail-id').count(),0);
  const data = await (await page.request.get('http://127.0.0.1:4317/api/jobs')).json();
  const processed = data.jobs.find(j => j.processingStatus === 'processed' && j.status === 'new' && !j.application && j.availability?.status !== 'closed' && j.summary.fields.salary);
  assert.ok(processed, 'A processed salary fixture is needed');
  await page.getByRole('searchbox').fill(processed.reference);
  assert.equal(await page.locator('.job').count(), 1);
  assert.equal(await page.locator('.list-reference').count(),1);
  assert.equal(await page.locator('.list-reference').innerText(),processed.reference);
  assert.notEqual(await page.locator('.list-reference').evaluate(element=>element.tagName),'BUTTON');
  assert.equal(await page.locator('.state-complete, .state-needs-info').count(),1);
  assert.equal(await page.locator('.detail-id').innerText(),processed.reference);
  assert.equal(await page.locator('.detail-title .rating').innerText(),`${processed.rating.total > 0 ? '+' : ''}${processed.rating.total}`);
  assert.equal(await page.locator('.facts dd .rating').count(),0);
  const source = page.getByRole('button', { name:'Source for Salary', exact:true });
  await source.click(); assert.equal(await page.locator('#source-salary').isVisible(),true);
  await source.click(); assert.equal(await page.locator('#source-salary').isVisible(),false);
  const pending = data.jobs.find(j=>j.processingStatus==='pending' && j.status==='new');
  if (pending) {
    await page.getByRole('searchbox').fill(pending.reference);
    assert.equal(await page.locator('.detail-title .rating').innerText(),'—');
    assert.equal(await page.locator('.state-pending-analysis').count(),1);
  }
  await page.getByRole('searchbox').fill('no-match-xyz');
  await page.getByText('You’re all caught up.').waitFor();
  await page.getByRole('searchbox').fill(processed.reference);
  await page.getByRole('button',{name:'Dismiss',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.screenshot({path:'.local/frontend.png',fullPage:false});
  await page.getByRole('button',{name:'Searches',exact:true}).click();
  await page.locator('.search-row').first().waitFor();
  assert.equal(await page.locator('.search-row').count(),data.searches.searches.length);
  assert.equal(await page.getByRole('checkbox').count(),data.searches.searches.length);
  await page.screenshot({path:'.local/searches-actual.png',fullPage:false});
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: scores, processing states, source toggles, search, header, searches dialog, modal, no runtime errors.');
} finally { await browser.close(); }

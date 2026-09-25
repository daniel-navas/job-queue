import test from 'node:test';
import assert from 'node:assert/strict';
import { rateJob, compareJobs, workplaceMode, roleFocus, salaryPreference, coverageScore, publishedRecency, weightedTotal } from '../src/rating.mjs';
import { monthlySalary, withCOP } from '../src/salary.mjs';
test('ratings are discrete, missing salary neutral, client is contextual only', () => {
  const job = { summary: { fields: { companyType: { value: 'recruiting intermediary' }, client: null, project: null, salary: null } } };
  const rating = rateJob(job);
  assert.equal(rating.total, -1); assert.equal(rating.fields.client, undefined); assert.equal(rating.fields.salary.score, 0);
  assert.equal(rateJob({}).total, null);
  assert.equal(rateJob({ summary: { fields: { companyType: { value: 'product' }, project: { value: 'Payments platform' } } } }).total, 1);
  const sezzle = rateJob({ id:'4179554853', summary:{ inputHash:'097f36e19cc12883a07a19b5f966f6bc95f1a5785adf07968bcc488496dc008c', fields:{ companyType:{value:'product'}, project:{value:'Installment shopping'}, workplace:null } } });
  assert.equal(sezzle.fields.project.score,0);
  assert.ok(compareJobs({rating:{total:null}}, {rating:{total:-2}})>0);
});
test('monthly amounts preserve currency, ranges and assumptions', () => {
  const hourly = monthlySalary({ value: '$50–$100/hour; currency not specified.', evidence: 'Payout: $50 - $100/hour' });
  assert.equal(hourly.currency, null); assert.equal(Math.round(hourly.min), 8667); assert.equal(Math.round(hourly.max), 17333);
  assert.equal(withCOP(hourly, {rates:{COP:4000,USD:1}}).cop, undefined);
  const annual = monthlySalary({value:'USD 120,000–144,000 annually',evidence:''});
  assert.equal(annual.min,10000); assert.equal(annual.max,12000);
  assert.equal(withCOP(annual,{rates:{COP:4000,USD:1},date:'2026-01-01'}).cop.min,40000000);
  assert.equal(withCOP({min:12000000,max:12000000,currency:'COP'},{rates:{COP:4000,USD:1},date:'2026-01-01'}).usd.min,3000);
  assert.equal(monthlySalary({value:'8.000.000 COP monthly',evidence:''}).min,8000000);
  assert.equal(monthlySalary({value:'USD 2,800–6,000 per month, gross.',evidence:''}).qualifier,'gross');
  assert.equal(monthlySalary({value:'Paid in USD; amount not stated',evidence:''}),null);
  assert.equal(withCOP(annual,undefined).conversionUnavailable,true);
});
test('work mode uses explicit three-way preference and preserves ambiguity', () => {
  assert.equal(workplaceMode({location:'Colombia (Remote)'}).score,1);
  assert.equal(workplaceMode({location:'Bogota (Hybrid)'}).score,0);
  assert.equal(workplaceMode({location:'Colombia (On-site)'}).score,-1);
  assert.equal(workplaceMode({location:'Remote or on-site'}).score,0);
  assert.equal(workplaceMode({location:'Colombia'}).score,0);
});
test('role focus uses explicit title preference and preserves unknown roles', () => {
  assert.equal(roleFocus({title:'Backend Engineer'}).score,1);
  assert.equal(roleFocus({title:'Senior Front-end Engineer'}).score,-1);
  assert.equal(roleFocus({title:'Full Stack Engineer'}).score,0);
  assert.equal(roleFocus({title:'Software Engineer'}).score,0);
});
test('salary preference scores only decisive ranges', () => {
  assert.equal(salaryPreference({currency:'USD',min:3000,max:4000}).score,1);
  assert.equal(salaryPreference({currency:'USD',min:2500,max:2999}).score,0);
  assert.equal(salaryPreference({currency:'USD',min:4001,max:4500}).score,0);
  assert.equal(salaryPreference({currency:'USD',min:2800,max:6000}).score,1);
  assert.equal(salaryPreference({currency:'USD',min:2000,max:5000}).score,1);
  assert.equal(salaryPreference({currency:'USD',min:1200,max:2400}).score,-1);
  assert.equal(salaryPreference({currency:'USD',min:4501,max:6000}).score,-1);
  assert.equal(salaryPreference({currency:'COP',min:10000000,max:12000000,usd:{min:3200,max:3900}}).score,1);
  assert.equal(salaryPreference(null).score,0);
});
test('weighted priority includes fractional coverage and publication recency', () => {
  assert.equal(coverageScore([{score:1},{score:1},{score:0}]), 2 / 3);
  const now = Date.parse('2026-09-12T12:00:00Z');
  const bands = [{maxAgeDays:1,score:1},{maxAgeDays:3,score:.8},{maxAgeDays:7,score:.5},{maxAgeDays:14,score:.2}];
  assert.equal(publishedRecency(Date.parse('2026-09-10T12:00:00Z'), bands, now).score, .8);
  assert.equal(publishedRecency(Date.parse('2026-08-01T12:00:00Z'), bands, now).score, 0);
  assert.equal(weightedTotal({ roleFocus:{score:1}, requirements:{score:5/6}, publishedRecency:{score:.8} }, {roleFocus:1,requirements:2,publishedRecency:1}), 3.47);
});
test('rating values can be changed through structured preferences', () => {
  const preferences = {
    unknownScore: 0,
    missingProjectScore: -2,
    roleFocus: { backend: 3, fullstack: 0, frontend: -1 },
    workplace: { remote: 2, hybrid: 0, onsite: -1 },
    companyType: { product: 4 },
    salaryMonthlyUsd: { preferredMin: 3000, preferredMax: 4000, acceptableMin: 2500, acceptableMax: 4500, preferredScore: 5, outsideScore: -3 }
  };
  const job = { title:'Backend Engineer', location:'Remote', summary:{fields:{companyType:{value:'product'},project:null}} };
  const rating = rateJob(job, preferences);
  assert.equal(rating.fields.roleFocus.score, 3);
  assert.equal(rating.fields.workplace.score, 2);
  assert.equal(rating.fields.companyType.score, 4);
  assert.equal(rating.fields.project.score, -2);
  assert.equal(salaryPreference({currency:'USD',min:3500,max:3500}, preferences.salaryMonthlyUsd).score, 5);
});

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { catalog } from './tag-catalog.mjs';
import { currentSummary } from './summarize.mjs';

const groups = ['requirements', 'preferred', 'stack'];
const statuses = new Set(['proposed', 'applied', 'deferred', 'reopened']);
const actions = new Set(['map-existing', 'create-canonical', 'split', 'exclude', 'keep-unmapped']);
const kinds = new Set(['technology', 'capability', 'experience']);
const compact = value => value.replace(/\s+/g, ' ').trim();
const normalized = value => compact(value).toLowerCase();
const thresholds = criterion => ({
  minMonths: criterion.minMonths ?? null,
  maxMonths: criterion.maxMonths ?? null,
  autonomy: criterion.autonomy ?? null,
  knowledgeLevel: criterion.knowledgeLevel ?? null,
  lastUsedYear: criterion.lastUsedYear ?? null,
  maxYearsSinceUse: criterion.maxYearsSinceUse ?? null,
});

export function candidateFingerprint(group, criterion) {
  if (!groups.includes(group) || criterion?.kind !== 'unknown' || criterion?.alternatives?.length !== 1 || criterion.alternatives[0] !== 'unmapped') throw new Error('Invalid unmapped criterion');
  const identity = { group, label: normalized(criterion.label), evidence: normalized(criterion.evidence), ...thresholds(criterion) };
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

export function validateUnmappedReview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1) throw new Error('Invalid unmapped review schema');
  if (!Number.isInteger(value.reviewThreshold) || value.reviewThreshold < 1) throw new Error('Invalid unmapped review threshold');
  if (!Array.isArray(value.decisions)) throw new Error('Invalid unmapped review decisions');
  const ids = new Set(), fingerprints = new Set();
  for (const decision of value.decisions) {
    if (!decision || typeof decision !== 'object' || Array.isArray(decision) || typeof decision.id !== 'string' || !decision.id.trim() || ids.has(decision.id)) throw new Error('Invalid or duplicate unmapped review decision ID');
    ids.add(decision.id);
    if (!statuses.has(decision.status) || !actions.has(decision.action)) throw new Error('Invalid unmapped review decision state');
    if (!Array.isArray(decision.fingerprints) || !decision.fingerprints.length || decision.fingerprints.some(fingerprint => !/^[a-f0-9]{64}$/.test(fingerprint))) throw new Error('Invalid unmapped review fingerprint');
    if (decision.fingerprints.some(fingerprint => fingerprints.has(fingerprint))) throw new Error('Duplicate unmapped review fingerprint');
    decision.fingerprints.forEach(fingerprint => fingerprints.add(fingerprint));
    if (typeof decision.rationale !== 'string' || !decision.rationale.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(decision.reviewedAt)) throw new Error('Invalid unmapped review rationale or date');
    const needsTarget = ['map-existing', 'create-canonical'].includes(decision.action);
    if (needsTarget && (!decision.target || !kinds.has(decision.target.kind) || typeof decision.target.key !== 'string' || !decision.target.key.trim())) throw new Error('Invalid unmapped review target');
    if (!needsTarget && decision.target !== null) throw new Error('Unexpected unmapped review target');
    if (decision.status === 'applied' && decision.action === 'map-existing' && !catalog[decision.target.kind]?.[decision.target.key]) throw new Error('Unknown applied unmapped review target');
  }
  return value;
}

export async function loadUnmappedReview(root) {
  const file = path.join(root, 'config/unmapped-review.json');
  return validateUnmappedReview(JSON.parse(await readFile(file, 'utf8')));
}

export function inventoryUnmapped(jobs, review) {
  validateUnmappedReview(review);
  const byFingerprint = new Map();
  jobs.forEach((job, index) => {
    const summary = currentSummary(job);
    if (!summary) return;
    for (const group of groups) for (const criterion of summary.facts[group]) {
      if (criterion.kind !== 'unknown') continue;
      const fingerprint = candidateFingerprint(group, criterion);
      let candidate = byFingerprint.get(fingerprint);
      if (!candidate) {
        candidate = { fingerprint, group, label: compact(criterion.label), evidence: compact(criterion.evidence), thresholds: thresholds(criterion), occurrences: 0, offers: [] };
        byFingerprint.set(fingerprint, candidate);
      }
      candidate.occurrences++;
      candidate.offers.push({ id: job.id, reference: `JQ-${String(index + 1).padStart(3, '0')}`, title: job.title, company: job.company });
    }
  });
  const suppressed = new Set(review.decisions.filter(decision => ['applied', 'deferred'].includes(decision.status)).flatMap(decision => decision.fingerprints));
  const candidates = [...byFingerprint.values()].filter(candidate => !suppressed.has(candidate.fingerprint)).sort((a, b) => a.label.localeCompare(b.label) || a.fingerprint.localeCompare(b.fingerprint));
  return { candidates, pending: candidates.length, threshold: review.reviewThreshold, recommended: candidates.length >= review.reviewThreshold };
}

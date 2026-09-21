import { fileURLToPath } from 'node:url';
import { readStoredJobs } from '../src/queue-storage.mjs';
import { inventoryUnmapped, loadUnmappedReview } from '../src/unmapped-review.mjs';

const root = process.env.JOBQUEUE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const option = process.argv[2];

try {
  if (!['--status', '--report'].includes(option) || process.argv.length !== 3) throw new Error('Usage: node scripts/unmapped-review.mjs --status|--report');
  const [jobs, review] = await Promise.all([readStoredJobs(root), loadUnmappedReview(root)]);
  const result = inventoryUnmapped(jobs, review);
  const output = option === '--status'
    ? { pending: result.pending, threshold: result.threshold, recommended: result.recommended }
    : result;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

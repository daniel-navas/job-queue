import path from 'node:path';
import { backupQueue } from '../src/queue.mjs';

const root = process.env.JOBQUEUE_ROOT || path.resolve(import.meta.dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.resolve(process.argv[2] || path.join(root, 'data/backups', `queue-${stamp}.sqlite`));
console.log(await backupQueue(root, destination));

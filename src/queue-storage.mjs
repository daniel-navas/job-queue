import { backup, DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const databasePath = root => path.join(root, 'data/jobqueue.sqlite');
const legacyPath = root => path.join(root, 'data/queue.json');
const exists = async file => { try { await stat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

export function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || !Array.isArray(state.jobs)) throw new Error('Invalid queue state');
  const ids = new Set();
  for (const job of state.jobs) {
    if (!job || typeof job !== 'object' || Array.isArray(job) || typeof job.id !== 'string' || ids.has(job.id)) throw new Error('Invalid or duplicate queue job ID');
    ids.add(job.id);
  }
  return state;
}

async function legacyState(root) {
  try { return { raw: await readFile(legacyPath(root), 'utf8') }; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function parseState(raw) { return validateState(JSON.parse(raw)); }

function backupLegacy(root, raw) {
  const directory = path.join(root, 'data/backups');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(directory, `queue-${timestamp}-${randomUUID()}.json`);
  const handle = openSync(file, 'wx', 0o600);
  try { writeFileSync(handle, raw); } finally { closeSync(handle); }
}

async function executeWithRetry(db, statement) {
  const deadline = Date.now() + 5000;
  while (true) {
    try { db.exec(statement); return; }
    catch (error) {
      if (error.code !== 'ERR_SQLITE_ERROR' || !/database is locked/i.test(error.message) || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
}
export const beginWrite = db => executeWithRetry(db, 'BEGIN IMMEDIATE');
export const commitWrite = db => executeWithRetry(db, 'COMMIT');

function readState(db) {
  const marker = db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get();
  if (marker?.value !== '1') throw new Error('Queue database is not initialized');
  const row = db.prepare("SELECT value FROM metadata WHERE key = 'state'").get();
  if (!row) throw new Error('Queue database has no state');
  const metadata = JSON.parse(row.value);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || 'jobs' in metadata) throw new Error('Invalid queue metadata');
  const jobs = db.prepare('SELECT id, record FROM jobs ORDER BY position, id').all().map(row => {
    const job = JSON.parse(row.record);
    if (job?.id !== row.id) throw new Error('Queue job ID mismatch');
    return job;
  });
  return validateState({ ...metadata, jobs });
}

function writeState(db, state) {
  validateState(state);
  const metadata = { ...state }; delete metadata.jobs;
  const metadataJson = JSON.stringify(metadata);
  const previous = new Map(db.prepare('SELECT id, position, record FROM jobs').all().map(row => [row.id, row]));
  const deleteJob = db.prepare('DELETE FROM jobs WHERE id = ?');
  const upsert = db.prepare('INSERT INTO jobs (id, position, record) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET position = excluded.position, record = excluded.record');
  const currentIds = new Set(state.jobs.map(job => job.id));
  for (const id of previous.keys()) if (!currentIds.has(id)) deleteJob.run(id);
  for (const [position, job] of state.jobs.entries()) {
    const record = JSON.stringify(job);
    const old = previous.get(job.id);
    if (!old || old.position !== position || old.record !== record) upsert.run(job.id, position, record);
  }
  db.prepare("INSERT INTO metadata (key, value) VALUES ('state', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(metadataJson);
}

export async function openStorage(root, initialState = { jobs: [], importedAt: null }) {
  const file = databasePath(root);
  const preexisting = await exists(file);
  const legacy = preexisting ? null : await legacyState(root);
  const sourceState = preexisting ? null : legacy ? parseState(legacy.raw) : validateState(initialState);
  if (!preexisting) await mkdir(path.dirname(file), { recursive: true });
  // Reserve privately before SQLite can write any source data.
  if (!preexisting) {
    try { const handle = await open(file, 'wx', 0o600); await handle.close(); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout = 0');
    await beginWrite(db);
    try {
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'metadata'").get();
      if (table) {
        readState(db);
      } else {
        if (preexisting) throw new Error('Queue database is not initialized');
        if (legacy) backupLegacy(root, legacy.raw);
        db.exec('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        db.exec('CREATE TABLE jobs (id TEXT PRIMARY KEY, position INTEGER NOT NULL, record TEXT NOT NULL)');
        writeState(db, sourceState);
        db.prepare("INSERT INTO metadata (key, value) VALUES ('schema_version', '1')").run();
      }
      await commitWrite(db);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    if (!preexisting) await chmod(file, 0o600);
    return db;
  } catch (error) { db.close(); throw error; }
}

export function storageState(db) { return readState(db); }
export function storeState(db, state) { writeState(db, state); }

export async function backupQueue(root, destination) {
  const file = databasePath(root);
  if (!await exists(file)) throw new Error('Queue database does not exist');
  const db = new DatabaseSync(file, { readOnly: true });
  let reserved = false;
  try {
    readState(db);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const handle = await open(destination, 'wx', 0o600);
    reserved = true;
    await handle.close();
    await backup(db, destination);
    return destination;
  } catch (error) {
    if (reserved) await unlink(destination);
    throw error;
  } finally { db.close(); }
}

export async function readStoredJobs(root) {
  const file = databasePath(root);
  if (!await exists(file)) {
    const legacy = await legacyState(root);
    return legacy ? parseState(legacy.raw).jobs : [];
  }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec('BEGIN');
    try { const jobs = readState(db).jobs; db.exec('COMMIT'); return jobs; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } finally { db.close(); }
}

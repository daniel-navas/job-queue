import { lstat, mkdir, open, readFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { observedDetailTemplate, observedSearchTemplate } from './transport.mjs';

const reconnect = 'Connect LinkedIn explicitly to renew the private HTTP connection.';
const fileFor = root => path.join(root, '.local/linkedin-connection.json');

export async function saveConnection(root, connection) {
  const directory = path.join(root, '.local');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = fileFor(root);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(connection) + '\n'); }
  finally { await file.close(); }
  await rename(temporary, destination);
}

export async function loadConnection(root) {
  let info;
  try { info = await lstat(fileFor(root)); }
  catch (error) { if (error.code === 'ENOENT') throw new Error(reconnect); throw error; }
  if (!info.isFile() || (info.mode & 0o077)) throw new Error(`LinkedIn connection file is not private. ${reconnect}`);
  let connection;
  try { connection = JSON.parse(await readFile(fileFor(root), 'utf8')); }
  catch { throw new Error(`LinkedIn connection is unreadable. ${reconnect}`); }
  const cookie = connection?.storageState?.cookies?.find(item => item.name === 'li_at' && /(^|\.)linkedin\.com$/.test(item.domain ?? ''));
  const liveCookie = cookie && (cookie.expires <= 0 || cookie.expires > Date.now() / 1000);
  const template = connection?.searchTemplate;
  const detail = connection?.detailTemplate;
  if (connection?.version !== 1 || !liveCookie || !observedSearchTemplate(template?.url)
    || !observedDetailTemplate(detail?.url) || typeof connection.connectedAt !== 'string') throw new Error(reconnect);
  return connection;
}

export async function invalidateConnection(root, connection) {
  await saveConnection(root, { ...connection, searchTemplate: null, detailTemplate: null });
}

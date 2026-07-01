import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seen.json');
const KEEP_DAYS = 30; // staff.am listings expire within a month, TG ids never repeat

export const loadSeen = () => {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
};

// Record posted job ids (id -> ISO date first posted), pruning stale entries so
// the file the workflow commits back stays small.
export const markSeen = (ids, dateISO) => {
  const seen = loadSeen();
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  for (const [id, date] of Object.entries(seen)) {
    if (Date.parse(date) < cutoff) delete seen[id];
  }
  for (const id of ids) seen[id] = dateISO;
  fs.writeFileSync(FILE, JSON.stringify(seen, null, 2) + '\n');
  return Object.keys(seen).length;
};

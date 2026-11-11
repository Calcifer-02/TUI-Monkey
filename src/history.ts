import {mkdir, readdir, readFile, rename, writeFile, unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {historySchema, recordSchema, type Record, type State} from './schema';

export const historyDirectory = () => process.env.TUI_MONKEY_DATA_DIR || join(homedir(), '.tui-monkey');
export const recordStatus = (r: Record) => r.status ?? (r.failed ? 'failed' : 'complete');
export async function loadHistory(): Promise<{records: Record[]; warning?: string}> {
  const records = new Map<string, Record>();
  let warning: string | undefined;
  try {
    const raw = await readFile(join(historyDirectory(), 'history.json'), 'utf8');
    for (const r of historySchema.parse(JSON.parse(raw)).records) records.set(r.id, r);
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') warning = 'Некоторые записи истории недоступны.'; }
  try {
    const dir = join(historyDirectory(), 'history');
    const files = await readdir(dir);
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const r = recordSchema.parse(JSON.parse(await readFile(join(dir, file), 'utf8')));
        records.set(r.id, r);
      } catch { warning = 'Некоторые записи истории недоступны.'; }
    }
    for (const file of files.filter(f => f.endsWith('.deleted'))) records.delete(file.slice(0, -8));
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') warning = 'История недоступна.'; }
  return {records: [...records.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-1000), warning};
}
export function toRecord(state: State): Record {
  return {
    id: crypto.randomUUID(), date: new Date().toISOString(),
    mode: state.config.mode, language: state.config.language,
    words: state.config.words, duration: state.config.duration,
    suddenDeath: state.config.suddenDeath, noBackspace: state.config.noBackspace,
    noBacktrack: state.config.noBacktrack, wpm: state.wpm, accuracy: state.accuracy,
    elapsed: state.elapsed, bestStreak: state.bestStreak, failed: state.status === 'failed',
    status: state.status === 'ready' || state.status === 'running' ? 'aborted' : state.status,
    correct: state.correct, attempts: state.attempts, progress: state.progress,
  };
}
export async function saveRecord(record: Record) {
  const valid = recordSchema.parse(record);
  const dir = join(historyDirectory(), 'history');
  await mkdir(dir, {recursive: true});
  const temp = join(dir, `${valid.id}-${crypto.randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(valid), {mode: 0o600});
  await rename(temp, join(dir, `${valid.id}.json`));
  return (await loadHistory()).records;
}
export async function deleteRecord(id: string) {
  recordSchema.shape.id.parse(id);
  const dir = join(historyDirectory(), 'history');
  await mkdir(dir, {recursive: true});
  await writeFile(join(dir, `${id}.deleted`), '', {mode: 0o600});
  await unlink(join(dir, `${id}.json`)).catch(e => { if (e.code !== 'ENOENT') throw e; });
  return (await loadHistory()).records;
}
export function statistics(records: Record[]) {
  const seconds = records.reduce((n, r) => n + r.elapsed, 0);
  const wpm = seconds ? records.reduce((n, r) => n + r.wpm * r.elapsed, 0) / seconds : 0;
  const attempts = records.reduce((n, r) => n + (r.attempts ?? 1), 0);
  const accuracy = attempts ? records.reduce((n, r) => n + r.accuracy * (r.attempts ?? 1), 0) / attempts : 100;
  return {seconds, wpm, accuracy, aborted: records.filter(r => recordStatus(r) === 'aborted').length};
}
export function comparable(record: Record, state: State) {
  const c = state.config;
  return recordStatus(record) === 'complete' && record.mode === c.mode && record.language === c.language
    && record.suddenDeath === c.suddenDeath && record.noBackspace === c.noBackspace
    && record.noBacktrack === c.noBacktrack
    && (c.mode === 'time' ? record.duration === c.duration : record.words === c.words);
}

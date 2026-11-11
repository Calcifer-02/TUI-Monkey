import React from 'react';
import {afterEach, describe, expect, test} from 'bun:test';
import {render, cleanup} from 'ink-testing-library';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {App} from '../src/app';
import {EngineClient} from '../src/engine-client';
import {configSchema, stateSchema} from '../src/schema';
import {cleanName} from '../src/profile';
import {typingLines} from '../src/components';
import {deleteRecord, loadHistory, recordStatus, saveRecord, statistics, toRecord} from '../src/history';

const clients: EngineClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.close()); });
async function until(fn: () => boolean) {
  for (let i = 0; i < 100; i++) { if (fn()) return; await Bun.sleep(20); }
  throw new Error('Ожидаемый экран не появился.');
}

describe('интерактивная тренировка', () => {
  test('приветствие, банан, ввод, результат, история', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'monkey-test-'));
    const original = process.env.TUI_MONKEY_DATA_DIR;
    process.env.TUI_MONKEY_DATA_DIR = dir;
    try {
      const client = new EngineClient(); clients.push(client);
      const ui = render(<App name="Алексей" initial={configSchema.parse({mode: 'custom', text: 'go'})} client={client} languages={['english200', 'russian']}/>);
      await until(() => !!ui.lastFrame()?.includes('Привет, Алексей!'));
      ui.stdin.write(' ');
      await Bun.sleep(40);
      expect(ui.lastFrame()).toContain('▀');
      ui.stdin.write('\r');
      await until(() => !!ui.lastFrame()?.includes('Начни печатать'));
      await Bun.sleep(100);
      ui.stdin.write('g');
      await Bun.sleep(120);
      ui.stdin.write('o');
      try { await until(() => !!ui.lastFrame()?.includes('Результат')); }
      catch (e) { console.log(ui.lastFrame()); throw e; }
      for (let i = 0; i < 100 && !(await loadHistory()).records.length; i++) await Bun.sleep(20);
      expect((await loadHistory()).records.length).toBe(1);
      ui.stdin.write('h');
      await until(() => !!ui.lastFrame()?.includes('История'));
      expect(ui.lastFrame()).toContain('1 тренировок');
    } finally {
      if (original === undefined) delete process.env.TUI_MONKEY_DATA_DIR; else process.env.TUI_MONKEY_DATA_DIR = original;
      await rm(dir, {recursive: true, force: true});
    }
  });
  test('ошибка завершается, повтор запускается', async () => {
    const client = new EngineClient(); clients.push(client);
    const initial = configSchema.parse({mode: 'custom', text: 'abc', suddenDeath: true});
    const first = await client.start(initial);
    expect(first.status).toBe('ready');
    const reply = await client.request('input', {text: 'x'});
    expect(reply.state?.status).toBe('failed');
    const restarted = await client.start(initial);
    expect(restarted.typed).toBe('');
    expect(restarted.errors).toBe(0);
  });
  test('неверный словарь отклоняется', async () => {
    const client = new EngineClient(); clients.push(client);
    await expect(client.start(configSchema.parse({language: 'missing'}))).rejects.toThrow('unknown language');
  });
});
test('прерывание, статистика, удаление', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'monkey-abort-'));
  const previous = process.env.TUI_MONKEY_DATA_DIR;
  process.env.TUI_MONKEY_DATA_DIR = dir;
  try {
    const client = new EngineClient(); clients.push(client);
    const ui = render(<App name="Тест" initial={configSchema.parse({mode: 'custom', text: 'hello world'})} client={client} languages={['english200']} autoStart/>);
    await until(() => !!ui.lastFrame()?.includes('Начни печатать'));
    await Bun.sleep(100);
    ui.stdin.write('h'); await Bun.sleep(120); ui.stdin.write('x'); await Bun.sleep(100);
    ui.stdin.write('\u001b');
    await until(() => !!ui.lastFrame()?.includes('Начать тренировку'));
    const records = (await loadHistory()).records;
    expect(records).toHaveLength(1);
    expect(recordStatus(records[0])).toBe('aborted');
    expect(statistics(records).accuracy).toBe(50);
    expect(statistics(records).seconds).toBeGreaterThan(0);
    ui.stdin.write('h'); await until(() => !!ui.lastFrame()?.includes('прервана'));
    await Bun.sleep(100); ui.stdin.write('d');
    await until(() => !!ui.lastFrame()?.includes('Удалить запись?'));
    await Bun.sleep(100); ui.stdin.write('\r');
    await until(() => !!ui.lastFrame()?.includes('Записей пока нет'));
    expect((await loadHistory()).records).toHaveLength(0);
  } finally {
    cleanup();
    if (previous === undefined) delete process.env.TUI_MONKEY_DATA_DIR; else process.env.TUI_MONKEY_DATA_DIR = previous;
    await rm(dir, {recursive: true, force: true});
  }
});
test('параллельные сохранения сохраняют обе записи', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'monkey-storage-'));
  const previous = process.env.TUI_MONKEY_DATA_DIR;
  process.env.TUI_MONKEY_DATA_DIR = dir;
  try {
    const client = new EngineClient(); clients.push(client);
    await client.start(configSchema.parse({mode: 'custom', text: 'hello'}));
    const snapshot = (await client.request('input', {text: 'he'})).state!;
    const one = toRecord(snapshot), two = toRecord(snapshot);
    await Promise.all([saveRecord(one), saveRecord(two)]);
    expect((await loadHistory()).records).toHaveLength(2);
    await deleteRecord(one.id);
    expect((await loadHistory()).records.map(r => r.id)).toEqual([two.id]);
  } finally {
    if (previous === undefined) delete process.env.TUI_MONKEY_DATA_DIR; else process.env.TUI_MONKEY_DATA_DIR = previous;
    await rm(dir, {recursive: true, force: true});
  }
});
test('проверка настроек и данных', () => {
  expect(configSchema.safeParse({words: 0}).success).toBe(false);
  expect(configSchema.safeParse({duration: 601}).success).toBe(false);
  expect(stateSchema.safeParse({wpm: NaN}).success).toBe(false);
  expect(cleanName('  Алексей\n\u001b  ')).toBe('Алексей');
  expect(Array.from(cleanName('я'.repeat(100))).length).toBe(32);
});
test('интерфейс использует ширину терминала', async () => {
  const client = new EngineClient(); clients.push(client);
  const ui = render(<App name="Тест" initial={configSchema.parse({})} client={client} languages={['english200']}/>);
  for (const [width, height] of [[44, 18], [80, 24], [110, 32], [160, 44]]) {
    Object.defineProperty(ui.stdout, 'columns', {value: width, configurable: true});
    Object.defineProperty(ui.stdout, 'rows', {value: height, configurable: true});
    ui.stdout.emit('resize');
    await Bun.sleep(100);
    const lines = ui.lastFrame()!.split('\n');
    expect(Math.max(...lines.map(l => Array.from(l).length))).toBeLessThanOrEqual(width);
    expect(lines.length).toBeLessThanOrEqual(height);
    expect(Math.max(...lines.map(l => Array.from(l).length))).toBeGreaterThanOrEqual(width - 6);
  }
});
test('перенос сохраняет каждый символ', () => {
  const text = 'привет мир оченьдлинноесловобезпробелов конец';
  const lines = typingLines(text, 12);
  const chars = Array.from(text);
  expect(lines.map(l => chars.slice(l.start, l.end).join('')).join('')).toBe(text);
  expect(lines.every(l => l.end - l.start <= 12)).toBe(true);
});

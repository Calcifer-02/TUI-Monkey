import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {responseSchema, type Config, type State} from './schema';

type Response = ReturnType<typeof responseSchema.parse>;
export function enginePath() {
  const name = `monkey-engine${process.platform === 'win32' ? '.exe' : ''}`;
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [process.env.TUI_MONKEY_ENGINE, join(dirname(process.execPath), name), join(sourceDir, 'engines', `${process.platform}-${process.arch}`, name), join(sourceDir, '../dist/bin', name)];
  const path = candidates.find(p => p && existsSync(p));
  if (!path) throw new Error('Движок не найден. Выполните bun run build:engine.');
  return path;
}
export class EngineClient {
  private child: ChildProcessWithoutNullStreams;
  private id = 0;
  private closed = false;
  private failure?: Error;
  private pending = new Map<number, {resolve: (r: Response) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  constructor(path = enginePath()) {
    this.child = spawn(path, [], {windowsHide: true, stdio: 'pipe'});
    const lines = createInterface({input: this.child.stdout});
    lines.on('line', line => {
      try {
        const reply = responseSchema.parse(JSON.parse(line));
        const entry = this.pending.get(reply.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.pending.delete(reply.id);
        if (reply.error) entry.reject(new Error(reply.error));
        else entry.resolve(reply);
      } catch { this.fail(new Error('Некорректный ответ движка.')); }
    });
    this.child.on('error', e => this.fail(e));
    this.child.stdin.on('error', e => this.fail(e));
    this.child.stderr.on('data', () => {});
    this.child.on('exit', code => {
      lines.close();
      if (!this.closed) this.fail(new Error(`Движок завершился: ${code ?? 'signal'}`));
    });
  }
  private fail(error: Error) {
    this.failure = error;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
  }
  request(type: string, data: object = {}): Promise<Response> {
    if (this.closed || this.failure) return Promise.reject(this.failure ?? new Error('Движок закрыт.'));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Движок не отвечает.')); }, 5000);
      this.pending.set(id, {resolve, reject, timer});
      this.child.stdin.write(JSON.stringify({id, type, ...data}) + '\n');
    });
  }
  async start(config: Config): Promise<State> { return (await this.request('start', {config})).state!; }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error('Движок закрыт.'));
    this.child.stdin.end();
    this.child.kill();
  }
}

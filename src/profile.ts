import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {userInfo} from 'node:os';

export function cleanName(value: string) {
  return Array.from(value.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').trim()).slice(0, 32).join('');
}
export async function displayName(): Promise<string> {
  const provided = cleanName(process.env.TUI_MONKEY_NAME ?? '');
  if (provided) return provided;
  try {
    const {stdout} = await promisify(execFile)('git', ['config', 'user.name'], {timeout: 1200, windowsHide: true});
    const name = cleanName(stdout);
    if (name) return name;
  } catch {}
  try { return cleanName(userInfo().username) || 'друг'; } catch { return 'друг'; }
}

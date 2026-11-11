import * as vscode from 'vscode';
import {existsSync} from 'node:fs';
import {mkdir, writeFile, unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export function activate(context: vscode.ExtensionContext) {
  const terminals = new Map<vscode.Terminal, string | undefined>();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 20);
  status.text = '$(keyboard) Monkey';
  status.tooltip = 'TUI Monkey — разомни пальцы';
  status.command = 'tuiMonkey.start';
  const refresh = () => vscode.workspace.getConfiguration('tuiMonkey').get<boolean>('showStatusBar', true) ? status.show() : status.hide();
  refresh();
  async function launch(mode: 'start' | 'selection' | 'history') {
    let temp: string | undefined;
    try {
      const settings = vscode.workspace.getConfiguration('tuiMonkey');
      const exe = process.platform === 'win32' ? '.exe' : '';
      const binary = context.asAbsolutePath(`dist/bin/tui-monkey${exe}`);
      const engine = context.asAbsolutePath(`dist/bin/monkey-engine${exe}`);
      if (!existsSync(binary) || !existsSync(engine)) throw new Error('Установите сборку расширения для вашей платформы.');
      const args = ['--language', settings.get<string>('language', 'english200'), '--words', String(settings.get<number>('words', 25))];
      if (mode === 'history') args.push('--history');
      if (mode === 'selection') {
        const editor = vscode.window.activeTextEditor;
        const text = editor?.document.getText(editor.selection);
        if (!text?.trim()) { void vscode.window.showInformationMessage('Выделите текст для тренировки.'); return; }
        if (Array.from(text).length > 10000) throw new Error('Выберите максимум 10 000 символов.');
        await mkdir(context.globalStorageUri.fsPath, {recursive: true});
        temp = join(context.globalStorageUri.fsPath, `practice-${randomUUID()}.txt`);
        await writeFile(temp, text, {mode: 0o600});
        args.push('--text-file', temp, '--start');
      }
      let name = settings.get<string>('displayName', '');
      if (!name) {
        try { name = (await vscode.authentication.getAccounts('github'))[0]?.label ?? ''; } catch {}
      }
      const terminal = vscode.window.createTerminal({
        name: 'TUI Monkey', shellPath: binary, shellArgs: args,
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        env: {TUI_MONKEY_ENGINE: engine, TUI_MONKEY_NAME: name || null, FORCE_COLOR: '3'},
        iconPath: new vscode.ThemeIcon('keyboard'),
      });
      terminals.set(terminal, temp);
      terminal.show();
    } catch (e) {
      if (temp) await unlink(temp).catch(() => {});
      void vscode.window.showErrorMessage(`TUI Monkey: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  context.subscriptions.push(status,
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('tuiMonkey.showStatusBar')) refresh(); }),
    vscode.commands.registerCommand('tuiMonkey.start', () => launch('start')),
    vscode.commands.registerCommand('tuiMonkey.selection', () => launch('selection')),
    vscode.commands.registerCommand('tuiMonkey.history', () => launch('history')),
    vscode.window.onDidCloseTerminal(terminal => {
      const file = terminals.get(terminal);
      if (file) void unlink(file).catch(() => {});
      terminals.delete(terminal);
    }),
    {dispose: () => { for (const [terminal, file] of terminals) { terminal.dispose(); if (file) void unlink(file).catch(() => {}); } terminals.clear(); }},
  );
}

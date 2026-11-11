import React from 'react';
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {render} from 'ink';
import {App} from './app';
import {EngineClient} from './engine-client';
import {configSchema} from './schema';
import {displayName} from './profile';
import {version} from '../package.json';

const help = `TUI MONKEY ${version} — тренажёр печати

Usage: tui-monkey [text-file] [options]

  -w, --words <1..1000>     Word count (25)
  -l, --language <name>    Dictionary (english200)
  -t, --time <1..600>      Timed practice in seconds
      --text-file <path>  Practice your own text
      --language-file     Custom dictionary file
      --list-languages    List built-in dictionaries
      --sudden-death      Finish on the first mistake
      --no-backspace      Disable corrections
      --no-backtrack      Lock completed words
      --history           Open local history
      --start             Skip menu
      --help              Show this help
      --version           Show version

Enter: start · arrows: settings · Space: feed the monkey
Tab: restart · Escape: menu · Ctrl+C: quit
`;

let client: EngineClient | undefined;
try {
  const {values, positionals} = parseArgs({allowPositionals: true, options: {
    words: {type: 'string', short: 'w'}, language: {type: 'string', short: 'l'},
    time: {type: 'string', short: 't'}, 'text-file': {type: 'string'}, 'language-file': {type: 'string'},
    'list-languages': {type: 'boolean'}, 'sudden-death': {type: 'boolean'},
    'no-backspace': {type: 'boolean'}, 'no-backtrack': {type: 'boolean'},
    history: {type: 'boolean'}, start: {type: 'boolean'}, help: {type: 'boolean', short: 'h'}, version: {type: 'boolean'},
  }});
  const name = await displayName();
  if (values.help || values.version) {
    console.log(`Привет, ${name}!`);
    console.log(values.version ? version : help);
  } else {
    const textFile = values['text-file'] ?? positionals[0];
    if (positionals.length > 1) throw new Error('Допускается только один текстовый файл.');
    const text = textFile ? await readFile(textFile, 'utf8') : undefined;
    const wordList = values['language-file'] ? (await readFile(values['language-file'], 'utf8')).split(/\s+/).filter(Boolean) : undefined;
    if (text !== undefined && !text.trim()) throw new Error('Текстовый файл пуст.');
    if (wordList && !wordList.length) throw new Error('Словарь пуст.');
    const initial = configSchema.parse({
      mode: text !== undefined ? 'custom' : values.time ? 'time' : 'words',
      language: values.language, words: values.words ? Number(values.words) : undefined,
      duration: values.time ? Number(values.time) : undefined, text, wordList,
      suddenDeath: values['sudden-death'], noBackspace: values['no-backspace'], noBacktrack: values['no-backtrack'],
    });
    client = new EngineClient();
    const languages = (await client.request('languages')).languages!;
    if (values['list-languages']) { console.log(`Привет, ${name}!\n${languages.join('\n')}`); client.close(); }
    else {
      if (!languages.includes(initial.language)) throw new Error(`Неизвестный словарь: ${initial.language}`);
      if (!process.stdin.isTTY) throw new Error('Откройте приложение в интерактивном терминале.');
      const fullScreen = Boolean(process.stdout.isTTY);
      if (fullScreen) process.stdout.write('\u001b[?1049h\u001b[2J\u001b[H');
      try {
        const app = render(<App name={name} initial={initial} client={client} languages={languages} initialScreen={values.history ? 'history' : 'home'} autoStart={values.start}/>, {exitOnCtrlC: false});
        await app.waitUntilExit();
      } finally {
        client.close();
        if (fullScreen) process.stdout.write('\u001b[?1049l');
      }
    }
  }
} catch (e) {
  client?.close();
  console.error(`TUI Monkey: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
}

import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, useStdout} from 'ink';
import {EngineClient} from './engine-client';
import {comparable, deleteRecord, loadHistory, recordStatus, saveRecord, statistics, toRecord} from './history';
import {Metric, Monkey, palette as p, Panel, Progress, Sparkline, TypingText, type Mood} from './components';
import type {Config, Record, State} from './schema';

type Screen = 'home' | 'practice' | 'results' | 'history' | 'help';
export type AppProps = {name: string; initial: Config; client: EngineClient; languages: string[]; initialScreen?: 'home' | 'history'; autoStart?: boolean};
const modes = ['words', 'time'] as const;
const wordCounts = [10, 25, 50, 100];
const durations = [15, 30, 60, 120];
const modeNames = {words: 'Слова', time: 'Время', custom: 'Свой текст'};
function cycle<T>(items: readonly T[], value: T, delta: number): T { return items[(Math.max(0, items.indexOf(value)) + delta + items.length) % items.length]; }

export function App({name, initial, client, languages, initialScreen = 'home', autoStart = false}: AppProps) {
  const {exit} = useApp();
  const {stdout} = useStdout();
  const [size, setSize] = useState({width: stdout.columns || 100, height: stdout.rows || 35});
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [config, setConfig] = useState(initial);
  const [state, setState] = useState<State>();
  const [history, setHistory] = useState<Record[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [focus, setFocus] = useState(0);
  const [frame, setFrame] = useState(0);
  const [bananas, setBananas] = useState(0);
  const [petUntil, setPetUntil] = useState(0);
  const [best, setBest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyCursor, setHistoryCursor] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const epoch = useRef(0), saved = useRef(-1), starting = useRef(false);
  const sessionMeta = useRef({id: crypto.randomUUID(), date: new Date().toISOString()});
  const pendingSave = useRef<Promise<void>>(Promise.resolve());
  const width = Math.max(20, size.width);
  const compact = size.height < 32;
  const sidebar = width >= 82 && size.height >= 24;
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  useEffect(() => {
    const resize = () => setSize({width: stdout.columns || 100, height: stdout.rows || 35});
    stdout.on('resize', resize);
    const timer = setInterval(() => setFrame(f => f + 1), 450);
    loadHistory().then(data => { setHistory(data.records); if (data.warning) setNotice(data.warning); }).catch(fail);
    return () => { stdout.off('resize', resize); clearInterval(timer); };
  }, [stdout]);

  function enqueueSave(snapshot: State) {
    const record = {...toRecord(snapshot), ...sessionMeta.current};
    pendingSave.current = pendingSave.current.then(async () => { setHistory(await saveRecord(record)); }).catch(e => setNotice(`Не удалось сохранить: ${e.message}`));
    return pendingSave.current;
  }
  async function abortCurrent() {
    if (screen === 'practice' && state && saved.current !== epoch.current) {
      const final = (await client.request('abort')).state!;
      if (final.attempts > 0) { saved.current = epoch.current; await enqueueSave(final); }
    }
    await pendingSave.current;
  }
  async function start(next = config) {
    if (starting.current) return;
    starting.current = true; setBusy(true); setError(''); setBest(false);
    try {
      await abortCurrent();
      const token = ++epoch.current;
      sessionMeta.current = {id: crypto.randomUUID(), date: new Date().toISOString()};
      const reply = await client.start(next);
      if (token !== epoch.current) return;
      setState(reply); setConfig(next); setScreen('practice');
    } catch (e) { fail(e); } finally { starting.current = false; setBusy(false); }
  }
  useEffect(() => { if (autoStart) void start(initial); }, []);
  function update(type: string, data: object = {}) {
    const token = epoch.current;
    client.request(type, data).then(reply => {
      if (token === epoch.current && reply.state) setState(reply.state);
    }).catch(fail);
  }
  useEffect(() => {
    if (screen !== 'practice' || state?.status !== 'running') return;
    const timer = setInterval(() => update('tick'), 250);
    return () => clearInterval(timer);
  }, [screen, state?.status]);
  useEffect(() => {
    if (!state || !['complete', 'failed'].includes(state.status) || saved.current === epoch.current) return;
    saved.current = epoch.current;
    setScreen('results');
    const previous = history.filter(r => comparable(r, state));
    setBest(state.status === 'complete' && state.config.mode !== 'custom' && state.wpm > Math.max(0, ...previous.map(r => r.wpm)));
    void enqueueSave(state);
  }, [state]);
  useEffect(() => {
    if (screen === 'practice' && state?.status === 'running' && saved.current !== epoch.current) void enqueueSave(state);
  }, [screen, state?.status, Math.floor(state?.elapsed ?? 0)]);

  async function home() {
    setBusy(true);
    try { await abortCurrent(); epoch.current++; setScreen('home'); setError(''); setConfirmDelete(false); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function quit() {
    if (busy) return;
    setBusy(true);
    try { await abortCurrent(); } catch (e) { fail(e); }
    exit();
  }
  function change(delta: number) {
    setConfig(c => {
      if (focus === 0) return {...c, mode: cycle(c.text ? [...modes, 'custom'] : modes, c.mode, delta)};
      if (focus === 1) return {...c, language: cycle(languages, c.language, delta), text: c.mode === 'custom' ? c.text : undefined, wordList: undefined};
      if (focus === 2) return c.mode === 'custom' ? c : c.mode === 'time' ? {...c, duration: cycle(durations, c.duration, delta)} : {...c, words: cycle(wordCounts, c.words, delta)};
      if (focus === 3) return {...c, suddenDeath: !c.suddenDeath};
      if (focus === 4) return {...c, noBackspace: !c.noBackspace};
      return {...c, noBacktrack: !c.noBacktrack};
    });
  }
  useInput((input, key) => {
    if (key.ctrl && input === 'c') { void quit(); return; }
    if (busy) return;
    if (screen === 'practice') {
      if (key.escape) { void home(); return; }
      if (key.tab || (key.ctrl && input === 'r')) { void start(); return; }
      if (key.backspace || key.delete) { update('backspace', {word: key.ctrl || key.meta}); return; }
      if (key.ctrl && input === 'w') { update('backspace', {word: true}); return; }
      if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return;
      if (key.return) { update('input', {text: ' '}); return; }
      if (input) {
        if (Array.from(input).length > 1) { setNotice('Вставка отключена: печатай самостоятельно.'); return; }
        setNotice(''); update('input', {text: input});
      }
      return;
    }
    if (screen === 'history' && confirmDelete) {
      if (key.escape) setConfirmDelete(false);
      if (key.return) {
        const selected = [...history].reverse()[historyCursor];
        if (selected) {
          setBusy(true);
          deleteRecord(selected.id).then(records => { setHistory(records); setHistoryCursor(n => Math.max(0, Math.min(n, records.length - 1))); })
            .catch(fail).finally(() => { setBusy(false); setConfirmDelete(false); });
        }
      }
      return;
    }
    if (key.escape) { void home(); return; }
    if (input === 'q' || input === 'й') { void quit(); return; }
    if (input === 'h' || input === 'р') { setHistoryCursor(0); setScreen('history'); return; }
    if (input === '?') { setScreen('help'); return; }
    if (input === ' ') { setBananas(n => n + 1); setPetUntil(Date.now() + 1800); return; }
    if (screen === 'home') {
      if (key.upArrow) setFocus(n => (n + 5) % 6);
      if (key.downArrow || key.tab) setFocus(n => (n + 1) % 6);
      if (key.leftArrow) change(-1);
      if (key.rightArrow) change(1);
      if (key.return) void start();
    } else if (screen === 'results') {
      if (key.return || key.tab) void start();
      if ((input === 'r' || input === 'к') && state?.missedWords.length) {
        void start({...config, mode: 'custom', text: state.missedWords.join(' ')});
      }
    } else if (screen === 'history') {
      if (key.upArrow) setHistoryCursor(n => Math.max(0, n - 1));
      if (key.downArrow) setHistoryCursor(n => Math.min(history.length - 1, n + 1));
      if ((input === 'd' || key.delete) && history.length) setConfirmDelete(true);
      if (key.return) void home();
    } else if (key.return) void home();
  });

  let mood: Mood = 'idle';
  if (Date.now() < petUntil) mood = 'love';
  else if (screen === 'results') mood = state?.status === 'failed' ? 'oops' : 'party';
  else if (screen === 'practice' && state?.status === 'running') mood = state.streak >= 15 ? 'happy' : state.streak === 0 ? 'oops' : 'typing';
  const monkeyMessage = mood === 'love' ? 'Банан принят' : mood === 'oops' ? 'Ошибка' : mood === 'happy' ? `Серия: ${state?.streak ?? 0}` : mood === 'party' ? 'Тренировка завершена' : mood === 'typing' ? 'Тренировка' : 'Готов';
  const bestEver = Math.round(Math.max(0, ...history.filter(r => recordStatus(r) === 'complete').map(r => r.wpm)));
  const stats = statistics(history);
  const historyRows = compact ? Math.max(1, Math.min(5, size.height - 17)) : Math.max(5, size.height - 23);
  const historyOffset = Math.max(0, historyCursor - historyRows + 1);
  const settings = [
    ['Режим', modeNames[config.mode]],
    ['Словарь', config.mode === 'custom' ? 'выбранный текст' : config.wordList ? 'свой словарь' : config.language],
    [config.mode === 'time' ? 'Длительность' : config.mode === 'custom' ? 'Длина текста' : 'Количество', config.mode === 'time' ? `${config.duration} секунд` : config.mode === 'custom' ? `${Array.from(config.text?.trim().replace(/\s+/g, ' ') ?? '').length} символов` : `${config.words} слов`],
    ['Первая ошибка', config.suddenDeath ? 'завершает тест' : 'продолжить'],
    ['Backspace', config.noBackspace ? 'выключен' : 'включён'],
    ['Возврат к словам', config.noBacktrack ? 'выключен' : 'включён'],
  ];
  if (size.width < 44 || size.height < 18) return <Box flexDirection="column"><Text color={p.yellow}>TUI MONKEY · Привет, {name}!</Text><Text>Увеличь терминал до 44 × 18.</Text><Text>Ctrl+C — выход</Text></Box>;
  return <Box flexDirection="column" width={width} height={size.height} overflow="hidden" paddingX={2} paddingY={compact ? 0 : 1} backgroundColor={p.ink}>
    <Box justifyContent="space-between">
      <Text color={p.yellow} bold>● TUI MONKEY <Text color={p.muted}>/ {screen === 'home' ? 'тренировка' : screen === 'practice' ? 'поток' : screen === 'results' ? 'результат' : screen === 'history' ? 'история' : 'помощь'}</Text></Text>
      {width >= 70 && <Text color={p.muted}>{config.language}</Text>}
    </Box>
    <Box marginBottom={compact ? 0 : 1}><Text color={p.white}>Привет, {name}!</Text></Box>

    {screen === 'home' && <Box gap={2}>
      <Box flexDirection="column" flexGrow={1}>
        {!compact && <Box marginY={1}><Text color={p.white} bold>Настройки тренировки</Text></Box>}
        <Box borderStyle="round" borderColor={p.yellow} flexDirection="column" paddingX={2} paddingY={compact ? 0 : 1}>
          {settings.map(([label, value], i) => <Box key={label} justifyContent="space-between">
            <Text color={focus === i ? p.yellow : p.muted}>{focus === i ? '›' : ' '} {label}</Text>
            <Text color={focus === i ? p.yellow : p.white}>{focus === i ? '‹ ' : '  '}{value}{focus === i ? ' ›' : '  '}</Text>
          </Box>)}
        </Box>
        <Box marginTop={1}><Text backgroundColor={p.yellow} color={p.ink} bold> {busy ? 'Загрузка…' : ' ENTER  Начать тренировку '} </Text></Box>
        {!compact && <Box marginTop={1}><Text color={p.muted}>Таймер запускается с первого символа.</Text></Box>}
      </Box>
      {sidebar && <Box flexDirection="column" borderStyle="round" borderColor={p.border} width={32} flexShrink={0} paddingX={2} alignItems="center">
        <Monkey mood={mood} frame={frame}/>
        {!compact && <Text color={p.white}>{monkeyMessage}</Text>}
        <Text color={p.muted}>Space — угостить бананом</Text>
        <Text color={p.yellow}>Бананы {bananas} <Text color={p.muted}>· {bestEver} WPM</Text></Text>
      </Box>}
    </Box>}

    {screen === 'practice' && state && <>
      <Box marginY={compact ? 0 : 1} gap={2}>
        <Metric label="скорость" value={Math.round(state.wpm)} suffix="wpm"/>
        <Metric label="точность" value={Math.round(state.accuracy)} suffix="%"/>
        <Metric label={config.mode === 'time' ? 'осталось' : 'время'} value={Math.ceil(config.mode === 'time' ? state.remaining : state.elapsed)} suffix="сек"/>
        {width >= 65 && <Metric label="серия" value={state.streak} suffix="✦"/>}
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor={p.yellow} paddingX={2} paddingY={compact ? 0 : 1}>
        <Box marginBottom={1} justifyContent="space-between"><Text color={p.muted}>{config.language} / {modeNames[config.mode]}</Text><Text color={p.yellow}>{state.status === 'ready' ? 'Начни печатать…' : `${Math.round(state.progress * 100)}%`}</Text></Box>
        <TypingText state={state} width={width - 12} rows={size.height < 22 ? 1 : compact ? 2 : Math.max(3, Math.floor((size.height - 25) / 2))}/>
        <Progress value={state.progress} width={Math.max(10, width - 12)}/>
      </Box>
      <Box marginTop={compact ? 0 : 1} gap={2} alignItems="center"><Monkey mood={mood} frame={frame} compact/><Text color={p.pale}>{monkeyMessage}</Text></Box>
    </>}

    {screen === 'results' && state && <>
      <Box marginY={compact ? 0 : 1}><Text color={p.yellow} bold>{state.status === 'failed' ? 'Остановка после ошибки' : best ? 'Личный рекорд' : 'Результат'}</Text></Box>
      <Box gap={2}>
        <Box flexGrow={1} flexDirection="column">
          <Box gap={2} marginBottom={1}><Metric label="скорость" value={Math.round(state.wpm)} suffix="wpm"/><Metric label="точность" value={state.accuracy} suffix="%"/><Metric label="время" value={state.elapsed} suffix="сек"/></Box>
          <Box flexDirection="column" borderStyle="round" borderColor={p.border} paddingX={2}>
            <Text color={p.muted}>СКОРОСТЬ</Text><Sparkline values={state.samples} width={Math.min(60, width - 14)}/>
            <Text color={p.muted}>Raw {Math.round(state.rawWpm)} · ошибок {state.errors} · серия {state.bestStreak}</Text>
            <Text color={p.white}>Ошибки: {state.weakKeys.length ? state.weakKeys.slice(0, 5).map(k => `${k.key === ' ' ? 'space' : k.key} (${k.misses})`).join('  ') : 'нет'}</Text>
          </Box>
          <Box marginTop={1}><Text color={p.yellow}>Enter — ещё раз {state.missedWords.length > 0 ? ' · R — работа над ошибками' : ''}</Text></Box>
        </Box>
        {sidebar && <Box flexDirection="column" width={28} flexShrink={0} alignItems="center"><Monkey mood={mood} frame={frame}/></Box>}
      </Box>
    </>}

    {screen === 'history' && <Box flexDirection="column" marginY={1}>
      <Text color={p.white} bold>История <Text color={p.muted}>/ {history.length} тренировок · прервано {stats.aborted}</Text></Text>
      <Box marginY={1} gap={2}><Metric label="средняя скорость" value={Math.round(stats.wpm)} suffix="wpm"/><Metric label="точность" value={Math.round(stats.accuracy)} suffix="%"/><Metric label="общее время" value={Math.round(stats.seconds)} suffix="сек"/></Box>
      {!compact && <Box marginBottom={1}><Sparkline values={history.slice(-60).map(r => r.wpm)} width={Math.min(60, width - 8)}/></Box>}
      <Text color={p.muted}>{'  Дата'.padEnd(width < 60 ? 13 : 19)}{'WPM'.padEnd(7)}{'%'.padEnd(7)}Статус</Text>
      {[...history].reverse().slice(historyOffset, historyOffset + historyRows).map((r, i) => <Text key={r.id} color={i + historyOffset === historyCursor ? p.yellow : p.white}>
        {`${i + historyOffset === historyCursor ? '›' : ' '} ${new Date(r.date).toLocaleDateString('ru-RU')}${width >= 60 ? ' ' + new Date(r.date).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : ''}`.padEnd(width < 60 ? 13 : 19)}{String(Math.round(r.wpm)).padEnd(7)}{String(r.accuracy).padEnd(7)}{{complete: 'завершена', failed: 'ошибка', aborted: 'прервана'}[recordStatus(r)]}
      </Text>)}
      {!history.length && <Text color={p.muted}>Записей пока нет.</Text>}
      <Box marginTop={1}><Text color={confirmDelete ? p.yellow : p.muted}>{confirmDelete ? 'Удалить запись? Enter — удалить · Esc — отмена' : '↑↓ выбрать · D / Delete — удалить'}</Text></Box>
    </Box>}

    {screen === 'help' && <Box flexDirection="column" marginY={1}>
      <Text color={p.yellow} bold>Управление</Text>
      <Text color={p.white}>↑ ↓ / Tab   выбрать настройку</Text><Text color={p.white}>← →         изменить значение</Text>
      <Text color={p.white}>Enter       начать / повторить</Text><Text color={p.white}>Tab         перезапустить тренировку</Text>
      <Text color={p.white}>Backspace   исправить символ</Text><Text color={p.white}>Ctrl+W      стереть текущее слово</Text>
      <Text color={p.white}>Esc         главное меню</Text><Text color={p.white}>Space       угостить бананом (в меню)</Text>
      <Text color={p.muted}>WPM = верные символы / 5 / минуты.</Text>
      <Text color={p.muted}>Исправления сохраняют ошибки в точности.</Text>
      {!compact && <Text color={p.muted}>Свой текст: tui-monkey --text-file example.txt</Text>}
    </Box>}
    {error && <Text color={p.red}>{error}</Text>}
    {notice && <Text color={p.muted}>{notice}</Text>}
    <Box marginTop={compact ? 0 : 1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor={p.border} paddingTop={compact ? 0 : 1}>
      <Text color={p.muted}>{screen === 'practice' ? 'tab заново   esc меню   ctrl+c выход' : screen === 'home' ? width < 70 ? '↑↓ выбор  ←→ изменить  h история' : '↑↓ выбор   ←→ изменить   h история   ? помощь   q выход' : 'esc меню   h история   ? помощь   q выход'}</Text>
    </Box>
    {!sidebar && screen === 'home' && <Box gap={1} alignItems="center"><Monkey mood={mood} frame={frame} compact/><Text color={p.pale}>{width < 70 ? 'Space — банан' : 'Space — угостить бананом'} · {bananas}</Text></Box>}
  </Box>;
}

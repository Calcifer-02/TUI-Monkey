import React from 'react';
import {Box, Text} from 'ink';
import stringWidth from 'string-width';
import type {State} from './schema';
import {monkeyPixels, spriteColors, type Mood} from './monkey-sprite';
export type {Mood} from './monkey-sprite';

export const palette = {yellow: '#FFD43B', pale: '#FFEAA0', ink: '#11110E', panel: '#1C1C17', white: '#F2F1DD', muted: '#8B8B77', border: '#444435', red: '#FF7878', green: '#ADD878'};
export function Monkey({mood = 'idle', frame = 0, compact = false}: {mood?: Mood; frame?: number; compact?: boolean}) {
  const pixels = monkeyPixels(mood, frame, compact);
  return <Box flexDirection="column" flexShrink={0} aria-label="Обезьяна">
    {pixels.filter((_, y) => y % 2 === 0).map((row, i) => <Text key={i}>
      {row.map((top, x) => <Text key={x} color={spriteColors[top]} backgroundColor={spriteColors[pixels[i * 2 + 1]?.[x] ?? '.']}>▀</Text>)}
    </Text>)}
  </Box>;
}
export function Panel({title, children, width, grow = 0}: React.PropsWithChildren<{title: string; width?: number | string; grow?: number}>) {
  return <Box flexDirection="column" borderStyle="round" borderColor={palette.border} paddingX={2} paddingY={1} width={width} flexGrow={grow}>
    <Text color={palette.yellow} bold>{title}</Text>
    <Box marginTop={1} flexDirection="column">{children}</Box>
  </Box>;
}
export function Metric({label, value, suffix = ''}: {label: string; value: string | number; suffix?: string}) {
  return <Box flexDirection="column" minWidth={10} flexGrow={1}>
    <Text color={palette.yellow} bold>{value}<Text color={palette.muted}> {suffix}</Text></Text>
    <Text color={palette.muted}>{label}</Text>
  </Box>;
}
export function Progress({value, width = 30}: {value: number; width?: number}) {
  const count = Math.max(0, Math.min(width, Math.round(value * width)));
  return <Text><Text color={palette.yellow}>{'━'.repeat(count)}</Text><Text color={palette.border}>{'━'.repeat(width - count)}</Text></Text>;
}
export function Sparkline({values, width = 40}: {values: number[]; width?: number}) {
  const samples = values.length <= width ? values : Array.from({length: width}, (_, i) => values[Math.floor(i * values.length / width)]);
  const max = Math.max(1, ...samples);
  return <Text color={palette.yellow}>{samples.length ? samples.map(v => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor(v / max * 7))]).join('') : '▁'.repeat(width)}</Text>;
}
export function typingLines(text: string, width: number) {
  const chars = Array.from(text);
  const lines: {start: number; end: number}[] = [];
  let start = 0;
  while (start < chars.length) {
    let end = start, cells = 0;
    while (end < chars.length && cells + stringWidth(chars[end]) <= Math.max(8, width)) {
      cells += stringWidth(chars[end]); end++;
    }
    if (end === start) end++;
    if (end < chars.length) {
      let split = end - 1;
      while (split > start && chars[split] !== ' ') split--;
      if (split > start) end = split + 1;
    }
    lines.push({start, end}); start = end;
  }
  return lines;
}
export function TypingText({state, width, rows = 4}: {state: State; width: number; rows?: number}) {
  const target = Array.from(state.text), typed = Array.from(state.typed);
  const lines = typingLines(state.text, width);
  const active = Math.max(0, lines.findIndex(l => typed.length < l.end));
  const first = Math.max(0, active - 1);
  return <Box flexDirection="column" minHeight={rows * 2}>
    {lines.slice(first, first + rows).map(line => <Box key={line.start} marginBottom={1}>
      <Text>{target.slice(line.start, line.end).map((char, offset) => {
        const i = line.start + offset, entered = typed[i], cursor = i === typed.length;
        const wrong = entered !== undefined && entered !== char;
        return <Text key={i} color={cursor ? palette.ink : wrong ? palette.red : entered === undefined ? palette.muted : palette.white}
          backgroundColor={cursor ? palette.yellow : undefined} underline={wrong}>
          {char === ' ' && (wrong || cursor) ? '·' : char}
        </Text>;
      })}</Text>
    </Box>)}
  </Box>;
}

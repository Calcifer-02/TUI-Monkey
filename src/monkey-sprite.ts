export type Mood = 'idle' | 'typing' | 'happy' | 'oops' | 'party' | 'love';
export const spriteColors: Record<string, string> = {
  '.': '#11110E', f: '#D69928', g: '#FFC83D', l: '#FFDE73',
  s: '#FFE6AA', d: '#241D12', w: '#FFF8DF', b: '#94601E', r: '#F5A86C',
};

export function monkeyPixels(mood: Mood, frame: number, compact = false): string[][] {
  const pixels = Array.from({length: 24}, () => Array(26).fill('.'));
  const dot = (x: number, y: number, c: string) => { if (pixels[y]?.[x] !== undefined) pixels[y][x] = c; };
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) dot(i, j, c);
  };
  const oval = (x: number, y: number, rx: number, ry: number, c: string) => {
    for (let j = Math.floor(y - ry); j <= y + ry; j++) for (let i = Math.floor(x - rx); i <= x + rx; i++)
      if (((i - x) / rx) ** 2 + ((j - y) / ry) ** 2 <= 1) dot(i, j, c);
  };
  const lifted = mood === 'party' || mood === 'love';
  oval(13, 18, 5, 5, 'f'); oval(13, 18, 3, 4, 'l');
  rect(8, 22, 4, 2, 'g'); rect(15, 22, 4, 2, 'g');
  rect(20, 19, 3, 2, 'f'); rect(22, 16, 2, 4, 'f');
  rect(21 + frame % 2, 15, 2, 2, 'g');
  if (lifted) {
    rect(5, 13, 2, 6, 'f'); oval(5, 12 + frame % 2, 2, 2, 's');
    rect(20, 13, 2, 6, 'f'); oval(21, 12 + frame % 2, 2, 2, 's');
  } else {
    oval(7, 18, 2, 3, 'f'); oval(19, 18, 2, 3, 'f');
    oval(8, 20 - (mood === 'typing' ? frame % 2 : 0), 2, 1, 's');
    oval(18, 20 - (mood === 'typing' ? (frame + 1) % 2 : 0), 2, 1, 's');
  }
  oval(4, 9, 3, 4, 'g'); oval(22, 9, 3, 4, 'g');
  oval(4, 9, 2, 2, 'b'); oval(22, 9, 2, 2, 'b');
  oval(13, 8, 9, 8, 'f'); oval(13, 7, 8, 7, 'g');
  rect(11, 0, 3, 2, 'l'); dot(14, 1, 'l');
  oval(10, 8, 4, 5, 's'); oval(16, 8, 4, 5, 's');
  oval(13, 12, 6, 3, 's');
  const blink = frame % 11 === 9;
  for (const x of [9, 16]) {
    if (blink) rect(x, 8, 3, 1, 'd');
    else if (mood === 'happy' || mood === 'party') { dot(x, 8, 'd'); dot(x + 1, 7, 'd'); dot(x + 2, 8, 'd'); }
    else if (mood === 'love') {
      dot(x, 7, 'r'); dot(x + 2, 7, 'r'); rect(x, 8, 3, 1, 'r'); dot(x + 1, 9, 'r');
    } else {
      rect(x, 7, 2, mood === 'oops' ? 4 : 3, 'd'); dot(x, 7, 'w');
    }
  }
  dot(12, 11, 'b'); dot(14, 11, 'b');
  if (mood === 'oops') oval(13, 13, 1, 1, 'd');
  else { dot(11, 12, 'b'); rect(12, 13, 3, 1, 'b'); dot(15, 12, 'b'); }
  if (mood === 'love') {
    rect(9, 18, 7, 2, 'g'); rect(10, 20, 5, 1, 'g'); rect(15, 16, 2, 3, 'l');
  }
  if (mood === 'typing') {
    rect(7, 22, 13, 2, 'b');
    for (let x = 8; x < 20; x += 2) dot(x, 22, 'l');
  }
  if (compact) return pixels.slice(3, 15).map(row => row.filter((_, x) => x >= 2 && x <= 24 && x % 2 === 0)).filter((_, y) => y % 2 === 0);
  return pixels;
}

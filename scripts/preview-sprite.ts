import {monkeyPixels, spriteColors} from '../src/monkey-sprite';
await Bun.write('artifacts/sprite.json', JSON.stringify({colors: spriteColors, frames: ['idle', 'typing', 'happy', 'oops', 'party', 'love'].map(m => monkeyPixels(m as Parameters<typeof monkeyPixels>[0], 0))}));

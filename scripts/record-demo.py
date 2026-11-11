import os
import queue
import tempfile
import threading
import time
from pathlib import Path

import pyte
from PIL import Image, ImageDraw, ImageFont
from winpty import PtyProcess

ROOT = Path(__file__).resolve().parent.parent
COLS, ROWS, CW, CH = 110, 32, 10, 20
BG, FG = '#11110e', '#f2f1dd'
FONT = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 17)
COLORS = {'default': FG, 'black': BG, 'red': '#ff7878', 'green': '#add878',
          'brown': '#ffd43b', 'yellow': '#ffd43b', 'blue': '#809fff',
          'magenta': '#ce9bff', 'cyan': '#80d9da', 'white': FG}


def color(value, default):
    if value == 'default':
        return default
    if len(value) == 6 and all(c in '0123456789abcdefABCDEF' for c in value):
        return '#' + value
    return COLORS.get(value, default)


def frame(screen):
    image = Image.new('RGB', (COLS * CW + 32, ROWS * CH + 40), BG)
    draw = ImageDraw.Draw(image)
    for y in range(ROWS):
        for x in range(COLS):
            cell = screen.buffer[y][x]
            fg, bg = color(cell.fg, FG), color(cell.bg, BG)
            if cell.reverse:
                fg, bg = bg, fg
            px, py = 16 + x * CW, 20 + y * CH
            if bg != BG:
                draw.rectangle((px, py, px + CW - 1, py + CH - 1), fill=bg)
            if cell.data == '▀':
                draw.rectangle((px, py, px + CW - 1, py + CH // 2 - 1), fill=fg)
            elif cell.data and cell.data != ' ':
                draw.text((px, py - 1), cell.data, font=FONT, fill=fg)
                if cell.underscore:
                    draw.line((px, py + CH - 3, px + CW, py + CH - 3), fill=fg)
    return image


with tempfile.TemporaryDirectory(prefix='tui-monkey-demo-') as directory:
    text = 'func main() { return 42 }'
    source = Path(directory) / 'sample.txt'
    source.write_text(text, encoding='utf8')
    env = dict(os.environ)
    env.pop('NO_COLOR', None)
    env.update(FORCE_COLOR='3', TERM='xterm-256color', TUI_MONKEY_NAME='Александр',
               TUI_MONKEY_DATA_DIR=directory)
    command = [str(ROOT / 'extension/dist/bin/tui-monkey.exe'), '--text-file', str(source)]
    process = PtyProcess.spawn(command, cwd=str(ROOT), env=env, dimensions=(ROWS, COLS))
    chunks = queue.Queue()

    def read_output():
        while process.isalive():
            try:
                chunks.put(process.read(65536))
            except EOFError:
                break

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()
    screen = pyte.Screen(COLS, ROWS)
    stream = pyte.Stream(screen)
    events = [(1.4, ' '), (2.5, '\r')]
    stamp = 3.4
    for index, char in enumerate(text):
        if index == 8:
            events.extend([(stamp, 'x'), (stamp + .22, '\x7f')])
            stamp += .44
        events.append((stamp, char))
        stamp += .12
    events.append((stamp + 1.7, '\r'))
    stamp += 2.5
    for char in 'func ':
        events.append((stamp, char))
        stamp += .13
    events.extend([(stamp + .6, '\x1b'), (stamp + 1.2, 'h'),
                   (stamp + 2.9, 'd'), (stamp + 3.8, '\r')])
    duration = stamp + 5.5
    started = time.monotonic()
    frames, transcript, milestones = [], [], set()
    def type_events():
        for deadline, value in events:
            while time.monotonic() - started < deadline:
                time.sleep(.005)
            process.write(value)

    writer = threading.Thread(target=type_events, daemon=True)
    writer.start()
    while time.monotonic() - started < duration:
        elapsed = time.monotonic() - started
        while not chunks.empty():
            data = chunks.get()
            transcript.append(data)
            stream.feed(data)
        display = '\n'.join(screen.display)
        for marker in ['Начать тренировку', 'Начни печатать', 'Результат', 'прервана', 'Удалить запись?']:
            if marker in display:
                milestones.add(marker)
        if elapsed > .8:
            image = frame(screen)
            frames.append(image)
            if 'Начать тренировку' in display and 'home' not in milestones:
                image.save(ROOT / 'artifacts/demo-home.png')
                milestones.add('home')
            if 'прервана' in display and 'history' not in milestones:
                image.save(ROOT / 'artifacts/demo-history.png')
                milestones.add('history')
        time.sleep(.16)
    process.write('q')
    time.sleep(.3)
    if process.isalive():
        process.terminate()
    Path(ROOT / 'docs').mkdir(exist_ok=True)
    frames[0].save(ROOT / 'docs/demo.gif', save_all=True, append_images=frames[1:],
                   duration=160, loop=0, optimize=True)
    Path(ROOT / 'artifacts/demo.ansi').write_text(''.join(transcript), encoding='utf8')
    print({'frames': len(frames), 'screens': sorted(milestones), 'bytes': (ROOT / 'docs/demo.gif').stat().st_size})
    expected = {'Начать тренировку', 'Результат', 'прервана', 'Удалить запись?'}
    if not expected.issubset(milestones):
        raise RuntimeError('Запись не содержит необходимые экраны.')

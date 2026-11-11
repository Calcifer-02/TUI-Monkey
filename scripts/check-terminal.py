import os
import queue
import threading
import time
from pathlib import Path
import pyte
from winpty import PtyProcess

root = Path(__file__).resolve().parent.parent
env = dict(os.environ, FORCE_COLOR='3', TERM='xterm-256color')
env.pop('NO_COLOR', None)
process = PtyProcess.spawn([str(root / 'extension/dist/bin/tui-monkey.exe')],
                          cwd=str(root), env=env, dimensions=(36, 120))
chunks = queue.Queue()
raw = []
screen = pyte.Screen(120, 36)
stream = pyte.Stream(screen)


def reader():
    while process.isalive():
        try:
            chunks.put(process.read(65536))
        except EOFError:
            break


def drain(seconds):
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        while not chunks.empty():
            chunk = chunks.get()
            raw.append(chunk)
            stream.feed(chunk)
        time.sleep(.02)


threading.Thread(target=reader, daemon=True).start()
try:
    drain(1)
    for rows, columns in [(18, 44), (44, 160), (24, 80), (35, 110), (18, 44), (36, 120)]:
        screen.resize(lines=rows, columns=columns)
        process.setwinsize(rows, columns)
        drain(1.2)
        visible = '\n'.join(screen.display)
        assert visible.count('TUI MONKEY') == 1, (rows, columns, visible)
        assert 'Начать' in visible, (rows, columns, visible)
    process.write('q')
    drain(.5)
    output = ''.join(raw)
    assert '\x1b[?1049h' in output and '\x1b[?1049l' in output
    assert output.count('\x1b[2J') >= 6
    print('Resize 44..160: passed; alternate screen: restored.')
finally:
    (root / 'artifacts/resize.ansi').write_text(''.join(raw), encoding='utf8')
    if process.isalive():
        process.terminate()

import json
from PIL import Image, ImageDraw
from pathlib import Path

data = json.loads(Path('artifacts/sprite.json').read_text())
image = Image.new('RGB', (26 * 12 * 3, 24 * 12 * 2), '#11110e')
draw = ImageDraw.Draw(image)
for index, frame in enumerate(data['frames']):
    for y, row in enumerate(frame):
        for x, color in enumerate(row):
            px = (index % 3 * 26 + x) * 12
            py = (index // 3 * 24 + y) * 12
            draw.rectangle((px, py, px + 11, py + 11), fill=data['colors'][color])
image.save('artifacts/mascot-preview.png')

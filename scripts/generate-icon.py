from pathlib import Path
from PIL import Image, ImageDraw

image = Image.new('RGB', (256, 256), '#11110e')
draw = ImageDraw.Draw(image)
yellow, face, dark = '#ffd43b', '#ffeaa0', '#11110e'
draw.rounded_rectangle((12, 12, 244, 244), radius=48, outline=yellow, width=6)
draw.ellipse((38, 82, 89, 150), fill=yellow)
draw.ellipse((167, 82, 218, 150), fill=yellow)
draw.rounded_rectangle((61, 49, 195, 180), radius=53, fill=yellow)
draw.ellipse((48, 95, 77, 136), fill=dark)
draw.ellipse((179, 95, 208, 136), fill=dark)
draw.rounded_rectangle((78, 88, 178, 165), radius=32, fill=face)
draw.rounded_rectangle((93, 102, 105, 121), radius=5, fill=dark)
draw.rounded_rectangle((151, 102, 163, 121), radius=5, fill=dark)
draw.arc((108, 123, 148, 148), 0, 180, fill=dark, width=5)
draw.rounded_rectangle((76, 192, 180, 215), radius=7, fill=yellow)
for x in range(85, 173, 15):
    draw.rectangle((x, 200, x+7, 206), fill=dark)
Path('extension/media').mkdir(parents=True, exist_ok=True)
image.save('extension/media/icon.png')

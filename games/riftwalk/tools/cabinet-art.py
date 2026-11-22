"""Makes Riftwalk's cabinet art from one captured frame of the hall.
Writes public/arcade/riftwalk.webp (480 by 396, the homepage cabinet and the switcher) and puts a 448 by 370 WebP
into the ART list of public/corridor/index.html as `riftwalk`, after `ledger`.
Usage: python3 games/riftwalk/tools/cabinet-art.py <frame.png>   (needs Pillow)"""
import base64, io, re, sys
from PIL import Image

def cover(im, w, h):
    k = max(w / im.width, h / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))

frame = Image.open(sys.argv[1]).convert('RGB')
cover(frame, 480, 396).save('public/arcade/riftwalk.webp', 'WEBP', quality=82, method=6)
quality = 80
while True:
    data = io.BytesIO(); cover(frame, 448, 370).save(data, 'WEBP', quality=quality, method=6)
    if data.tell() < 56 * 1024 or quality <= 40: break
    quality -= 6
line = "          riftwalk: 'data:image/webp;base64," + base64.b64encode(data.getvalue()).decode() + "',\n"
path = 'public/corridor/index.html'; text = open(path, encoding='utf-8').read()
text = re.sub(r"^ +riftwalk: 'data:image/webp;base64,[^']+',\n", '', text, flags=re.M)
at = re.search(r"^ +ledger: 'data:image/webp;base64,[^']+',\n", text, flags=re.M)
if not at: sys.exit('the ledger art line was not found in the Corridor')
open(path, 'w', encoding='utf-8').write(text[:at.end()] + line + text[at.end():])
print('wrote public/arcade/riftwalk.webp and the Corridor art,', data.tell(), 'bytes at quality', quality)

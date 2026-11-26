"""Joins each e2e screenshot pair (site 880px + panel 400px) into a 1280x800
store screenshot."""
import glob, os, sys
from PIL import Image

shots = sys.argv[1] if len(sys.argv) > 1 else 'e2e/shots'
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(shots, 'store')
os.makedirs(out, exist_ok=True)
for site in sorted(glob.glob(os.path.join(shots, '*-site.png'))):
    name = os.path.basename(site)[: -len('-site.png')]
    panel = site.replace('-site.png', '-panel.png')
    canvas = Image.new('RGB', (1280, 800), 'white')
    canvas.paste(Image.open(site).convert('RGB'), (0, 0))
    canvas.paste(Image.open(panel).convert('RGB'), (880, 0))
    canvas.save(os.path.join(out, f'{name}.png'))
    print(name)

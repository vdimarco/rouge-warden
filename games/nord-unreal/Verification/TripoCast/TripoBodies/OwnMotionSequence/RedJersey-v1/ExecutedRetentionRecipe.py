"""Retain checked CPU frames as a seven-second video and exhaustive contact sheets."""
from pathlib import Path
import hashlib
import json
import math
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[3]
name = sys.argv[1]
assert name in ('BlackCap', 'Topknot', 'Memphis33', 'WhiteCap', 'LimeJacket', 'GreenCap51', 'RedJersey')
source = root / (f'Saved/Tests/TripoOwnMotionSequence-Remaining-20261017-v1/{name}' if name in ('Memphis33', 'WhiteCap') else 'Saved/Tests/TripoOwnMotionSequence-LimeJacket-20261017-v2/sequence' if name == 'LimeJacket' else f'Saved/Tests/TripoOwnMotionSequence-{name}-20261017-v1')
if name in ('GreenCap51', 'RedJersey'):
    source = root / f'Saved/Tests/TripoOwnMotionSequence-{name}-20261017-v1/sequence'
output = root / f'Verification/TripoCast/TripoBodies/OwnMotionSequence/{name}-v1'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
report = json.loads((source / 'Readback.json').read_text())
assert report['passed'] and report['device'] == 'CPU' and report['fps'] == 30
assert len(report['frames']) == 210 and not output.exists()
for i, frame in enumerate(report['frames']):
    assert frame['file'] == f'{i:03}.png' and frame['body_vs_clip_pose_error'] < 2e-5
    assert sha(source / frame['file']) == frame['sha256']
output.mkdir(parents=True)
video = output / f'{name}-own-rig-cpu.mp4'
command = ['ffmpeg', '-v', 'error', '-nostdin', '-n', '-framerate', '30', '-start_number', '0',
           '-i', str(source / '%03d.png'), '-frames:v', '210', '-c:v', 'libx264', '-threads', '4',
           '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(video)]
subprocess.run(command, check=True, timeout=120)
probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
    '-count_frames', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames,duration', '-of', 'json', str(video)]))['streams']
assert len(probe) == 1 and probe[0]['nb_read_frames'] == '210' and probe[0]['r_frame_rate'] == '30/1'
assert abs(float(probe[0]['duration']) - 7.) < 1e-6
assert [probe[0]['width'], probe[0]['height']] == report['dimensions']
groups = [('idle-a', list(range(64)), 8, 96), ('idle-b', list(range(64, 121)), 8, 96),
          ('walk', list(range(121, 153)), 8, 128), ('run', list(range(153, 173)), 5, 154),
          ('jump', list(range(173, 210)), 8, 128)]
sheets = []
seen = []
for title, indexes, columns, width in groups:
    height = round(width * 480 / 384)
    sheet = Image.new('RGB', (columns * width, math.ceil(len(indexes) / columns) * (height + 16)), '#161a21')
    draw = ImageDraw.Draw(sheet)
    for i, index in enumerate(indexes):
        frame = report['frames'][index]
        with Image.open(source / frame['file']) as im:
            assert list(im.size) == report['dimensions']
            sheet.paste(im.convert('RGB').resize((width, height)), ((i % columns) * width, (i // columns) * (height + 16)))
        draw.text(((i % columns) * width + 2, (i // columns) * (height + 16) + height),
                  f'{index:03} {frame["seconds"]:.2f}s', fill='white')
        seen.append(index)
    file = output / (title + '.jpg'); sheet.save(file, quality=93)
    sheets.append({'file': file.name, 'frames': indexes, 'sha256': sha(file)})
assert seen == list(range(210))
for filename in ('Readback.json', 'ExecutedRecipe.py'):
    shutil.copyfile(source / filename, output / filename)
log = Path(f'/tmp/nord-h31-{name.lower()}-sequence-v1.log')
if log.exists(): shutil.copyfile(log, output / 'render.log')
retained = {'passed': True, 'complete_frame_count': 210, 'video': {'file': video.name, 'sha256': sha(video), 'probe': probe},
    'sheets': sheets, 'encode_command': command, 'all_source_PNG_hashes_checked': True,
    'scope': 'Original-material own-body CPU clips, inclusive endpoints and hard cuts; no native actor flight, blending or prop grip.',
    'native_or_final_art_acceptance': False}
(output / 'Retention.json').write_text(json.dumps(retained, indent=2) + '\n')
shutil.copyfile(__file__, output / 'ExecutedRetentionRecipe.py')
print('RETAINED_SEQUENCE', output)

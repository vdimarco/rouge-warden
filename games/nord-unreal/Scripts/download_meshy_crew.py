"""Retain exact completed Meshy outputs. Reads result.json; never generates or spends."""
import concurrent.futures
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'Data/CharactersMeshy'
def download(item):
    path,remote=item
    url=urllib.parse.urlparse(remote['url'])
    assert url.scheme=='https' and url.hostname and url.hostname.endswith('.fal.media'),remote['url']
    size=remote['file_size'];assert isinstance(size,int) and 0<size<100_000_000
    if not path.exists() or path.stat().st_size!=size:
        temporary=path.with_suffix(path.suffix+'.part')
        with urllib.request.urlopen(remote['url'],timeout=120) as response,temporary.open('wb') as output:
            while block:=response.read(1<<20):output.write(block)
        assert temporary.stat().st_size==size,path
        temporary.replace(path)
    return {'file':str(path.relative_to(ROOT)),'bytes':size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
files=[]
for record in sorted(ROOT.glob('*/result.json')):
    source=record.parent;r=json.loads(record.read_text())
    outputs={'body.glb':r['rigged_character_glb'],'body.fbx':r['rigged_character_fbx'],'walk.fbx':r['basic_animations']['walking_fbx'],'idle.fbx':r['animation_fbx'],'preview.png':r['thumbnail']}
    assert len(r['texture_urls'])==1,'Expected one texture atlas'
    outputs.update({channel+'.png':r['texture_urls'][0][channel] for channel in ('base_color','normal','roughness','metallic')})
    files.extend((source/name,remote) for name,remote in outputs.items())
assert files,'No completed result.json files'
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:manifest=list(executor.map(download,files))
(ROOT/'files.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('NORD_MESHY_DOWNLOAD_OK',len(manifest))

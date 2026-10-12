"""Retain exact completed Meshy outputs. Reads result.json; never generates or spends.

Neutral pilot: --source-root Data/CharactersNeutral --names CurlyMetalhead
"""
import argparse
import concurrent.futures
from functools import partial
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path
PROJECT=Path(__file__).resolve().parents[1]
def download(item,source_root,known):
    path,remote=item
    assert not path.is_symlink(),path
    url=urllib.parse.urlparse(remote['url'])
    assert url.scheme=='https' and url.hostname and url.hostname.endswith('.fal.media'),remote['url']
    size=remote['file_size'];assert isinstance(size,int) and 0<size<100_000_000
    relative=str(path.relative_to(source_root));previous=known.get(relative)
    if previous:assert previous['bytes']==size,('Completed result changed; retain it in a new source folder',path)
    cached=path.exists() and path.stat().st_size==size
    if cached and previous:cached=hashlib.sha256(path.read_bytes()).hexdigest()==previous['sha256']
    if not cached:
        temporary=path.with_suffix(path.suffix+'.part')
        with urllib.request.urlopen(remote['url'],timeout=120) as response,temporary.open('wb') as output:
            while block:=response.read(1<<20):output.write(block)
        assert temporary.stat().st_size==size,path
        if previous:assert hashlib.sha256(temporary.read_bytes()).hexdigest()==previous['sha256'],path
        temporary.replace(path)
    return {'file':relative,'bytes':size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root',type=Path,default=Path('Data/CharactersMeshy'))
    parser.add_argument('--names',nargs='+',help='Download only these existing character folders.')
    args=parser.parse_args();source_root=(PROJECT/args.source_root).resolve()
    assert source_root.is_dir(),source_root
    if args.names:assert len(set(args.names))==len(args.names) and all(Path(n).name==n and n not in ('.','..') for n in args.names)
    records=[source_root/name/'result.json' for name in args.names] if args.names else sorted(source_root.glob('*/result.json'))
    manifest_path=source_root/'files.json'
    known={row['file']:row for row in json.loads(manifest_path.read_text())} if manifest_path.exists() else {}
    files=[]
    for record in records:
        assert record.is_file() and record.parent.resolve().parent==source_root,record
        source=record.parent;r=json.loads(record.read_text())
        outputs={'body.glb':r['rigged_character_glb'],'body.fbx':r['rigged_character_fbx'],'walk.fbx':r['basic_animations']['walking_fbx'],'idle.fbx':r['animation_fbx'],'preview.png':r['thumbnail'],
                 'run.fbx':r['basic_animations']['running_fbx'],'run.glb':r['basic_animations']['running_armature_glb']}
        assert len(r['texture_urls'])==1,'Expected one texture atlas'
        outputs.update({channel+'.png':r['texture_urls'][0][channel] for channel in ('base_color','normal','roughness','metallic')})
        files.extend((source/name,remote) for name,remote in outputs.items())
    assert files,'No completed result.json files'
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        downloaded=list(executor.map(partial(download,source_root=source_root,known=known),files))
    known.update((row['file'],row) for row in downloaded)
    manifest_path.write_text(json.dumps(list(known.values()),indent=2)+'\n')
    print('NORD_MESHY_DOWNLOAD_OK',len(downloaded))

if __name__=='__main__':main()

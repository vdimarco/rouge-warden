"""Check retained models, actual weighted geometry, textures, and request continuity."""
import argparse
import hashlib
import json
import math
import struct
import zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAMES=('GreenCap51','Memphis33','BlackCap','WhiteCap','RedJersey','LimeJacket','CurlyMetalhead','Topknot')

def inspect_fbx_rig(path,include_wrappers=False):
    """Read FBX rig metadata and small bind matrices; large arrays stay unexpanded."""
    raw=path.read_bytes();assert raw[:23]==b'Kaydara FBX Binary  \x00\x1a\x00',path
    wide=struct.unpack_from('<I',raw,23)[0]>=7500
    header=struct.Struct('<QQQB' if wide else '<IIIB');null=25 if wide else 13;nodes=[];matrices={}
    def prop(pos,name):
        kind=chr(raw[pos]);pos+=1
        if kind in 'YCFDIL':
            item=struct.Struct('<'+{'Y':'h','C':'?','F':'f','D':'d','I':'i','L':'q'}[kind])
            return item.unpack_from(raw,pos)[0],pos+item.size
        if kind in 'SR':
            size=struct.unpack_from('<I',raw,pos)[0];pos+=4;value=raw[pos:pos+size]
            return value.decode(errors='replace') if kind=='S' else None,pos+size
        assert kind in 'fdlibc',(path,kind)
        count,encoding,size=struct.unpack_from('<III',raw,pos)
        if name=='TransformLink':
            assert kind=='d' and count==16 and encoding in (0,1),path
            value=raw[pos+12:pos+12+size];value=zlib.decompress(value) if encoding else value
            return struct.unpack('<16d',value),pos+12+size
        return None,pos+12+size
    def node(pos,cluster=None):
        end,count,size,length=header.unpack_from(raw,pos)
        if not end:return pos+header.size
        assert pos<end<=len(raw),path
        pos+=header.size;name=raw[pos:pos+length].decode();pos+=length;props=[]
        for _ in range(count):value,pos=prop(pos,name);props.append(value)
        nodes.append((name,props))
        if name=='Deformer' and props[2]=='Cluster':cluster=props[0]
        if name=='TransformLink' and cluster is not None:matrices[cluster]=props[0]
        while pos<end-null:pos=node(pos,cluster)
        return end
    pos=27
    while pos<len(raw)-null:
        before=len(nodes);pos=node(pos)
        if len(nodes)==before:break
    bones={p[0]:p[1].split('\x00',1)[0].rsplit('::',1)[-1] for n,p in nodes if n=='Model' and p[2]=='LimbNode'}
    assert len(bones)>=20 and len(set(bones.values()))==len(bones),path
    parents={name:None for name in bones.values()}
    for n,p in nodes:
        if n=='C' and p[0]=='OO' and p[1] in bones and p[2] in bones:parents[bones[p[1]]]=bones[p[2]]
    assert {'Hips','Head','neck','RightHand','LeftLeg','RightLeg'}<=set(parents),path
    bindings={p[1].split('\x00',1)[0]:matrices[p[0]] for n,p in nodes if n=='Deformer' and p[2]=='Cluster'}
    assert all(math.isfinite(v) for matrix in bindings.values() for v in matrix),path
    if include_wrappers:
        # Unreal retains the FBX Null ancestor (Armature) above Hips. Include
        # only actual skeleton ancestors, never mesh siblings or arbitrary extras.
        models={p[0]:(p[1].split('\x00',1)[0].rsplit('::',1)[-1],p[2]) for n,p in nodes if n=='Model'}
        model_parents={p[1]:p[2] for n,p in nodes if n=='C' and p[0]=='OO' and p[1] in models and (p[2] in models or p[2]==0)}
        selected=set(bones)
        for bone in bones:
            chain={bone};parent=model_parents.get(bone,0)
            while parent:
                assert parent not in chain and models[parent][1] in ('Null','LimbNode'),(path,'Invalid skeleton ancestor',parent)
                chain.add(parent);selected.add(parent);parent=model_parents.get(parent,0)
        wrappers={models[key][0] for key in selected-set(bones)}
        assert wrappers.isdisjoint(bindings),(path,'Weighted wrapper root',wrappers)
        parents={models[key][0]:models[model_parents[key]][0] if model_parents.get(key) in selected else None for key in selected}
        assert len(parents)==len(selected),(path,'Duplicate wrapper/bone names')
    return parents,sum(n=='AnimationCurve' for n,p in nodes),bindings

def inspect_run(path):
    raw=path.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
    assert magic==0x46546c67 and version==2 and length==len(raw),path
    count,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
    data=json.loads(raw[20:20+count]);start=28+count
    def values(index):
        a=data['accessors'][index];v=data['bufferViews'][a['bufferView']]
        assert a['componentType']==5126 and a['type'] in ('SCALAR','VEC3','VEC4')
        width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];item=struct.Struct('<'+'f'*width)
        offset=start+v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',item.size)
        result=[item.unpack_from(raw,offset+i*stride) for i in range(a['count'])]
        assert all(math.isfinite(x) for row in result for x in row)
        return result
    channels=data['animations'][0]['channels'];samplers=data['animations'][0]['samplers']
    assert len(channels)>=40
    knees=[]
    for channel in channels:
        sampler=samplers[channel['sampler']];times=values(sampler['input']);poses=values(sampler['output'])
        assert len(times)==len(poses)>10 and all(a[0]<=b[0] for a,b in zip(times,times[1:]))
        assert .6<times[-1][0]<.75, times[-1]
        if data['nodes'][channel['target']['node']]['name'] in ('LeftLeg','RightLeg') and channel['target']['path']=='rotation':
            swing=max(max(row[i] for row in poses)-min(row[i] for row in poses) for i in range(4))
            assert swing>.3,'Running clip lacks a knee bend';knees.append(swing)
    assert len(knees)==2
    return {'run_seconds':round(times[-1][0],3),'run_tracks':len(channels)}

def inspect_glb(path):
    raw=path.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
    assert magic==0x46546c67 and version==2 and length==len(raw),path
    count,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
    data=json.loads(raw[20:20+count]);start=28+count
    binary_length,binary_kind=struct.unpack_from('<II',raw,20+count)
    assert binary_kind==0x004e4942 and start+binary_length<=len(raw)
    def accessor(index):
        a=data['accessors'][index];v=data['bufferViews'][a['bufferView']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]
        item=struct.Struct('<'+fmt*width);stride=v.get('byteStride',item.size)
        offset=start+v.get('byteOffset',0)+a.get('byteOffset',0)
        assert stride>=item.size and offset+(a['count']-1)*stride+item.size<=start+v.get('byteOffset',0)+v['byteLength']
        values=[item.unpack_from(raw,offset+i*stride) for i in range(a['count'])]
        assert all(math.isfinite(x) for row in values for x in row),path
        return values
    assert data['skins'] and len(data['skins'][0]['joints'])>=20
    assert all('bufferView' in image for image in data['images'])
    triangles=0;positions=[]
    for mesh in data['meshes']:
        for primitive in mesh['primitives']:
            a=primitive['attributes'];p=accessor(a['POSITION']);positions.extend(p)
            uv=accessor(a['TEXCOORD_0']);weights=accessor(a['WEIGHTS_0']);joints=accessor(a['JOINTS_0'])
            assert len(p)==len(uv)==len(weights)==len(joints)
            assert max(x for row in uv for x in row)-min(x for row in uv for x in row)>.5
            assert all(abs(sum(row)-1)<.02 for row in weights)
            assert all(0<=j<len(data['skins'][0]['joints']) for row in joints for j in row)
            indices=accessor(primitive['indices']);assert len(indices)%3==0
            assert all(0<=i[0]<len(p) for i in indices);triangles+=len(indices)//3
    height=max(p[1] for p in positions)-min(p[1] for p in positions)
    assert 1.6<height<2.1 and 15000<triangles<65000,(path,height,triangles)
    return {'triangles':triangles,'vertices':len(positions),'bones':len(data['skins'][0]['joints']),'height_m':round(height,3)}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root',type=Path,default=Path('Data/CharactersMeshy'))
    parser.add_argument('--names',nargs='+',choices=NAMES,default=NAMES)
    parser.add_argument('--report',type=Path,help='Optional isolated verification JSON path.')
    args=parser.parse_args();source=(ROOT/args.source_root).resolve();reports=[];requests=set();rig_tasks=set()
    assert len(set(args.names))==len(args.names),'Duplicate character selection'
    original=source==(ROOT/'Data/CharactersMeshy').resolve()
    manifest={row['file']:row for row in json.loads((source/'files.json').read_text())}
    for name in args.names:
        folder=source/name;request=json.loads((folder/'request.json').read_text())
        assert folder.resolve().parent==source,folder
        assert request['status']=='submitted' and request['endpoint_id']=='meshy/v7.1/image-to-3d'
        assert request['request_id'] not in requests;requests.add(request['request_id'])
        assert request['recipe']['input']['enable_rigging'] and request['recipe']['input']['animation_action_id']==0
        result=json.loads((folder/'result.json').read_text())
        assert result['rig_task_id'] not in rig_tasks;rig_tasks.add(result['rig_task_id'])
        body_rig,_,body_bindings=inspect_fbx_rig(folder/'body.fbx');clip_hashes={}
        assert len(body_bindings)>=20,(name,'Body has no weighted bind matrices')
        for clip in ('idle','walk','run','jump'):
            path=folder/(clip+'.fbx');clip_rig,curves,bindings=inspect_fbx_rig(path)
            assert clip_rig==body_rig,(name,clip,'Clip hierarchy differs from its own source body')
            if clip!='jump':
                assert bindings.keys()==body_bindings.keys(),(name,clip,'Weighted rig differs from its own source body')
                assert all(abs(a-b)<1e-5 for key in bindings for a,b in zip(bindings[key],body_bindings[key])),(name,clip,'Clip bind pose differs from its own source body')
            assert curves>=40,(name,clip,'No skeletal animation tracks')
            clip_hashes[clip]=hashlib.sha256(path.read_bytes()).hexdigest()
        jump=json.loads((folder/'jump.json').read_text())
        assert jump['body_sha256']==hashlib.sha256((folder/'body.fbx').read_bytes()).hexdigest()
        assert jump['jump_sha256']==hashlib.sha256((folder/'jump.fbx').read_bytes()).hexdigest()
        assert jump['head_and_neck_unchanged'] and jump['fbx_round_trip_passed'] and not jump['actor_root_motion']
        assert jump['seconds']==1.2 and len(jump['samples'])==37
        assert jump['samples'][0]['hip_drop_cm']==jump['samples'][-1]['hip_drop_cm']==0
        assert min(frame['thigh_degrees'] for frame in jump['samples'])<-55
        assert max(frame['knee_degrees'] for frame in jump['samples'])>95
        reports.append({'name':name,**inspect_glb(folder/'body.glb'),**inspect_run(folder/'run.glb'),'jump_seconds':jump['seconds'],
                        'request_id':request['request_id'],'rig_task_id':result['rig_task_id'],'clip_sha256':clip_hashes})
        expected={'body.glb':result['rigged_character_glb'],'body.fbx':result['rigged_character_fbx'],'walk.fbx':result['basic_animations']['walking_fbx'],
                  'idle.fbx':result['animation_fbx'],'run.fbx':result['basic_animations']['running_fbx'],'run.glb':result['basic_animations']['running_armature_glb']}
        assert len(result['texture_urls'])==1
        expected.update({channel+'.png':result['texture_urls'][0][channel] for channel in ('base_color','normal','roughness','metallic')})
        for filename,remote in expected.items():
            row=manifest[name+'/'+filename];path=folder/filename
            assert row['bytes']==remote['file_size']==path.stat().st_size,(name,filename,'Completed result size mismatch')
        for filename in ('reference.png','base_color.png','normal.png','metallic.png','roughness.png'):
            raw=(folder/filename).read_bytes();assert raw[:8]==b'\x89PNG\r\n\x1a\n'
            width,height=struct.unpack_from('>II',raw,16)
            assert min(width,height)>=1024,(name,filename,width,height)
    for f in manifest.values():
        assert not Path(f['file']).is_absolute() and '..' not in Path(f['file']).parts,f
        if Path(f['file']).parts[0] not in args.names:continue
        p=source/f['file'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],p
    if original and 'CurlyMetalhead' in args.names:
        assert hashlib.sha256((source/'CurlyMetalhead/face-reference.png').read_bytes()).hexdigest()=='4484d17008dc64d56e1a94d5784ca12420d243d385add978d9f8136a568ea76e'
    report={'passed':True,'source_root':str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),'characters':reports,
            'checks':'weighted geometry, bounds, UVs, completed output hashes, own body/clip bone hierarchies and bind poses, true running motion and locally authored jump FBX round trips'}
    report_path=ROOT/args.report if args.report else ROOT/'Verification'/('MeshySources.json' if original else source.name+'Sources.json')
    report_path.parent.mkdir(parents=True,exist_ok=True);report_path.write_text(json.dumps(report,indent=2)+'\n')
    print('NORD_MESHY_SOURCE_OK',len(reports),report_path)

if __name__=='__main__':main()

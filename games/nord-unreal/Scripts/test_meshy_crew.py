"""Check retained models, actual weighted geometry, textures, and request continuity."""
import hashlib
import json
import math
import struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAMES=('GreenCap51','Memphis33','BlackCap','WhiteCap','RedJersey','LimeJacket','CurlyMetalhead','Topknot')

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

if __name__=='__main__':
    source=ROOT/'Data/CharactersMeshy';reports=[];requests=set()
    for name in NAMES:
        folder=source/name;request=json.loads((folder/'request.json').read_text())
        assert request['status']=='submitted' and request['endpoint_id']=='meshy/v7.1/image-to-3d'
        assert request['request_id'] not in requests;requests.add(request['request_id'])
        assert request['recipe']['input']['enable_rigging'] and request['recipe']['input']['animation_action_id']==0
        jump=json.loads((folder/'jump.json').read_text())
        assert jump['body_sha256']==hashlib.sha256((folder/'body.fbx').read_bytes()).hexdigest()
        assert jump['jump_sha256']==hashlib.sha256((folder/'jump.fbx').read_bytes()).hexdigest()
        assert jump['head_and_neck_unchanged'] and jump['fbx_round_trip_passed'] and not jump['actor_root_motion']
        assert jump['seconds']==1.2 and len(jump['samples'])==37
        assert jump['samples'][0]['hip_drop_cm']==jump['samples'][-1]['hip_drop_cm']==0
        assert min(frame['thigh_degrees'] for frame in jump['samples'])<-55
        assert max(frame['knee_degrees'] for frame in jump['samples'])>95
        reports.append({'name':name,**inspect_glb(folder/'body.glb'),**inspect_run(folder/'run.glb'),'jump_seconds':jump['seconds']})
        for filename in ('reference.png','base_color.png','normal.png','metallic.png','roughness.png'):
            raw=(folder/filename).read_bytes();assert raw[:8]==b'\x89PNG\r\n\x1a\n'
            width,height=struct.unpack_from('>II',raw,16)
            assert min(width,height)>=1024,(name,filename,width,height)
    for f in json.loads((source/'files.json').read_text()):
        p=source/f['file'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],p
    assert hashlib.sha256((source/'CurlyMetalhead/face-reference.png').read_bytes()).hexdigest()=='4484d17008dc64d56e1a94d5784ca12420d243d385add978d9f8136a568ea76e'
    report={'passed':True,'characters':reports,'checks':'weighted geometry, bounds, UVs, original source hashes, true running motion and locally authored jump FBX round trips'}
    (ROOT/'Verification/MeshySources.json').write_text(json.dumps(report,indent=2)+'\n');print('NORD_MESHY_SOURCE_OK',len(reports))

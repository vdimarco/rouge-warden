"""Private FBX skin-array writer; preserve every other decoded typed property exactly."""
import array
import hashlib
import struct
import numpy as np
from io_scene_fbx import parse_fbx,encode_bin,data_types

def write_weight_delta(source,output,ob,base,expected,allowed,bones):
    tree,version=parse_fbx.parse(str(source))
    objects=next(e for e in tree.elems if e.id==b'Objects')
    connections=next(e for e in tree.elems if e.id==b'Connections')
    geometry=[e for e in objects.elems if e.id==b'Geometry' and e.props[2]==b'Mesh']
    assert len(geometry)==1
    geometry=geometry[0]
    child=lambda e,name:next(c for c in e.elems if c.id==name)
    positions=np.asarray(child(geometry,b'Vertices').props[0]).reshape(-1,3)
    actual=np.array([tuple(v.co) for v in ob.data.vertices],np.float32)
    assert np.array_equal(positions.astype(np.float32),actual), 'FBX control-point/imported coordinate identity required'
    pvi=np.asarray(child(geometry,b'PolygonVertexIndex').props[0]).copy()
    endings=np.flatnonzero(pvi<0);pvi[endings]^=-1
    assert np.array_equal(pvi,[v.vertex_index for v in ob.data.loops])
    assert np.array_equal(np.r_[0,endings[:-1]+1],[p.loop_start for p in ob.data.polygons])
    assert np.array_equal(np.diff(np.r_[-1,endings]),[p.loop_total for p in ob.data.polygons])
    assert len(positions)==len(base['weights'])
    oo=[(e.props[1],e.props[2]) for e in connections.elems if e.id==b'C' and e.props[0]==b'OO']
    models={e.props[0]:e for e in objects.elems if e.id==b'Model'}
    skins=[e for e in objects.elems if e.id==b'Deformer' and e.props[2]==b'Skin' and (e.props[0],geometry.props[0]) in oo]
    assert len(skins)==1
    clusters=[e for e in objects.elems if e.id==b'Deformer' and e.props[2]==b'Cluster' and (e.props[0],skins[0].props[0]) in oo]
    bybone={}
    for c in clusters:
        ids=[s for s,t in oo if t==c.props[0] and s in models]
        assert len(ids)==1
        name=models[ids[0]].props[1].split(b'\x00\x01')[0].decode()
        assert name in bones and name not in bybone
        bybone[name]=c
    assert set(bybone)==set(bones)
    matrix=np.zeros_like(base['weights'],dtype=np.float64)
    original_entries={}
    for name,c in bybone.items():
        ix=[v for v in c.elems if v.id==b'Indexes'];ws=[v for v in c.elems if v.id==b'Weights']
        assert len(ix)==len(ws) and len(ix)<=1
        ids=np.asarray(ix[0].props[0]) if ix else np.array([],np.int32)
        values=np.asarray(ws[0].props[0]) if ws else np.array([],np.float64)
        assert len(ids)==len(values) and len(np.unique(ids))==len(ids)
        assert not len(ids) or (ids.min()>=0 and ids.max()<len(positions))
        assert np.isfinite(values).all() and (values>=0).all()
        matrix[ids,bones.index(name)]=values
        original_entries[name]=(ids,values,ix[0] if ix else None,ws[0] if ws else None)
    assert np.array_equal(matrix.astype(np.float32),base['weights']), 'FBX control-point weights must match the mapped base exactly'
    overrides={};changed_clusters=[];after=matrix.copy()
    for column,name in enumerate(bones):
        ids,values,ix,ws=original_entries[name]
        changed=allowed & (base['weights'][:,column]!=expected[:,column])
        if not changed.any():continue
        assert name=='pelvis' or name.startswith(('thigh_','calf_','foot_','ball_'))
        assert ix is not None and ws is not None
        pairs={int(i):float(w) for i,w in zip(ids,values)}
        for i in np.flatnonzero(changed):
            value=float(expected[i,column])
            if value:pairs[int(i)]=value
            else:pairs.pop(int(i),None)
        newids=np.array(list(pairs),np.int32);newvalues=np.array(list(pairs.values()),np.float64)
        outside=~allowed[ids]
        assert all(struct.pack('<d',pairs[int(i)])==struct.pack('<d',float(w)) for i,w in zip(ids[outside],values[outside]))
        after[:,column]=0;after[newids,column]=newvalues
        overrides[id(ix)]=array.array('i',map(int,newids));overrides[id(ws)]=array.array('d',map(float,newvalues))
        changed_clusters.append({'bone':name,'cluster_id':c.props[0],'control_points':np.flatnonzero(changed).tolist()})
    assert np.array_equal(after.astype(np.float32),expected)
    assert np.array_equal(after[~allowed],matrix[~allowed])
    untouched=[i for i,n in enumerate(bones) if n!='pelvis' and not n.startswith(('thigh_','calf_','foot_','ball_'))]
    assert np.array_equal(after[:,untouched],matrix[:,untouched])
    methods={'BOOL':'add_bool','CHAR':'add_char','INT8':'add_int8','INT16':'add_int16','INT32':'add_int32','INT64':'add_int64',
      'FLOAT32':'add_float32','FLOAT64':'add_float64','BYTES':'add_bytes','STRING':'add_string','INT32_ARRAY':'add_int32_array',
      'INT64_ARRAY':'add_int64_array','FLOAT32_ARRAY':'add_float32_array','FLOAT64_ARRAY':'add_float64_array',
      'BOOL_ARRAY':'add_bool_array','BYTE_ARRAY':'add_byte_array'}
    typed={getattr(data_types,k):v for k,v in methods.items()}
    def clone(e):
        new=encode_bin.FBXElem(e.id)
        for i,(code,value) in enumerate(zip(e.props_type,e.props)):
            value=overrides[id(e)] if id(e) in overrides and i==0 else value
            getattr(new,typed[code])(value)
        new.elems=[clone(c) for c in e.elems]
        return new
    encoded=clone(tree)
    encode_bin.write(str(output),encoded,version)
    rewritten,v=parse_fbx.parse(str(output));assert v==version
    def bits(code,value):
        if isinstance(value,array.array):return value.tobytes()
        if isinstance(value,bytes):return value
        formats={data_types.BOOL:'<?',data_types.INT8:'<b',data_types.INT16:'<h',data_types.INT32:'<i',data_types.INT64:'<q',data_types.FLOAT32:'<f',data_types.FLOAT64:'<d'}
        return struct.pack(formats[code],value)
    counts={'elements':0,'non_weight_properties_bit_exact':0,'edited_weight_array_properties':0}
    def compare(a,b):
        assert a.id==b.id and a.props_type==b.props_type and len(a.elems)==len(b.elems) and len(a.props)==len(b.props)
        counts['elements']+=1
        for i,(code,x,y) in enumerate(zip(a.props_type,a.props,b.props)):
            if id(a) in overrides:
                assert i==0 and bits(code,overrides[id(a)])==bits(code,y)
                counts['edited_weight_array_properties']+=1
            else:
                assert bits(code,x)==bits(code,y), ('Non-weight FBX property changed',a.id,i)
                counts['non_weight_properties_bit_exact']+=1
        for x,y in zip(a.elems,b.elems):compare(x,y)
    compare(tree,rewritten)
    assert counts['edited_weight_array_properties']==len(overrides)>0
    return {'passed':True,'method':'Typed FBX Cluster Indexes/Weights only; all other semantic property bytes identical',
      'version':version,'control_point_import_identity_proven':True,'control_point_count':len(positions),
      'original_cluster_weights_match_base_float32_exact':True,'outside_and_other_channels_float64_bit_exact':True,
      'no_metadata_exemptions':True,'property_comparison':counts,'changed_clusters':changed_clusters,
      'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}

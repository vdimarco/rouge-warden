import bpy, hashlib, json, sys
from pathlib import Path
import numpy as np

O=Path(__file__).resolve().parent
R=O.parents[2]
sys.path.insert(0,str(R/'Scripts'))
import prepare_tripo_cast_surface as surface
inputs=json.loads((O/'Inputs.json').read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert bpy.app.background and bpy.context.scene.render.threads==4
assert all(sha(v['path'])==sha(v['copy'])==v['sha256'] for v in inputs.values())

class Union:
    def __init__(self,n):self.p=list(range(n))
    def find(self,a):
        while self.p[a]!=a:self.p[a]=self.p[self.p[a]];a=self.p[a]
        return a
    def join(self,a,b):
        a,b=self.find(a),self.find(b)
        if a!=b:self.p[b]=a
    def labels(self):return np.unique([self.find(i) for i in range(len(self.p))],return_inverse=True)[1]

check=Union(4);check.join(0,1);check.join(1,2)
assert check.find(0)==check.find(2) and check.find(0)!=check.find(3)

def topology(mesh,points,tolerance=None):
    n=len(points);u=Union(n)
    if tolerance:
        _,first,inverse=np.unique(np.rint(points/tolerance).astype(np.int64),axis=0,return_index=True,return_inverse=True)
        for i,j in enumerate(first[inverse]):u.join(i,int(j))
    for edge in mesh.edges:u.join(*edge.vertices)
    return u.labels()

def summarize(labels,points,weights,names,minimum=1):
    rows=[]
    for label in np.unique(labels):
        ids=np.flatnonzero(labels==label)
        if len(ids)<minimum:continue
        row={'id':int(label),'vertices':len(ids),'bounds_min':points[ids].min(axis=0).tolist(),'bounds_max':points[ids].max(axis=0).tolist()}
        if weights is not None:
            sums=weights[ids].sum(axis=0);order=np.argsort(sums)[::-1]
            row['mean_bone_weights']={names[i]:float(sums[i]/len(ids)) for i in order if sums[i]>1e-6}
        rows.append(row)
    return sorted(rows,key=lambda r:r['vertices'],reverse=True)

report={'passed':False,'scope':'Read-only copied-input topology and weight diagnosis; no mesh/weight/save/render/API changes','inputs':inputs,'blender':bpy.app.version_string,'threads':4,'position_welding_diagnostic_only':True,'roi_masks_accepted':False}
try:
    sr,sm=surface.load_mesh(Path(inputs['source']['copy']),allow_static=True)
    assert sr is None
    source_points=np.array([tuple(sm.matrix_world@v.co) for v in sm.data.vertices])
    source_index=topology(sm.data,source_points)
    source_weld=topology(sm.data,source_points,1e-6)
    mat=sm.data.materials[0];bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    image=bsdf.inputs['Base Color'].links[0].from_node.image
    width,height=image.size;pixels=np.empty(len(image.pixels),np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(height,width,4)
    report['source']={'vertices':len(source_points),'polygons':len(sm.data.polygons),'index_components':summarize(source_index,source_points,None,[]),'weld_1micron_components':summarize(source_weld,source_points,None,[]),'base_color_size':[width,height]}
    rig,ob=surface.load_mesh(Path(inputs['provider']['copy']))
    mesh=ob.data;n=len(mesh.vertices)
    assert len(rig.data.bones)==61
    points=np.array([tuple(ob.matrix_world@v.co) for v in mesh.vertices])
    names=list(rig.data.bones.keys());groups={g.index:g.name for g in ob.vertex_groups};columns={name:i for i,name in enumerate(names)}
    weights=np.zeros((n,len(names)),np.float32)
    for v in mesh.vertices:
        for g in v.groups:
            if g.weight:weights[v.index,columns[groups[g.group]]]=g.weight
    assert np.isfinite(weights).all() and (weights>=0).all() and np.max(np.abs(weights.sum(axis=1)-1))<1e-4
    index=topology(mesh,points);weld=topology(mesh,points,1e-6)
    uv=np.array([tuple(v.uv) for v in mesh.uv_layers.active.data]);loopverts=np.array([v.vertex_index for v in mesh.loops],np.int32)
    colors=np.zeros((n,3));counts=np.zeros(n)
    sample=pixels[np.clip((uv[:,1]*height).astype(int),0,height-1),np.clip((uv[:,0]*width).astype(int),0,width-1),:3]
    np.add.at(colors,loopverts,sample);np.add.at(counts,loopverts,1);colors/=np.maximum(counts[:,None],1)
    del pixels
    faces=[list(p.vertices) for p in mesh.polygons]
    uvunion=Union(len(faces));edges={};qpos=np.rint(points/1e-6).astype(np.int64);quv=np.rint(uv/1e-6).astype(np.int64)
    for face in mesh.polygons:
        loops=list(face.loop_indices)
        for i,l in enumerate(loops):
            k=loops[(i+1)%len(loops)]
            a=tuple(qpos[loopverts[l]])+tuple(quv[l]);b=tuple(qpos[loopverts[k]])+tuple(quv[k]);key=(a,b) if a<b else (b,a)
            if key in edges:uvunion.join(face.index,edges[key])
            else:edges[key]=face.index
    uvislands=uvunion.labels();facecenters=np.array([points[f].mean(axis=0) for f in faces])
    uvsummary=[]
    for label in np.unique(uvislands):
        faceids=np.flatnonzero(uvislands==label);ids=np.unique(np.concatenate([faces[i] for i in faceids]))
        row=summarize(np.zeros(len(ids),int),points[ids],weights[ids],names)[0];row.update(id=int(label),polygons=len(faceids));uvsummary.append(row)
    H=float(np.ptp(points[:,2]));z=(points[:,2]-points[:,2].min())/H
    pelvis=np.array(tuple(rig.matrix_world@rig.data.bones['pelvis'].head_local));x=(points[:,0]-pelvis[0])/H;y=(points[:,1]-pelvis[1])/H
    neutral_dark=(colors.max(axis=1)<.40)&(np.ptp(colors,axis=1)<.14)
    masks={}
    for threshold in (.06,.10,.14):
        mask=(x>threshold)&(y>.015)&(y<.21)&(z>.43)&(z<.66)
        masks['bag_bulge_x_'+str(threshold)]=mask
        masks['bag_bulge_dark_x_'+str(threshold)]=mask&neutral_dark
    masks['front_strap_band']=(x>.055)&(z>.62)&(z<.86)&(np.abs(y-(.15-(z-.60)))<.035)
    masks['front_strap_dark_band']=masks['front_strap_band']&neutral_dark
    rois={}
    for name,mask in masks.items():
        ids=np.flatnonzero(mask)
        if not len(ids):rois[name]={'vertices':0};continue
        row=summarize(np.zeros(len(ids),int),points[ids],weights[ids],names)[0]
        row['index_components']=sorted(set(int(v) for v in index[ids]));row['weld_components']=sorted(set(int(v) for v in weld[ids]))
        touched=np.array([any(mask[v] for v in f) for f in faces]);inside=np.array([all(mask[v] for v in f) for f in faces]);boundary=touched&~inside
        row['fully_inside_faces']=int(inside.sum());row['mixed_boundary_faces']=int(boundary.sum())
        row['UV_islands_touched']=sorted(set(int(v) for v in uvislands[touched]));row['uv_islands_fully_within_mask']=sorted(set(int(v) for v in uvislands[touched])-set(int(v) for v in uvislands[~inside]))
        row['fraction_mean_weight_thigh_or_calf']=sum(v for k,v in row['mean_bone_weights'].items() if k.startswith(('thigh','calf')))
        rois[name]=row
    report['provider']={'vertices':n,'polygons':len(faces),'material_count':len(mesh.materials),'uv_layers':len(mesh.uv_layers),'height_world_m':H,'pelvis_world':pelvis.tolist(),'bone_names':names,'index_components':summarize(index,points,weights,names),'weld_1micron_components':summarize(weld,points,weights,names),'UV_islands':sorted(uvsummary,key=lambda r:r['polygons'],reverse=True),'ROIs_UNACCEPTED':rois}
    np.savez_compressed(O/'InventoryArrays.npz',points=points,weights=weights,bone_names=np.array(names),index_components=index,weld_components=weld,colors=colors,uv=uv,loopverts=loopverts,face_starts=np.array([p.loop_start for p in mesh.polygons]),face_sizes=np.array([p.loop_total for p in mesh.polygons]),uv_islands=uvislands,**{'roi_'+k:v for k,v in masks.items()})
    report['passed']=True
finally:
    report['retained_inputs_unchanged']=all(sha(v['path'])==sha(v['copy'])==v['sha256'] for v in inputs.values())
    report['recipe_sha256']=sha(__file__)
    (O/'Inventory.json').write_text(json.dumps(report,indent=2)+'\n')
    assert report['retained_inputs_unchanged']
print('TRIPO_TOPKNOT_BAG_DIAGNOSIS_PASS',O,flush=True)

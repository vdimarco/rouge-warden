# Private proposal code inserted after the pinned source/PBR load. No mesh/weight changes.
from mathutils.bvhtree import BVHTree
old_dir=ROOT/'Saved/Tests/TripoTopknotBagMask-v1/Refinement-02'
old_arrays=old_dir/'SelectionArrays.npz'
assert sha(old_arrays)=='feb6c1816306bac1fe079747673ab168edf414accfc5755731ea0d02a22bb13a'
old=np.load(old_arrays)
assert np.array_equal(faces,old['faces']) and np.array_equal(points,old['points'])
prior=old['labels']
views=[('front',(3,0,.6),(0,0,.49),1.12),('left',(0,3,.6),(0,0,.49),1.12),
 ('back',(-3,0,.6),(0,0,.49),1.12),('right',(0,-3,.6),(0,0,.49),1.12),
 ('bag-front',(2,.15,.64),(.055,.075,.585),.34),('bag-back',(-2,.20,.64),(-.03,.10,.585),.34),
 ('strap-front',(2,-.10,.78),(.025,-.015,.755),.36),
 ('contact-A',(2,-.1,.68),(.063,.031,.58),.13),
 ('contact-B',(-2,.12,.58),(-.055,.091,.548),.13),
 ('contact-D',(.7,1,.30),(.063,.114,.474),.14),
 ('hidden-back-high',(-1.5,1.,1.2),(-.03,.10,.56),.30),
 ('hidden-under',(.8,.6,.20),(.025,.08,.51),.30)]
def project(location,aim,scale):
    location=Vector(location);rotation=(Vector(aim)-location).to_track_quat('-Z','Y')
    cam=bpy.data.cameras.new('ProposalProjection');cam.type='ORTHO';cam.ortho_scale=scale
    bpy.context.scene.render.resolution_x=600;bpy.context.scene.render.resolution_y=720
    rectangle=cam.view_frame(scene=bpy.context.scene)
    width=max(v.x for v in rectangle)-min(v.x for v in rectangle)
    height=max(v.y for v in rectangle)-min(v.y for v in rectangle)
    at=np.array([tuple(rotation.inverted()@(Vector(p)-location)) for p in centers])
    return np.column_stack(((at[:,0]/width+.5)*600,(.5-at[:,1]/height)*720)),(Vector(aim)-location).normalized()
projections={};directions={}
for name,location,aim,scale in views:projections[name],directions[name]=project(location,aim,scale)
def inside(projected,polygon):
    x,y=projected.T;result=np.zeros(len(faces),bool)
    for (ax,ay),(bx,by) in zip(polygon,polygon[1:]+polygon[:1]):
        if ay!=by:result ^= ((ay>y)!=(by>y))&(x<(bx-ax)*(y-ay)/(by-ay)+ax)
    return result
front_band_polygon=[(143,236),(174,218),(198,260),(167,278)]
back_band_polygon=[(350,220),(390,245),(367,288),(328,262)]
front_band=inside(projections['bag-front'],front_band_polygon)&(centers[:,0]>0)&np.isin(prior,[1,3,4])
back_band=inside(projections['bag-back'],back_band_polygon)&(centers[:,0]<0)&np.isin(prior,[1,3,4])
assert front_band.any() and back_band.any()
front_top=float(centers[front_band,2].max());back_top=float(centers[back_band,2].max())
limit=np.where(centers[:,0]>=0,front_top,back_top)
front_outline=[(172,280),(212,311),(225,340),(272,329),(315,318),(347,312),(390,320),(413,337),(425,368),(456,394),(474,482),(475,550),(456,583),(415,604),(355,617),(296,617),(251,601),(226,575),(208,545),(203,491),(208,429),(198,390),(183,354),(164,308)]
back_outline=[(328,280),(359,293),(344,326),(332,348),(329,382),(325,428),(317,485),(303,537),(284,584),(245,602),(206,588),(181,554),(188,487),(199,433),(219,401),(248,384),(262,342),(282,313)]
front_shape=inside(projections['bag-front'],front_outline)
back_shape=inside(projections['bag-back'],back_outline)
envelope=(centers[:,2]>.44)&(centers[:,2]<limit+.006)&(centers[:,1]>-.035)&(centers[:,1]<.18)
possible=envelope&(front_shape|back_shape|np.isin(prior,[1,2,3,4]))
candidate_ids=np.flatnonzero(possible|front_band|back_band)
bvh=BVHTree.FromPolygons(points.tolist(),faces.tolist(),all_triangles=True)
visible=np.zeros(len(faces),bool);visibility_bits=np.zeros(len(faces),np.uint16)
for vindex,(name,_,_,_) in enumerate(views):
    projected=projections[name];direction=directions[name]
    for i in candidate_ids:
        pixel=projected[i]
        if not (0<=pixel[0]<600 and 0<=pixel[1]<720):continue
        hit=bvh.ray_cast(Vector(centers[i])-direction*3,direction,3.000003)
        if hit[2]==int(i):visible[i]=True;visibility_bits[i]|=1<<vindex
front_visible=(visibility_bits&(1<<4))!=0
back_visible=(visibility_bits&(1<<5))!=0
contour_visible=(front_shape&front_visible)|(back_shape&back_visible)
reason=np.zeros(len(faces),np.uint8)
label=np.zeros(len(faces),np.int8)
unknown=possible.copy()
r,g,b=face_rgb.T
source_skin=(r>g*1.16)&(r>b*1.28)&(r>.085)
bag_pbr=(maximum<.50)&(saturation<.48)&~source_skin
proposed=possible&contour_visible&bag_pbr
label[proposed]=1;reason[proposed]=1
# Prior bag/contents surfaces remain proposals only when actually visible; no hidden inference.
retained_primary=possible&visible&np.isin(prior,[1,2])&~source_skin
label[retained_primary]=prior[retained_primary];reason[retained_primary]=2
contents_outline=[(319,346),(359,346),(379,371),(380,390),(405,390),(425,409),(424,437),(407,449),(377,444),(360,430),(336,426),(321,405),(318,377)]
contents=possible&front_visible&inside(projections['bag-front'],contents_outline)&(centers[:,0]>0)&(centers[:,2]>.535)&(centers[:,2]<.615)&~source_skin
label[contents]=2;reason[contents]=3
band=(front_band&front_visible)|(back_band&back_visible)
label[band]=3;reason[band]=4
upper=np.isin(prior,[3,4])&(centers[:,2]>=limit)&~band
label[upper]=4;reason[upper]=5
confirmed_fixed=np.array([71144,71145,71146,50744,50950,53103,64804,65573])
confirmed_bag=np.array([71640,71869,72383,72618])
label[confirmed_fixed]=0;reason[confirmed_fixed]=6
label[confirmed_bag]=1;reason[confirmed_bag]=7
label[possible&source_skin]=0;reason[possible&source_skin]=8
unresolved=(possible&(label==0)&(reason==0))|(possible&~visible)
# Root has not resolved A, D or the hand/forearm-hidden interface.
A=np.array([53910,53912,54117,54334,54996,55237,55478])
D=np.array([81709,82022,82028,82873,82877,83461,83733])
unresolved[A]=True;unresolved[D]=True
unresolved[confirmed_fixed]=False;unresolved[confirmed_bag]=False
label[unresolved]=5;reason[unresolved]=9
assert not np.any(source_skin&np.isin(label,[1,2,3]))
assert all(label[i]==0 for i in confirmed_fixed) and all(label[i]==1 for i in confirmed_bag)
owned=np.isin(label,[1,2,3]);fixed=label==0;unresolved=label==5
incident=[[] for _ in points]
for i,f in enumerate(faces):
    for v in f:incident[v].append(i)
planned=[];blocked=[];band_anchors=[]
for v,fs in enumerate(incident):
    states=set(map(int,label[fs]))
    if 3 in states and 4 in states:band_anchors.append(v)
    if not states&{1,2,3}:continue
    if 5 in states:
        blocked.append(v)
    elif 0 in states and 4 not in states:
        planned.append({'raw_vertex_id':v,'bag_face_ids':[int(f) for f in fs if label[f] in (1,2,3)],
          'fixed_face_ids':[int(f) for f in fs if label[f]==0]})
assert next(row for row in planned if row['raw_vertex_id']==38348)['fixed_face_ids']==[71144,71145,71146]
candidates=planned
planned=[row for row in candidates if row['raw_vertex_id']==38348]
seam_ids={row['raw_vertex_id'] for row in candidates}
seam_faces={f for row in candidates for f in row['bag_face_ids']}
seam_edges=[]
for key in edges:
    if key[0] in seam_ids and key[1] in seam_ids:
        fa=[i for i in incident[key[0]] if i in incident[key[1]]]
        if any(owned[i] for i in fa) and any(fixed[i] for i in fa):seam_edges.append(list(key))
graph={v:[] for v in seam_ids}
for x,y in seam_edges:graph[x].append(y);graph[y].append(x)
seen=set();chains=[]
for v in sorted(graph):
    if v in seen:continue
    stack=[v];chain=[]
    while stack:
        x=stack.pop()
        if x in seen:continue
        seen.add(x);chain.append(x);stack.extend(graph[x])
    endpoints=[x for x in chain if len(graph[x])!=2]
    chains.append({'vertices':chain,'closed':not endpoints,'endpoints_or_branches':endpoints,
      'status':'Open/incomplete interface until neighboring unresolved ownership is reviewed' if endpoints else 'Closed proposed interface; ownership still for root review'})
roles={0:'fixed_or_unclaimed_body',1:'proposed_bag_pouches_connectors',2:'proposed_contents',3:'proposed_plain_strap_band',4:'fixed_upper_strap',5:'unresolved_do_not_guess'}
np.savez_compressed(O/'OwnershipArrays.npz',points=points,faces=faces,uv=uv,face_base_rgb=face_rgb,
    ownership=label,reason=reason,visible=visible,visibility_bits=visibility_bits)
document={'proposal_only':True,'deformation_or_mesh_edits':False,'not_ready_for_weight_pilot':True,
 'source_pins':pins,'prior_mask_sha256':sha(old_arrays),'role_codes':roles,
 'role_face_ids':{name:np.flatnonzero(label==i).tolist() for i,name in roles.items()},
 'reason_codes':{0:'Outside candidate assembly; unchanged',1:'Visible source PBR bag proposal',2:'Visible prior primary proposal',3:'Visible reviewed contents contour',4:'Visible plain-strap band',5:'Upper strap fixed',6:'Root-confirmed B shirt or reviewed negative cloth probe',7:'Root-confirmed B bag fan',8:'Skin protection diagnostic',9:'Unresolved hidden/ambiguous or A/D ownership'},
 'counts':{name:int((label==i).sum()) for i,name in roles.items()},
 'unresolved_hidden_face_ids':np.flatnonzero(possible&~visible).tolist(),
 'unresolved_A_face_ids':A.tolist(),'unresolved_D_face_ids':D.tolist(),
 'front_band_polygon_pixels':front_band_polygon,'rear_band_polygon_pixels':back_band_polygon,
 'front_band_top_z_m':front_top,'rear_band_top_z_m':back_top,
 'planned_raw_seam_duplicates':planned,'candidate_raw_seam_duplicates_unreviewed':candidates,'blocked_raw_interface_vertices':blocked,
 'planned_local_B_is_not_a_complete_seam':True,
 'band_upper_boundary_raw_vertex_ids':band_anchors,'band_policy':'No duplicate at upper band/upper strap interface; keep original anchored endpoint weights. No weights changed.',
 'seam_edges_raw':seam_edges,'seam_chains':chains,
 'root_confirmed_B':{'raw_vertex_id':38348,'fixed_face_ids':confirmed_fixed[:3].tolist(),'bag_face_ids':confirmed_bag.tolist()},
 'contact_limit':'A, D and hand/forearm-hidden ownership are unresolved. Source PBR color, projection and prior labels are not complete semantic proof. No backing/cap faces are created or assumed.',
 'visibility_views':[v[0] for v in views],'source_views':views,
 'arrays_sha256':sha(O/'OwnershipArrays.npz')}
(O/'Ownership.json').write_text(json.dumps(document,indent=2)+'\n')
print('SEAM_OWNERSHIP_PROPOSAL',document['counts'],'duplicates',len(planned),'blocked',len(blocked),flush=True)
uncertain=unresolved
rows={name:{'faces':int((label==i).sum()),'vertices':len(np.unique(faces[label==i].ravel()))} for i,name in roles.items()}

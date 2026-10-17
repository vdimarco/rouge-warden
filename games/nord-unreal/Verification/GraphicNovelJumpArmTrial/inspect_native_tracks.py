import importlib.util,json,datetime
from pathlib import Path
import unreal as u
plan=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('private_jump_inspect',plan/'native_trial.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
root=Path(u.Paths.project_dir()).resolve();n.offline(u,root);names,_=n.cpu_gate(root)
clip=u.load_asset(n.FOLDER+'/A_Jump');body=u.load_asset(n.FOLDER+'/SK_Body');meta,_=n.metadata(u,clip,body)
tracks=list(map(str,u.AnimationLibrary.get_animation_track_names(clip)))
ref=u.AnimPoseExtensions.get_reference_pose(body.get_editor_property('skeleton'))
reference_names=list(map(str,u.AnimPoseExtensions.get_bone_names(ref)))
options=u.AnimPoseEvaluationOptions();options.set_editor_property('evaluation_type',u.AnimDataEvalType.RAW);options.set_editor_property('should_retarget',False);options.set_editor_property('extract_root_motion',False);options.set_editor_property('optional_skeletal_mesh',body)
rows=[]
for t in (0.,.6,1.2):
 pose=u.AnimPoseExtensions.get_anim_pose_at_time(clip,t,options)
 rows.append({'seconds':t,'bones':{name:n.transform(u.AnimPoseExtensions.get_bone_pose(pose,name,u.AnimPoseSpaces.LOCAL)) for name in tracks}})
report={'read_only':True,'metadata':meta,'cpu_names':names,'tracks':tracks,'reference_names':reference_names,'reference':{name:n.transform(u.AnimPoseExtensions.get_bone_pose(ref,name,u.AnimPoseSpaces.LOCAL)) for name in tracks},'samples':rows}
p=plan/('ObservedNativeTracks-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json');p.write_text(json.dumps(report,indent=2)+'\n')
u.log('NORD_PRIVATE_JUMP_NATIVE_OK '+str(p))

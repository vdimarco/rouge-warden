"""CPU comparison: evidence-only fixture transform and original ownership/GPU guards."""
import ast, hashlib, importlib.util, json
from pathlib import Path
plan=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('capture_factory',plan/'prepare_capture.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
source=f.SOURCE.read_text();out=f.fixture_source(source,Path('/tmp/nord-private-capture-test/Capture'))
a,b=ast.parse(source),ast.parse(out)
functions=lambda tree:{n.name:ast.dump(n) for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}
assert functions(a)==functions(b), 'A pose/source/viewport/fixture assertion changed'
constants=lambda tree:[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant)]
ca,cb=constants(a),constants(b)
assert len(ca)==len(cb)
delta=[(x,y) for x,y in zip(ca,cb) if x!=y]
assert delta==[('HighDetailCapture','/tmp/nord-private-capture-test/Capture'),('Saved/Tests/GraphicNovel/HighDetailImport.json','Verification/GraphicNovelHighDetailPilot/NativeImport.json')],delta
rejected=0
for text in [source.replace("'HighDetailCapture'","'renamed-output'"),source+"\n'HighDetailCapture'\n",source.replace('HighDetailImport.json','other.json')]:
 try:f.fixture_source(text,Path('/tmp/never-written'))
 except AssertionError:rejected+=1
 else:raise AssertionError('Fixture drift unexpectedly accepted')
assert rejected==3
old=(f.OLD/'run_window.py').read_text();new=f.manager_source()
fa,fb=functions(ast.parse(old)),functions(ast.parse(new))
assert fa==fb, 'Manager GPU/service ownership/cleanup function changed'
assert "stream.check_gpu_memory()" in new and "assert not stream.rendered_jobs()" in new
assert "'/Game/Maps/LaFontaine'" in new
assert all(flag in new for flag in ['-NordGraphicNovelCandidate','-NordGraphicNovelGenerated','-NordGraphicNovelHighDetail','-NordGraphicNovelMotion','-NordQuality1920'])
assert '-NordDistrictRenderChecks' not in new and '-NordCaptureWidth' not in new
startup_flags=['-ini:EditorPerProjectUserSettings:[/Script/UnrealEd.LevelEditorPlaySettings]:PlayNetMode=PIE_Standalone','-ini:EditorPerProjectUserSettings:[/Script/UnrealEd.LevelEditorPlaySettings]:PlayNumberOfClients=1','-ini:EditorPerProjectUserSettings:[/Script/UnrealEd.LevelEditorPlaySettings]:RunUnderOneProcess=True']
job_loop=next(n for n in ast.walk(ast.parse(new)) if isinstance(n,ast.For) and isinstance(n.iter,ast.Name) and n.iter.id=='JOBS')
startup=next((i,n) for i,n in enumerate(job_loop.body) if isinstance(n,ast.AugAssign) and isinstance(n.target,ast.Name) and n.target.id=='command' and isinstance(n.value,ast.List) and [getattr(e,'value',None) for e in n.value.elts]==startup_flags)
immersive=next(i for i,n in enumerate(job_loop.body) if isinstance(n,ast.AugAssign) and '-immersive' in ast.unparse(n))
assert startup[0]<immersive, 'Standalone overrides must be unconditional before immersive/still branch'
for moving in (False,True):
 selected=[]
 exec(compile(ast.fix_missing_locations(ast.Module(body=[startup[1]],type_ignores=[])),'cpu-startup-flags','exec'),{'command':selected,'job':{'motion':moving}})
 assert selected==startup_flags

assert "len(report['screenshots']) == 7" in new and "recorder.returncode == 0" in new
assert "report['performance_diagnostic']['csv_flushed']" in new
assert "all(v==3 for k,v in quality.items() if k.startswith('sg.'))" in new
assert len(f.SG)==11 and len(set(f.SG))==11
assert all(f.sha(p)==h for p,h in f.PINS.items()),'Frozen source/helper changed'
# Model the actual final preservation assertion after the restoration branch.
# Native/service calls are replaced solely by an event to keep this check CPU-only.
import copy
outer=next(n for n in ast.parse(new).body if isinstance(n,ast.Try))
cleanup=next(n for n in outer.finalbody if isinstance(n,ast.Try))
restore=next(n for n in cleanup.body if isinstance(n,ast.If) and isinstance(n.test,ast.Name) and n.test.id=='paused')
preservation=next(n for n in cleanup.body if isinstance(n,ast.Assert) and 'private_jump_content_unchanged' in ast.unparse(n))
assert preservation.lineno>restore.end_lineno
restoration_model=copy.deepcopy(restore)
restoration_model.body=ast.parse("events.append('restoration_attempted')").body
checks=ast.fix_missing_locations(ast.Module(body=[restoration_model,copy.deepcopy(preservation)],type_ignores=[]))
for content_ok,pins_ok in [(True,True),(False,True),(True,False),(False,False)]:
 state={name:True for name in ['stream_helper_unchanged','global_settings_restored','source_settings_restored','preserved_units_unchanged']}
 state.update({name:[] for name in ['all_content_changed','frozen_source_changed','derivative_changed','protected_changed','generated_assets_changed','live_package_changed']})
 state.update(private_jump_content_unchanged=content_ok,private_jump_pins_unchanged=pins_ok,live_saves_changed_before_restart=False)
 namespace={'paused':True,'STATE':state,'events':[]}
 try:exec(compile(checks,'cpu-restoration-order','exec'),namespace)
 except AssertionError:assert not(content_ok and pins_ok)
 else:assert content_ok and pins_ok
 assert namespace['events']==['restoration_attempted']
result={'passed':True,'fixture_function_AST_identical':True,'only_fixture_literal_delta':delta,'negative_fixture_drift_rejections':rejected,'manager_function_AST_identical':True,'original_12GB_guard_called':True,'motion_flags_recording_and_flushed_CSV_guard_retained':True,'all_11_quality_categories_strict':True,'post_render_content_and_pin_drift_checked_after_restoration':True,'restoration_order_models':4,'standalone_one_client_before_immersive_or_stills':True,'engine_launched':False,'service_actions':False,'source_writes':False,'factory_sha256':f.sha(plan/'prepare_capture.py')}
(plan/'capture-cpu-check.json').write_text(json.dumps(result,indent=2)+'\n')
print('NORD_PRIVATE_CAPTURE_FACTORY_CPU_OK '+json.dumps(result))

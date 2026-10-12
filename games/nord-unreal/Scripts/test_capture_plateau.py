"""Check capture output validation and the native runner's shutdown handoff without Unreal."""
import ast
import json
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace


def main():
    source = ast.parse(Path(__file__).with_name('capture_plateau.py').read_text())
    functions = ast.Module(body=[node for node in source.body if isinstance(node,ast.FunctionDef)
                                 and node.name in ('finish','validate_screenshot')],type_ignores=[])
    calls = []
    state = {'files':['scene.png'],'finished':False,'callback':37,'task':object()}
    api = SimpleNamespace(log=lambda message:calls.append(('log',message)),
                          log_error=lambda message:calls.append(('error',message)),
                          unregister_slate_post_tick_callback=lambda handle:calls.append(('unregister',handle)))
    context = {'u':api,'state':state,'json':json,'struct':struct,'camera':'camera',
               'editor':SimpleNamespace(destroy_actor=lambda actor:calls.append(('destroy',actor))),
               'python_runner':SimpleNamespace(call_method=lambda name,args:calls.append((name,args)))}
    exec(compile(functions,'capture_plateau.py','exec'),context)
    context['finish']()
    assert [call[0] for call in calls] == ['log','unregister','destroy','SetKeepPythonScriptAlive']
    assert calls[-1][1] == (False,) and state['task'] is None and 'callback' not in state
    context['finish']('late reentrant callback')
    assert len(calls) == 4, 'Shutdown ran twice'
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)/'capture.png'
        path.write_bytes(b'\x89PNG\r\n\x1a\n'+struct.pack('>I',13)+b'IHDR'+struct.pack('>II',1280,720))
        context['validate_screenshot'](path,0)
        try:
            context['validate_screenshot'](path,path.stat().st_mtime_ns)
        except AssertionError:
            pass
        else:
            raise AssertionError('A stale screenshot was accepted')
        path.write_bytes(b'\x89PNG\r\n\x1a\n'+struct.pack('>I',13)+b'IHDR'+struct.pack('>II',640,480))
        try:
            context['validate_screenshot'](path,0)
        except AssertionError:
            pass
        else:
            raise AssertionError('Wrong screenshot dimensions were accepted')
    print('Plateau capture checks passed')


if __name__ == '__main__':
    main()

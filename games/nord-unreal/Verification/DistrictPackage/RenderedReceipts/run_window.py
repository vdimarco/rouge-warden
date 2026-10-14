import hashlib
import json
import os
from pathlib import Path
import select
import shutil
import signal
import subprocess
import sys
import time
import traceback

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
LIVE = Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
UE = '/home/von/.local/share/Epic/UE_5.8.3/Engine/Binaries/Linux/UnrealEditor'
BASE = json.loads((OUT / 'baseline.json').read_text())
JOBS = json.loads((OUT / 'jobs.json').read_text())
assert ROOT.name == 'nord-unreal' and (ROOT / 'Quebec.uproject').is_file()
sys.path.insert(0, str(LIVE / 'Scripts'))
import browser_streaming as stream
sys.path.insert(0, str(ROOT / 'Scripts'))
from render_log_guard import assert_render_log_clean
STATE = {'passed': False, 'phase': 'prepared', 'jobs': [], 'service_actions': [], 'restored': False}
children = []
paused = False
env = dict(os.environ)
env.update(BASE['demo']['environment'])
env.pop('WAYLAND_DISPLAY', None)
env['SDL_VIDEODRIVER'] = 'x11'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def save():
    temporary = OUT / 'window-status.tmp'
    temporary.write_text(json.dumps(STATE, indent=2) + '\n')
    temporary.replace(OUT / 'window-status.json')

def unit_value(key):
    return subprocess.run(['systemctl', '--user', 'show', 'nord-browser-demo.service', '-p', key, '--value'], text=True, capture_output=True).stdout.strip()

def stop_owned(process):
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=10)

def guard():
    assert not stream.rendered_jobs(), 'Another rendered Unreal job occupies the GPU'
    stream.check_gpu_memory()

def interrupted(*_):
    raise KeyboardInterrupt('Render window interrupted')

signal.signal(signal.SIGTERM, interrupted)
signal.signal(signal.SIGINT, interrupted)
try:
    assert time.time()<1792008000,'Too late for a bounded render window before the user deadline'
    assert sha(ROOT/'Saved/Config/LinuxEditor/EditorPerProjectUserSettings.ini') == BASE['editor_settings_sha256'], 'Source editor INI changed before pause'
    assert all(sha(Path(x['path'])) == x['sha256'] for x in BASE['global_ini_backup']), 'Global editor INI changed before pause'
    assert all(sha(ROOT/p) == h for p,h in BASE['capture_scripts_sha256'].items()), 'Frozen fixture changed before pause'
    assert unit_value('MainPID') == BASE['demo']['MainPID'] and unit_value('ActiveState') == 'active', 'Live demo ownership changed before pause'
    paused = True
    STATE['service_actions'].append('stop nord-browser-demo.service')
    subprocess.run(['systemctl', '--user', 'stop', 'nord-browser-demo.service'], check=True, timeout=60)
    guard()
    STATE['phase'] = 'paused'
    live_saves = {}
    for folder in (LIVE / 'Builds/Browser/Linux/Quebec').glob('Saved*'):
        for path in (folder / 'SaveGames').rglob('*'):
            if path.is_file():
                relative = path.relative_to(LIVE)
                destination = OUT / 'BeforeLiveSaves' / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, destination)
                live_saves[str(relative)] = sha(path)
    STATE['live_saves_before_render'] = live_saves
    save()
    read_fd, write_fd = os.pipe()
    xvfb_log = (OUT / 'xvfb.log').open('w')
    xvfb = subprocess.Popen(['Xvfb', '-displayfd', str(write_fd), '-screen', '0', '2048x1280x24', '-nolisten', 'tcp', '-noreset'], pass_fds=(write_fd,), stdout=xvfb_log, stderr=subprocess.STDOUT, start_new_session=True)
    children.append(xvfb)
    os.close(write_fd)
    assert select.select([read_fd], [], [], 15)[0], 'Private display did not start'
    display = os.read(read_fd, 100).decode().strip()
    os.close(read_fd)
    assert display.isdecimal(), 'Invalid private display allocation'
    env['DISPLAY'] = ':' + display
    STATE['display'] = env['DISPLAY']
    for job in JOBS:
        guard()
        STATE['phase'] = job['name']
        record = {'name': job['name'], 'command': [], 'process_exit_code': None, 'report': job['report'], 'video': None}
        STATE['jobs'].append(record)
        command = [sys.executable,str(ROOT/'Scripts/verify_district_package.py'),'--runner',BASE['package_runner'],'--output',str(OUT/'Package'),'--district','both','--rendered-startup']
        record['command'] = command
        save()
        stdout = Path(job['stdout']).open('w')
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=stdout, stderr=subprocess.STDOUT, start_new_session=True)
        children.append(process)
        recorder = None
        started = time.monotonic()
        while process.poll() is None:
            assert time.monotonic() - started < 360, 'Owned Unreal job timed out'
            if job['motion'] and recorder is None and Path(job['log']).exists() and 'NORD_PLAYER_MOTION_PHASE idle' in Path(job['log']).read_text(errors='replace'):
                markers = [line.split('NORD_PLAYER_MOTION_VIEWPORT ', 1)[1] for line in Path(job['log']).read_text(errors='replace').splitlines() if 'NORD_PLAYER_MOTION_VIEWPORT ' in line]
                assert len(markers) == 1, 'Missing verified native viewport rectangle'
                rectangle = json.loads(markers[0])
                assert rectangle['width'] == 1920 and rectangle['height'] == 1080 and 0 <= rectangle['x'] <= 128 and 0 <= rectangle['y'] <= 200, rectangle
                record['recording_rectangle'] = rectangle
                video = Path(job['log']).parent / 'raw.mp4'
                record['video'] = str(video)
                record['recording_started_monotonic'] = time.monotonic()
                video_log = (video.parent / 'ffmpeg.log').open('w')
                recorder = subprocess.Popen(['ffmpeg', '-hide_banner', '-f', 'x11grab', '-framerate', '60', '-video_size', '1920x1080', '-draw_mouse', '0', '-i', env['DISPLAY'] + '.0+' + str(rectangle['x']) + ',' + str(rectangle['y']), '-c:v', 'libx264', '-threads', '4', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', str(video)], stdin=subprocess.PIPE, stdout=video_log, stderr=subprocess.STDOUT, start_new_session=True)
                children.append(recorder)
                save()
            time.sleep(.1)
        record['process_exit_code'] = process.returncode
        stdout.close()
        if recorder:
            recorder.communicate(b'q\n', timeout=20)
            record['recorder_exit_code'] = recorder.returncode
            assert recorder.returncode == 0, 'Viewport recorder failed'
        assert process.returncode == 0, 'Unreal process did not exit cleanly'
        report_file=Path(job['report']);report=json.loads(report_file.read_text())
        assert report['passed'] and report['archive_preserved'] and report['rendered_startup'], report.get('error','Packaged native checks failed')
        assert set(report['districts'])=={'montreal','toronto'} and len(report['peers'])==6
        assert all(len(d['screenshots'])==7 for d in report['districts'].values()), 'Missing14startupstills'
        assert all(peer['exit_code']==0 for peer in report['peers']), 'Packaged peers failed to quit cleanly'
        assert {str(p.relative_to(Path(BASE['package_runner']).parent)):sha(p) for p in Path(BASE['package_runner']).parent.rglob('*') if p.is_file()}==BASE['tested_archive_sha256'], 'Isolated archive mutated'
        record['report_sha256']=sha(report_file)
        record['passed'] = True
        save()
    STATE['passed'] = True
except BaseException:
    STATE['error'] = traceback.format_exc()
finally:
    for process in reversed(children):
        stop_owned(process)
    try:
        shutil.copy2(OUT / 'EditorPerProjectUserSettings.before.ini', ROOT / 'Saved/Config/LinuxEditor/EditorPerProjectUserSettings.ini')
        for item in BASE['global_ini_backup']:
            shutil.copy2(OUT / item['backup'], item['path'])
        STATE['global_settings_restored'] = all(sha(Path(item['path'])) == item['sha256'] for item in BASE['global_ini_backup'])
        STATE['source_settings_restored'] = sha(ROOT / 'Saved/Config/LinuxEditor/EditorPerProjectUserSettings.ini') == BASE['editor_settings_sha256']
        STATE['protected_changed'] = [p for p, h in BASE['protected_sha256'].items() if sha(ROOT / p) != h]
        STATE['generated_assets_changed'] = [p for p, h in BASE['generated_assets_sha256'].items() if sha(ROOT / p) != h]
        STATE['all_content_changed'] = [p for p,h in BASE['all_content_sha256'].items() if sha(ROOT/p)!=h]
        STATE['frozen_source_changed'] = [p for p,h in BASE['frozen_graphic_novel_source_sha256'].items() if sha(ROOT/p)!=h]
        STATE['derivative_changed'] = [p for p,h in BASE['refinement_files_sha256'].items() if sha(ROOT/p)!=h]
        STATE['stream_helper_unchanged'] = sha(LIVE / 'Scripts/browser_streaming.py') == BASE['stream_helper_sha256']
        package = LIVE / 'Builds/Browser/Linux'
        STATE['live_package_changed'] = [p for p, h in BASE['live_package_sha256'].items() if sha(package / p) != h]
        live_saves_after = {str(p.relative_to(LIVE)): sha(p) for f in (LIVE/'Builds/Browser/Linux/Quebec').glob('Saved*') for p in (f/'SaveGames').rglob('*') if p.is_file()}
        STATE['live_saves_changed_before_restart'] = live_saves_after != STATE.get('live_saves_before_render', {})
        STATE['source_savegames_unchanged'] = {str(p.relative_to(ROOT)): sha(p) for p in (ROOT/'Saved/SaveGames').rglob('*') if p.is_file()} == BASE['source_savegames_sha256']
        if paused:
            STATE['phase'] = 'restoring demo'
            save()
            if unit_value('ActiveState') != 'active':
                with (OUT / 'restore-preflight.log').open('w') as log:
                    subprocess.run([sys.executable, str(LIVE / 'Scripts/browser_streaming.py'), 'check'], cwd=LIVE, env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=60)
                if unit_value('LoadState') == 'not-found' or not unit_value('LoadState'):
                    command = ['systemd-run', '--user', '--unit=nord-browser-demo', '--collect', '--property=KillMode=mixed', '--property=TimeoutStopSec=40', '--property=CPUWeight=400', '--setenv=PATH', '--setenv=NORD_ICE_CONFIG', '--working-directory=' + str(LIVE), '/usr/bin/python3', 'Scripts/browser_streaming.py', 'run']
                else:
                    command = ['systemctl', '--user', 'start', 'nord-browser-demo.service']
                subprocess.run(command, env=env, check=True, capture_output=True, text=True, timeout=30)
                STATE['service_actions'].append('restore nord-browser-demo.service')
            deadline = time.monotonic() + 150
            while time.monotonic() < deadline:
                lifecycle = json.loads((LIVE / 'Saved/BrowserStreaming/lifecycle.json').read_text())
                if lifecycle.get('phase') == 'running' and str(lifecycle.get('launcher_pid')) == unit_value('MainPID') and unit_value('ActiveState') == 'active':
                    STATE['restored'] = True
                    STATE['restored_main_pid'] = lifecycle['launcher_pid']
                    STATE['restored_children'] = lifecycle['children']
                    break
                time.sleep(.5)
            assert STATE['restored'], 'Demo did not reach connected state'
        STATE['preserved_units_after'] = {n: subprocess.check_output(['systemctl', '--user', 'show', n, '-p', 'MainPID', '-p', 'ActiveState'], text=True).strip() for n in BASE['preserved_units']}
        STATE['preserved_units_unchanged'] = STATE['preserved_units_after'] == BASE['preserved_units']
        STATE['turn_id_after'] = subprocess.check_output(['docker', 'inspect', 'nord-browser-turn', '--format', '{{.Id}}'], text=True).strip()
        STATE['turn_running_after'] = subprocess.check_output(['docker', 'inspect', 'nord-browser-turn', '--format', '{{.State.Running}}'], text=True).strip() == 'true'
        assert STATE['turn_id_after'] == BASE['preserved_turn_id'] and STATE['turn_running_after'] and STATE['source_savegames_unchanged']
        assert not STATE['all_content_changed'] and not STATE['frozen_source_changed'] and not STATE['derivative_changed'] and STATE['stream_helper_unchanged'] and STATE['global_settings_restored'] and STATE['source_settings_restored'] and not STATE['protected_changed'] and not STATE['generated_assets_changed'] and not STATE['live_package_changed'] and not STATE['live_saves_changed_before_restart'] and STATE['preserved_units_unchanged'], 'Preservation check failed'
    except BaseException:
        STATE['restoration_error'] = traceback.format_exc()
        STATE['passed'] = False
    STATE['phase'] = 'complete' if STATE['passed'] else 'failed'
    save()
    print(json.dumps({'passed': STATE['passed'], 'restored': STATE['restored'], 'jobs': len(STATE['jobs']), 'status': str(OUT / 'window-status.json')}), flush=True)
sys.exit(0 if STATE['passed'] else 1)

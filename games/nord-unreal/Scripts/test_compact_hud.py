"""Run the existing rendered story suite with an extra calm-HUD capture.

Use LaFontaine, -NordCampaignQA -NordStoryRenderChecks -NordCaptureWidth=1280|1920.
The native fixture retains its save/settings cleanup; no gameplay state is bypassed.
"""
from pathlib import Path
import hashlib
import shutil

import unreal as u

root = Path(u.Paths.project_dir()).resolve()
assert '-NordStoryRenderChecks' in u.SystemLibrary.get_command_line(), 'Compact HUD verification requires native rendering'
fixture = root / 'Scripts/test_story_slice.py'
qa = {'__name__': '__compact_hud_qa__', '__file__': str(fixture)}
exec(compile(fixture.read_text(), str(fixture), 'exec'), qa)
u.unregister_slate_post_tick_callback(qa['STATE']['callback'])
assert qa['STEPS'][0][0] == 'fresh two-player campaign in isolated save slot'
qa['OUT'] = root / 'Preview' / f"CompactHUD{qa['WIDTH']}"
qa['OUT'].mkdir(exist_ok=True)
qa['STEPS'].insert(1, ('initial briefing and movement hints expire without changing progress',
    lambda: None, lambda: qa['state_equal'](0, 0, 0), 'HUDQuiet', 20, 11.))


def private_message_cleared():
    pc = qa['STATE']['client_pc']
    assert pc.get_editor_property('ResidentCaptionUntil') <= u.GameplayStatics.get_time_seconds(qa['STATE']['client'])
    return qa['state_equal'](3, 0)


clamp = next(i for i, entry in enumerate(qa['STEPS'])
             if entry[0] == 'green-beat native plunger action advances first latch')
qa['STEPS'].insert(clamp + 1, ('phase briefing remains readable after private action message clears',
    lambda: None, private_message_cleared, 'HUDDelayedBriefing', 20, 10.))
finish = next(i for i, entry in enumerate(qa['STEPS'])
              if entry[0] == 'native drive crosses required gate6')
qa['STEPS'].insert(finish + 1, ('shared completion remains visible after its fade-in',
    lambda: None, lambda: qa['state_equal'](7, 2, 7), 'HUDCompletion', 20, .6))
qa['REPORT']['mode'] += '; compact HUD and native briefing timeout'
for source in (root / 'Source/Quebec/QuebecGameplay.h', Path(__file__)):
    qa['REPORT']['source_sha256'][str(source.relative_to(root))] = hashlib.sha256(source.read_bytes()).hexdigest()
original_write_report = qa['write_report']


def write_report():
    original_write_report()
    reports = Path(u.Paths.project_saved_dir()) / 'Tests'
    shutil.copy2(reports / f"StorySliceRender{qa['WIDTH']}.json",
                 reports / f"CompactHUD{qa['WIDTH']}.json")


qa['write_report'] = write_report
qa['STATE']['callback'] = u.register_slate_post_tick_callback(qa['tick'])

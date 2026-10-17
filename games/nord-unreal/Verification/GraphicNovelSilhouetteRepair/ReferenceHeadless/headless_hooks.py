"""Inert hooks for one root-owned NullRHI compound diagnostic; no Unreal import."""
import traceback

STATES = ('Idle', 'Face', 'FaceThreeQuarter', 'Walk', 'Run', 'Airborne', 'Landing')
SNAPSHOT_KEYS = ('original_relative_values', 'original_world_values', 'initial_hand_world',
                 'initial_axis_world', 'initial_target_world_quat', 'scale', 'raw_grip_z_cm',
                 'raw_obj_bounds_cm', 'scope', 'initial_readback', 'calibration_method',
                 'reference_skeleton', 'reference_pose_bone_names', 'reference_hand_component',
                 'reference_mesh_world', 'reference_hand_world_quaternion_xyzw')


def install(ns, prop, diagnostic):
    assert ns['HEADLESS'] and not ns['MOTION'] and ns['STYLES'] == (9,)
    assert all(ns[key] for key in ('GRAPHIC_NOVEL_CANDIDATE', 'GRAPHIC_NOVEL_GENERATED', 'GRAPHIC_NOVEL_HIGH_DETAIL'))
    state, report = ns['STATE'], ns['REPORT']
    assert state['phase'] == 'boot' and not state['finished'] and state.get('callback') is not None
    assert diagnostic['passed'] and diagnostic['changed_content'] == [
        'Content/ParkComic/CrewGraphicNovelHighDetail/Resident9/A_Jump.uasset']
    assert 'headless_compound' not in report and 'compound_prop_snapshot' not in state
    original_start, original_sample, original_finish = (ns[key] for key in ('start_style', 'sample', 'finish'))
    report['headless_compound'] = {
        'native_trial_readback': diagnostic,
        'scope': 'NullRHI native state/bone and PIE prop transform diagnostic only; no rendered evidence or art acceptance',
        'expected_states': list(STATES), 'graphics_accepted': False, 'adopted': False,
        'hook_installation': 'after complete original fixture exec, before return to first Slate callback',
        'prop_restored': False,
    }
    report['candidate_asset_status']['native_jump_matches_retained_raw_source_claimed'] = False

    def start_style(style):
        assert style == 9 and not state.get('compound_prop_applied'), 'One style/one prop application only'
        original_start(style)
        snapshot = prop.apply(ns['u'], state['world'], state['pawn'], state['mesh'])
        # Retain native objects immediately, before any report serialization can fail.
        state['compound_prop_snapshot'] = snapshot
        state['compound_prop_applied'] = True
        report['compound_prop'] = {key: snapshot[key] for key in SNAPSHOT_KEYS}
        report['compound_prop']['original_flags'] = list(snapshot['original_flags'])
        report['compound_prop']['restored'] = False
        report['headless_compound']['initial_relative_quaternion_xyzw'] = snapshot['initial_readback']['prop_relative']['rotation_xyzw']
        report['headless_compound']['initial_relative_offset_cm'] = snapshot['initial_readback']['prop_relative']['translation_cm']
        report['headless_compound']['bake_status'] = 'derived from native skeleton reference, independent of live idle timing; root review required before persistent use'

    def sample():
        result = original_sample()
        assert 'compound_prop_snapshot' in state, 'Pose sample preceded compound prop setup'
        result['compound_prop'] = prop.readback(ns['u'], state['compound_prop_snapshot'])
        return result

    def finish(error=None):
        if state['finished']:
            return original_finish(error)
        try:
            if not error:
                assert state.get('compound_prop_applied') and 'compound_prop_snapshot' in state
                assert len(report['characters']) == 1 and report['screenshots'] == []
                observations = report['skipped_screenshots']
                assert len(observations) == 7 and {row['state'] for row in observations} == set(STATES)
                assert all(row['style'] == 9 for row in observations)
                states = report['characters'][0]['states']
                assert set(states) == set(STATES)
                for label in STATES:
                    assert states[label]['compound_prop']['wrist_error_cm'] < .01, label
                report['headless_compound']['completion_readback'] = prop.readback(ns['u'], state['compound_prop_snapshot'])
                report['headless_compound']['seven_state_prop_readbacks_passed'] = True
        except BaseException:
            error = (str(error) + '\n' if error else '') + traceback.format_exc()
        finally:
            if 'compound_prop_snapshot' in state:
                try:
                    prop.restore(state['compound_prop_snapshot'])
                    state.pop('compound_prop_snapshot')
                    report.setdefault('compound_prop', {})['restored'] = True
                    report['headless_compound']['prop_restored'] = True
                except BaseException:
                    failure = traceback.format_exc()
                    report.setdefault('compound_prop', {})['restoration_error'] = failure
                    error = (str(error) + '\n' if error else '') + failure
        # Prop cleanup always precedes original report write/PIE end/settings reset.
        return original_finish(error)

    ns.update(start_style=start_style, sample=sample, finish=finish)


def abort_setup(ns, error):
    """Fixture may already have armed its callback when post-exec setup fails."""
    try:
        if callable(ns.get('finish')) and ns.get('STATE', {}).get('callback') is not None:
            ns['finish'](error)
            return
    except BaseException:
        pass
    # Partial exec/failed normal teardown: bounded fallback to the existing owned APIs.
    u, state = ns.get('u'), ns.get('STATE', {})
    if u is None:
        return
    failures = []
    snapshot = state.get('compound_prop_snapshot')
    if snapshot is not None and ns.get('_prop') is not None:
        try:
            ns['_prop'].restore(snapshot)
            state.pop('compound_prop_snapshot')
        except BaseException:
            failures.append(traceback.format_exc())
    for action in (
        lambda: ns['LEVELS'].editor_request_end_play() if state.get('owns_pie') else None,
        lambda: [ns['SETTINGS'].set_editor_property(key, value) for key, value in ns.get('ORIGINAL', {}).items()],
        lambda: ns['SYSTEM'].call_method('SetBytePropertyByName', (ns['SETTINGS'], 'PlayNetMode', ns['ORIGINAL_MODE'])) if 'ORIGINAL_MODE' in ns else None,
        lambda: u.unregister_slate_post_tick_callback(state['callback']) if state.get('callback') is not None else None,
        lambda: ns['SCRIPT'].call_method('SetKeepPythonScriptAlive', (False,)) if 'SCRIPT' in ns else None,
    ):
        try:
            action()
        except BaseException:
            failures.append(traceback.format_exc())
    if failures:
        u.log_error('NORD_HEADLESS_COMPOUND_SETUP_CLEANUP_FAILED ' + '\n'.join(failures))

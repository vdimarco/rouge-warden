"""Bake modest background park life and original procedural ambience into the level."""
from array import array
import json
import math
from pathlib import Path
import random
import sys
import wave


RATE = 22050


def write_ambience(directory):
    """Write deterministic mono PCM loops; these are synthesis, not field recordings."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    rng = random.Random(514)
    wind = array('f', [0.0]) * (40 * RATE)
    slow = 0.0
    for i in range(len(wind)):
        t = i / RATE
        slow = .97 * slow + .03 * rng.uniform(-1, 1)
        # The end fade prevents a click when the saved SoundWave loops.
        fade = min(1.0, t / 1.5, (40 - t) / 1.5)
        gust = .6 + .2 * math.sin(math.tau * t / 9) + .12 * math.sin(math.tau * t / 3.7)
        wind[i] = fade * (.14 * slow * gust + .004 * rng.uniform(-1, 1))
    for start, frequency in [(3.4, 2900), (4.0, 3250), (12.2, 2500),
                             (12.7, 2850), (24.4, 3100), (25.0, 2800), (33.6, 2700)]:
        duration = .22 + rng.random() * .14
        phase = 0.0
        for j in range(int(duration * RATE)):
            t = j / RATE
            phase += math.tau * (frequency + 420 * math.sin(math.pi * t / duration)) / RATE
            envelope = math.sin(math.pi * t / duration) ** 2
            trill = .75 + .25 * math.sin(math.tau * 28 * t)
            wind[int(start * RATE) + j] += .035 * envelope * trill * math.sin(phase)
    bell = array('f', [0.0]) * (47 * RATE)
    for start in (11.0, 11.28, 36.5):
        for j in range(2 * RATE):
            t = j / RATE
            envelope = min(1.0, t / .004) * math.exp(-4.5 * t)
            tone = (math.sin(math.tau * 2860 * t)
                    + .4 * math.sin(math.tau * 4217 * t)
                    + .2 * math.sin(math.tau * 6371 * t))
            bell[int(start * RATE) + j] += .11 * envelope * tone
    paths = []
    for name, samples in [('ParkWindBirds', wind), ('OccasionalCycleBell', bell)]:
        assert max(abs(v) for v in samples) < .5, 'Unexpected clipping in ' + name
        pcm = array('h', (round(v * 32767) for v in samples))
        if sys.byteorder != 'little':
            pcm.byteswap()
        path = directory / (name + '.wav')
        with wave.open(str(path), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(pcm.tobytes())
        paths.append(path)
    return paths


def import_civilians(u, assets, destination='/Game/Plateau'):
    """Import original CC0 rigs and their own animations, without retargeting."""
    root = Path(u.Paths.project_dir()).resolve()
    tools = u.AssetToolsHelpers.get_asset_tools()
    prepared = root / 'Data/Art/Plateau/Civilians/Prepared'
    manifest = json.loads((prepared / 'manifest.json').read_text())
    civilians = {}
    for record in manifest:
        name = record['name']
        folder = destination + '/Life/Civilians/' + name
        mesh_path = folder + '/SK_' + name
        mesh = assets.load_asset(mesh_path) if assets.does_asset_exist(mesh_path) else None
        if not mesh or not mesh.get_editor_property('skeleton'):
            options = u.FbxImportUI()
            options.automated_import_should_detect_type = False
            options.import_mesh = True
            options.import_as_skeletal = True
            options.mesh_type_to_import = u.FBXImportType.FBXIT_SKELETAL_MESH
            options.original_import_type = u.FBXImportType.FBXIT_SKELETAL_MESH
            options.import_materials = False
            options.import_textures = False
            options.import_animations = False
            options.create_physics_asset = False
            options.skeletal_mesh_import_data.set_editor_property('force_front_x_axis', True)
            task = u.AssetImportTask()
            task.filename = str(prepared / record['mesh'])
            task.destination_path = folder
            task.destination_name = 'SK_' + name
            task.options = options
            task.factory = u.FbxFactory()
            task.automated = task.save = task.replace_existing = True
            tools.import_asset_tasks([task])
            mesh = assets.load_asset(mesh_path)
            assert mesh and mesh.get_editor_property('skeleton'), 'Civilian FBX did not create a rig'
            # FBX task.save saves its primary mesh, not the newly created skeleton.
            assets.save_loaded_asset(mesh.get_editor_property('skeleton'))
            assets.save_loaded_asset(mesh)
        assert isinstance(mesh, u.SkeletalMesh), 'Missing civilian skeletal mesh ' + name
        height = mesh.get_bounds().box_extent.z * 2
        assert 140 < height < 220, ('Civilian import units', name, height)
        skeleton = mesh.get_editor_property('skeleton')
        assert skeleton, 'Missing original civilian skeleton ' + name
        animations = {}
        for label, metadata in record['animations'].items():
            animation_name = 'A_' + name + '_' + label
            animation_path = folder + '/' + animation_name
            animation = assets.load_asset(animation_path) if assets.does_asset_exist(animation_path) else None
            if not animation or animation.get_editor_property('skeleton') != skeleton:
                options = u.FbxImportUI()
                options.automated_import_should_detect_type = False
                options.import_as_skeletal = True
                options.import_mesh = False
                options.import_animations = True
                options.import_materials = options.import_textures = False
                options.mesh_type_to_import = u.FBXImportType.FBXIT_ANIMATION
                options.original_import_type = u.FBXImportType.FBXIT_ANIMATION
                options.skeleton = skeleton
                options.anim_sequence_import_data.set_editor_property('force_front_x_axis', True)
                task = u.AssetImportTask()
                task.filename = str(prepared / metadata['file'])
                task.destination_path = folder
                task.destination_name = animation_name
                task.options = options
                task.factory = u.FbxFactory()
                task.automated = task.save = task.replace_existing = True
                tools.import_asset_tasks([task])
                animation = assets.load_asset(animation_path)
            assert isinstance(animation, u.AnimSequence) and animation.get_play_length() > .5, (name, label)
            assert animation.get_editor_property('skeleton') == skeleton, 'Civilian rig mismatch'
            animations[label] = animation

        colors = {m['slot'].replace('.', '_'): m['color'] for m in record['materials']}
        slots = list(mesh.get_editor_property('materials'))
        for slot in slots:
            slot_name = str(slot.get_editor_property('material_slot_name'))
            assert slot_name in colors, ('Unknown civilian material slot', name, slot_name)
            path = folder + '/M_' + slot_name
            material = assets.load_asset(path) if assets.does_asset_exist(path) else None
            if not material:
                material = tools.create_asset('M_' + slot_name, folder, u.Material, u.MaterialFactoryNew())
                m = u.MaterialEditingLibrary
                tint = m.create_material_expression(material, u.MaterialExpressionConstant3Vector)
                tint.set_editor_property('constant', u.LinearColor(*colors[slot_name], 1))
                assert m.connect_material_property(tint, '', u.MaterialProperty.MP_BASE_COLOR)
                for value, prop in [(0., u.MaterialProperty.MP_METALLIC),
                                    (.65 if 'Skin' in slot_name else .88, u.MaterialProperty.MP_ROUGHNESS),
                                    (.22, u.MaterialProperty.MP_SPECULAR)]:
                    node = m.create_material_expression(material, u.MaterialExpressionConstant)
                    node.set_editor_property('r', value)
                    assert m.connect_material_property(node, '', prop)
                m.set_base_material_usage(material, u.MaterialUsage.MATUSAGE_SKELETAL_MESH, True)
                m.recompile_material(material)
                assets.save_loaded_asset(material)
            slot.set_editor_property('material_interface', material)
        mesh.set_editor_property('materials', slots)
        assets.save_loaded_asset(mesh)
        civilians[name] = (mesh, animations, height)
    assets.save_directory(destination + '/Life/Civilians')
    return civilians


def populate(u, editor, assets, layout, route, destination='/Game/Plateau'):
    """Called by the Plateau map importer; coordinates are existing map centimetres."""
    assert len(route) >= 2 and all(len(p) >= 2 for p in route), 'Expected XY walking route'
    root = Path(u.Paths.project_dir()).resolve()
    tools = u.AssetToolsHelpers.get_asset_tools()
    civilians = import_civilians(u, assets, destination)
    pedestrian_class = u.load_class(None, '/Script/Quebec.QuebecPedestrian')
    assert pedestrian_class, 'Build the native QuebecPedestrian actor before importing'
    for old in editor.get_all_level_actors():
        if old.get_actor_label().startswith('Plateau life '):
            editor.destroy_actor(old)

    # Park pairs follow interior OSM dirt footway 107910630. Each idle stands
    # beyond its companion's patrol endpoint, leaving both short paths clear.
    people = [('WomenFormal', [(35856, 722), (35700, 67)], 2., 170),
              ('MenSuit', [(36345, 2783), (36178, 2080)], 5., 181),
              ('MenHoodie', [(39930, -5628), (40950, -6300)], .5, 178),
              ('WomenCasual', [(41600, -6730), (41050, -6370)], 1.5, 166),
              ('MenCasual', [(41850, -10590), (41585, -11750)], 3., 176),
              ('WomenPunk', [(41470, -12200), (40980, -14350)], 4., 172),
              ('MenCasual', [(35911, 956)], 0., 174),
              ('WomenPunk', [(34500, -13600)], 0., 168),
              ('MenHoodie', [(34700, -13500)], 0., 183),
              ('WomenCasual', [(36411, 3064)], 0., 170),
              ('MenSuit', [(40030, -5700)], 0., 179),
              ('WomenFormal', [(41500, -11720)], 0., 166)]
    world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
    gameplay = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
    for i, (name, points, delay, desired_height) in enumerate(people):
        mesh, animations, height = civilians[name]
        path = []
        for x, y in points:
            hit = u.SystemLibrary.line_trace_single(world, u.Vector(x, y, 100), u.Vector(x, y, -50),
                u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, [], u.DrawDebugTrace.NONE, True)
            assert hit is not None, ('Missing resident ground', i, x, y)
            broken = gameplay.call_method('BreakHitResult', (hit,))
            assert broken[0] and -.5 <= broken[5].z <= 18.5, ('Resident surface', i, x, y, broken[5])
            # The mapped dirt path is a visual surface at z=5; its collision
            # remains the district floor at z=0. Keep the park pairs above it.
            surface_z = max(broken[5].z, 5.) if i in (0, 1, 6, 9) else broken[5].z
            path.append(u.Vector(x, y, surface_z + 1))
        if len(path) > 1:
            hit = u.SystemLibrary.capsule_trace_single(world, path[0] + u.Vector(0, 0, 90),
                path[1] + u.Vector(0, 0, 90), 27., 78., u.TraceTypeQuery.TRACE_TYPE_QUERY1,
                True, [], u.DrawDebugTrace.NONE, True)
            blocked = gameplay.call_method('BreakHitResult', (hit,)) if hit is not None else None
            assert not blocked or not blocked[0], ('Resident route blocked', i, points,
                blocked[9].get_actor_label() if blocked and blocked[9] else None,
                str(blocked[5]) if blocked else None)
        actor = editor.spawn_actor_from_class(pedestrian_class, path[0], u.Rotator(yaw=130 + i * 47))
        actor.set_actor_label('Plateau life resident ' + str(i + 1) + ' ' + name)
        actor.set_folder_path('Plateau/Residents')
        scale = desired_height / height
        actor.set_actor_scale3d(u.Vector(scale, scale, scale))
        component = actor.get_editor_property('resident_mesh')
        component.set_skeletal_mesh_asset(mesh)
        component.set_collision_profile_name('NoCollision')
        actor.set_editor_property('idle_animation', animations['Idle'])
        actor.set_editor_property('walk_animation', animations['Walk'])
        actor.set_editor_property('patrol_points', path)
        actor.set_editor_property('walk_speed', 84. + i % 3 * 7.)
        actor.set_editor_property('pause_duration', 2.5 + i % 3)
        actor.set_editor_property('start_delay', delay)
        component.override_animation_data(animations['Idle'], True, True, (i * .37) % animations['Idle'].get_play_length(), 1.)
        component.set_update_animation_in_editor(True)
        saved = component.get_editor_property('animation_data')
        assert saved.get_editor_property('anim_to_play') == animations['Idle']
        assert saved.get_editor_property('saved_looping') and saved.get_editor_property('saved_playing')

    paths = write_ambience(root / 'Data/Art/Plateau/Audio')
    sound_settings = [((35800, -9200, 280), .55, 3200, 13500),
                      ((36500, -4700, 110), .38, 400, 3600)]
    for path, (point, volume, radius, falloff) in zip(paths, sound_settings):
        task = u.AssetImportTask()
        task.filename = str(path)
        task.destination_path = destination + '/Audio'
        task.automated = True
        task.replace_existing = True
        task.save = True
        tools.import_asset_tasks([task])
        assert task.imported_object_paths, 'Could not import ' + path.name
        sound = assets.load_asset(task.imported_object_paths[0])
        assert isinstance(sound, u.SoundWave), 'Expected PCM SoundWave'
        sound.set_editor_property('looping', True)
        assets.save_loaded_asset(sound)
        actor = editor.spawn_actor_from_class(u.AmbientSound, u.Vector(*point))
        actor.set_actor_label('Plateau life ambience ' + path.stem)
        audio = actor.get_component_by_class(u.AudioComponent)
        audio.set_editor_property('sound', sound)
        audio.set_editor_property('auto_activate', True)
        audio.set_editor_property('volume_multiplier', volume)
        attenuation = u.SoundAttenuationSettings()
        attenuation.set_editor_property('attenuate', True)
        attenuation.set_editor_property('spatialize', True)
        attenuation.set_editor_property('attenuation_shape_extents', u.Vector(radius, 0, 0))
        attenuation.set_editor_property('falloff_distance', falloff)
        audio.set_editor_property('override_attenuation', True)
        audio.set_editor_property('attenuation_overrides', attenuation)
        assert audio.get_editor_property('sound') == sound and sound.get_editor_property('looping')
    assets.save_directory(destination + '/Life')
    return {'clothed_residents': len(people), 'walking_residents': 6, 'civilian_meshes': len(civilians), 'ambient_sounds': len(paths),
            'audio_sources': [str(path.relative_to(root)) for path in paths],
            'audio_provenance': 'Original deterministic procedural synthesis; no recorded speech or external audio',
            'character_provenance': 'Quaternius CC0 original clothed characters, neutral idle and walk; see Data/Art/Plateau/Civilians/README.md',
            'limitations': 'Stylized low-poly residents on short authored routes; no citywide crowd AI or conversation'}


def self_check():
    import tempfile
    with tempfile.TemporaryDirectory() as directory:
        paths = write_ambience(directory)
        for path, duration in zip(paths, (40, 47)):
            with wave.open(str(path), 'rb') as sound:
                assert (sound.getnchannels(), sound.getsampwidth(), sound.getframerate()) == (1, 2, RATE)
                assert sound.getnframes() == duration * RATE
                pcm = array('h', sound.readframes(sound.getnframes()))
            if sys.byteorder != 'little':
                pcm.byteswap()
            assert 100 < max(abs(v) for v in pcm) < 16000
            assert abs(sum(pcm) / len(pcm)) < 10
            assert abs(pcm[0]) < 2 and abs(pcm[-1]) < 2
    print('PLATEAU_AUDIO_OK mono 22050 Hz, 40/47 s loops, no clipping or loop-edge clicks')


if __name__ == '__main__':
    if '--self-check' in sys.argv:
        self_check()
    else:
        for output in write_ambience(Path(__file__).resolve().parents[1] / 'Data/Art/Plateau/Audio'):
            print(output)

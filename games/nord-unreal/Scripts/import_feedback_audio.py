"""Import only the three feedback SoundWaves in a fresh NullRHI Python commandlet."""
from pathlib import Path
import wave


NAMES = ('Checkpoint', 'Complete', 'Dialogue')
DESTINATION = '/Game/Audio/Feedback'


def apply(u):
    flags = {part.lower() for part in u.SystemLibrary.get_command_line().split()}
    assert {'-nullrhi', '-run=pythonscript'} <= flags, 'Use a fresh -NullRHI -run=PythonScript commandlet'
    root = Path(u.Paths.project_dir()).resolve()
    sources = [root / 'Data/Art/Feedback' / (name + '.wav') for name in NAMES]
    # Validate every input before the first asset mutation.
    for path in sources:
        with wave.open(str(path), 'rb') as sound:
            assert (sound.getnchannels(), sound.getsampwidth(), sound.getframerate()) == (1, 2, 24000), path
            assert sound.getcomptype() == 'NONE' and 0 < sound.getnframes() <= 24000, path
    assets = u.EditorAssetLibrary
    for name in NAMES:
        path = DESTINATION + '/' + name
        if assets.does_asset_exist(path):
            assert isinstance(assets.load_asset(path), u.SoundWave), 'Refusing to replace a non-SoundWave: ' + path
    imported = []
    for name, source in zip(NAMES, sources):
        path = DESTINATION + '/' + name
        task = u.AssetImportTask()
        task.filename = str(source)
        task.destination_path = DESTINATION
        task.destination_name = name
        task.automated = True
        task.replace_existing = True
        task.save = False
        u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
        assert list(task.imported_object_paths) == [path + '.' + name], task.imported_object_paths
        sound = assets.load_asset(path)
        assert isinstance(sound, u.SoundWave), path
        sound.set_editor_property('looping', False)
        assert assets.save_loaded_asset(sound), 'Could not save ' + path
        imported.append(sound.get_path_name())
    print('NORD_FEEDBACK_AUDIO_IMPORTED', imported)
    return imported


if __name__ == '__main__':
    import unreal
    apply(unreal)

"""Import only the two owned music SoundWaves in a fresh NullRHI commandlet."""
import hashlib
import json
from pathlib import Path
import wave

NAMES = ('NeighborhoodLoop', 'RaceLoop')
DESTINATION = '/Game/Audio/Music'


def sources(root):
    directory = Path(root) / 'Data/Art/Music'
    provenance = json.loads((directory / 'provenance.json').read_text())
    assert set(provenance['tracks']) == set(NAMES), 'Unexpected music source scope'
    paths = [directory / (name + '.wav') for name in NAMES]
    for name, path in zip(NAMES, paths):
        entry = provenance['tracks'][name]
        assert path.stat().st_size <= 30 * 48000 * 4 + 4096, 'Oversized music source: ' + name
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256'], 'Music source hash differs: ' + name
        with wave.open(str(path), 'rb') as sound:
            assert (sound.getnchannels(), sound.getsampwidth(), sound.getframerate(), sound.getcomptype()) == (2, 2, 48000, 'NONE'), path
            assert sound.getnframes() == entry['frames'] and 48000 < sound.getnframes() <= 30 * 48000, path
            assert len(sound.readframes(sound.getnframes())) == sound.getnframes() * 4, 'Truncated music PCM: ' + name
    return paths


def apply(u):
    flags = {part.lower() for part in u.SystemLibrary.get_command_line().split()}
    assert {'-nullrhi', '-run=pythonscript'} <= flags, 'Use a fresh -NullRHI -run=PythonScript commandlet'
    paths = sources(Path(u.Paths.project_dir()).resolve())
    assets = u.EditorAssetLibrary
    for name in NAMES:
        path = DESTINATION + '/' + name
        if assets.does_asset_exist(path):
            assert isinstance(assets.load_asset(path), u.SoundWave), 'Refusing to replace a non-SoundWave: ' + path
    imported = []
    for name, source in zip(NAMES, paths):
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
        sound.set_editor_property('looping', True)
        assert assets.save_loaded_asset(sound), 'Could not save ' + path
        imported.append(sound.get_path_name())
    print('NORD_MUSIC_AUDIO_IMPORTED', imported)
    return imported


if __name__ == '__main__':
    import unreal
    apply(unreal)

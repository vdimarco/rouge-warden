"""CPU checks for owned PCM loops, provenance and mutation-free import rejection."""
from array import array
from contextlib import redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace
import wave

from import_music import DESTINATION, NAMES, apply, sources

ROOT = Path(__file__).resolve().parents[1]


def check_loops():
    provenance = json.loads((ROOT / 'Data/Art/Music/provenance.json').read_text())
    for path in sources(ROOT):
        entry = provenance['tracks'][path.stem]
        assert entry['device'] == 'cpu' and entry['seed'] in (197401, 197402)
        assert entry['generation_parameters']['instrumental'] and not entry['generation_parameters']['thinking']
        with wave.open(str(path), 'rb') as sound:
            pcm = array('h', sound.readframes(sound.getnframes()))
        if sys.byteorder != 'little': pcm.byteswap()
        assert 1000 < max(abs(value) for value in pcm) < 32767, path
        assert sum(value*value for value in pcm) / len(pcm) > 10000, 'Silent music loop'
        step = max(abs(pcm[channel] - pcm[-2+channel]) for channel in range(2)) / 32768
        assert step <= entry['original_neighbor_step_max_abs'] + 2/32768 and step < .01, 'Loop wrap discontinuity'


def check_import():
    imports, saved, sounds = [], [], {}
    class SoundWave:
        def __init__(self, path): self.path, self.looping = path, False
        def set_editor_property(self, name, value):
            assert name == 'looping'
            self.looping = value
        def get_path_name(self): return self.path + '.' + self.path.rsplit('/', 1)[1]
    def import_tasks(tasks):
        for task in tasks:
            assert task.destination_path == DESTINATION and task.destination_name in NAMES
            assert task.automated and task.replace_existing and not task.save
            path = task.destination_path + '/' + task.destination_name
            sounds[path] = SoundWave(path)
            task.imported_object_paths = [sounds[path].get_path_name()]
            imports.append(path)
    def save(sound):
        assert sound.looping
        saved.append(sound.path)
        return True
    command, project = '-NullRHI -run=PythonScript -unattended', ROOT
    u = SimpleNamespace(
        SystemLibrary=SimpleNamespace(get_command_line=lambda: command),
        Paths=SimpleNamespace(project_dir=lambda: str(project)),
        SoundWave=SoundWave, AssetImportTask=SimpleNamespace,
        AssetToolsHelpers=SimpleNamespace(get_asset_tools=lambda: SimpleNamespace(import_asset_tasks=import_tasks)),
        EditorAssetLibrary=SimpleNamespace(does_asset_exist=lambda path: path in sounds, load_asset=sounds.get, save_loaded_asset=save),
    )
    def rejected(expected=''):
        try: apply(u)
        except AssertionError as error: assert expected in str(error), error
        else: raise AssertionError('Unsafe music import accepted')
        assert not imports and not saved
    for command in ('-run=PythonScript', '-NullRHI', '-NullRHI -ExecutePythonScript=import_music.py'):
        rejected()
    command = '-NullRHI -run=PythonScript -unattended'
    with tempfile.TemporaryDirectory() as directory:
        project = Path(directory)
        shutil.copytree(ROOT / 'Data/Art/Music', project / 'Data/Art/Music')
        with (project / 'Data/Art/Music/RaceLoop.wav').open('ab') as sound: sound.write(b'corrupt')
        rejected()
        truncated = project / 'Data/Art/Music/RaceLoop.wav'
        truncated.write_bytes((ROOT / 'Data/Art/Music/RaceLoop.wav').read_bytes()[:-4])
        manifest = project / 'Data/Art/Music/provenance.json'
        provenance = json.loads(manifest.read_text())
        provenance['tracks']['RaceLoop']['sha256'] = hashlib.sha256(truncated.read_bytes()).hexdigest()
        manifest.write_text(json.dumps(provenance))
        rejected('Truncated music PCM')
    project = ROOT
    sounds[DESTINATION + '/RaceLoop'] = object()
    rejected()
    sounds.clear()
    with redirect_stdout(io.StringIO()):
        assert apply(u) == [DESTINATION + '/' + name + '.' + name for name in NAMES]
    assert imports == saved == [DESTINATION + '/' + name for name in NAMES]


if __name__ == '__main__':
    check_loops()
    check_import()
    print('NORD_MUSIC_OK owned PCM, provenance, wrap continuity and bounded offline import')

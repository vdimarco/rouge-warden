"""CPU checks for original PCM cues and the bounded offline import contract."""
from array import array
from contextlib import redirect_stdout
import io
import sys
import tempfile
from types import SimpleNamespace
import wave

from create_feedback_audio import CUES, RATE, ROOT, write_cues
from import_feedback_audio import DESTINATION, NAMES, apply


def check_audio():
    with tempfile.TemporaryDirectory() as directory:
        paths = write_cues(directory)
        original = [path.read_bytes() for path in paths]
        assert original == [path.read_bytes() for path in write_cues(directory)], 'Synthesis must be deterministic'
        for path, expected in zip(paths, original):
            assert (ROOT / 'Data/Art/Feedback' / path.name).read_bytes() == expected, 'Checked-in cue is stale: ' + path.name
            with wave.open(str(path), 'rb') as sound:
                assert (sound.getnchannels(), sound.getsampwidth(), sound.getframerate(), sound.getcomptype()) == (1, 2, RATE, 'NONE')
                assert sound.getnframes() == round(CUES[path.stem][0] * RATE)
                pcm = array('h', sound.readframes(sound.getnframes()))
            if sys.byteorder != 'little':
                pcm.byteswap()
            assert 1000 < max(abs(value) for value in pcm) < 8192, path.name
            assert abs(sum(pcm) / len(pcm)) < 2, 'DC offset: ' + path.name
            assert pcm[0] == pcm[-1] == 0, 'Endpoint click: ' + path.name
            assert max(abs(b - a) for a, b in zip(pcm, pcm[1:])) < 32767 * .05, 'Abrupt sample step: ' + path.name


def check_import():
    imports, saved = [], []
    class SoundWave:
        def __init__(self, path): self.path, self.looping = path, True
        def set_editor_property(self, name, value):
            assert name == 'looping'
            self.looping = value
        def get_path_name(self): return self.path + '.' + self.path.rsplit('/', 1)[1]
    sounds = {}
    def import_tasks(tasks):
        for task in tasks:
            assert task.destination_path == DESTINATION and task.destination_name in NAMES
            assert task.automated and task.replace_existing and not task.save
            path = task.destination_path + '/' + task.destination_name
            sounds[path] = SoundWave(path)
            task.imported_object_paths = [sounds[path].get_path_name()]
            imports.append(path)
    def save(sound):
        assert sound.looping is False
        saved.append(sound.path)
        return True
    command = '-NullRHI -run=PythonScript -unattended'
    u = SimpleNamespace(
        SystemLibrary=SimpleNamespace(get_command_line=lambda: command),
        Paths=SimpleNamespace(project_dir=lambda: str(ROOT)),
        SoundWave=SoundWave, AssetImportTask=SimpleNamespace,
        AssetToolsHelpers=SimpleNamespace(get_asset_tools=lambda: SimpleNamespace(import_asset_tasks=import_tasks)),
        EditorAssetLibrary=SimpleNamespace(does_asset_exist=lambda path: path in sounds, load_asset=sounds.get, save_loaded_asset=save),
    )
    for command in ('-run=PythonScript', '-NullRHI -ExecutePythonScript=import_feedback_audio.py', '-NullRHI'):
        try:
            apply(u)
        except AssertionError:
            pass
        else:
            raise AssertionError('Rendered/live editor import was accepted')
        assert not imports and not saved
    command = '-NullRHI -run=PythonScript -unattended'
    with redirect_stdout(io.StringIO()):
        assert apply(u) == [DESTINATION + '/' + name + '.' + name for name in NAMES]
    assert imports == saved == [DESTINATION + '/' + name for name in NAMES]
    imports.clear(); saved.clear()
    sounds[DESTINATION + '/Checkpoint'] = object()
    try:
        apply(u)
    except AssertionError:
        pass
    else:
        raise AssertionError('Importer replaced a non-SoundWave')
    assert not imports and not saved


if __name__ == '__main__':
    check_audio()
    check_import()
    print('NORD_FEEDBACK_AUDIO_OK deterministic quiet PCM, smooth edges, exact offline import scope')

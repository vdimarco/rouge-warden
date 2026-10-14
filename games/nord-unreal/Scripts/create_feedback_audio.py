"""Original, quiet interaction cues; standard-library synthesis with no samples."""
from array import array
import math
from pathlib import Path
import sys
import wave


RATE = 24000
ROOT = Path(__file__).resolve().parents[1]
CUES = {
    'Checkpoint': (.34, ((0., 659.25, .22, .11), (.11, 880., .23, .10))),
    'Complete': (.68, ((0., 523.25, .32, .11), (.15, 659.25, .33, .11), (.30, 783.99, .38, .12))),
    'Dialogue': (.075, ((0., 440., .075, .085),)),
}


def write_cues(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, (duration, notes) in CUES.items():
        samples = [0.] * round(duration * RATE)
        for start, frequency, length, level in notes:
            count = round(length * RATE)
            offset = round(start * RATE)
            for i in range(count):
                t = i / RATE
                attack = .5 - .5 * math.cos(math.pi * min(1., t / .006))
                release = .5 - .5 * math.cos(math.pi * min(1., (count - 1 - i) / (RATE * .035)))
                envelope = attack * release * math.exp(-3.5 * t / length)
                tone = math.sin(math.tau * frequency * t) + .18 * math.sin(math.tau * frequency * 2 * t)
                samples[offset + i] += level * envelope * tone
        assert max(abs(value) for value in samples) < .25, name + ' exceeds the quiet cue ceiling'
        pcm = array('h', (round(value * 32767) for value in samples))
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


if __name__ == '__main__':
    for path in write_cues(ROOT / 'Data/Art/Feedback'):
        print(path)

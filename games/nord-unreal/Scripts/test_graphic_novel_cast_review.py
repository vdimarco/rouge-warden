"""Review fixture input boundary checks without Blender, rendering or source writes."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import struct

import review_graphic_novel_cast as review


def rejects(function, exception):
    try:
        function()
    except exception:
        return
    raise AssertionError('Invalid review source/output accepted')


source = Path(__file__).resolve().parents[1] / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/body.glb'
before = review.digest(source)
with TemporaryDirectory(prefix='nord-cast-review-test-') as directory:
    root = Path(directory)
    valid = root / 'fresh-output'
    original, output, sha = review.input_plan(source, valid)
    assert original == source and output == valid and sha == before and not valid.exists()
    rejects(lambda: review.input_plan(root / 'missing.glb', valid), ValueError)
    rejects(lambda: review.input_plan(source, root), FileExistsError)
    rejects(lambda: review.input_plan(source, source), FileExistsError)
    invalid = root / 'invalid.glb'
    invalid.write_bytes(b'not a model')
    rejects(lambda: review.input_plan(invalid, valid), ValueError)
    metadata = json.dumps({'buffers': [{'uri': '../../original.bin'}]}).encode()
    invalid.write_bytes(struct.pack('<4sIIII', b'glTF', 2, len(metadata) + 20, len(metadata), 0x4e4f534a) + metadata)
    rejects(lambda: review.input_plan(invalid, valid), ValueError)
    assert not valid.exists()
assert review.digest(source) == before
print('PASS: actual pinned-source read, missing/malformed/external GLBs and existing outputs rejected without source/output mutation')

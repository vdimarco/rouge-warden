"""OBJ export must not hand rounding-collapsed footprint faces to Unreal."""
from pathlib import Path
import tempfile
from prepare_college_bathurst import write_obj

with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / 'test.obj'
    write_obj(path, 'test', [
        [(0, 0, 0), (.0001, 0, 0), (0, 0, 10)],
        [(0, 0, 0), (1, 0, 0), (2, 0, 0)],
        [(0, 0, 0), (10, 0, 0), (10, 0, 10), (0, 0, 10)],
        [(0, 0, 1), (5, 0, 1), (10, 0, 1), (10, 10, 1), (0, 10, 1)],
    ])
    rows = path.read_text().splitlines()
    assert [row for row in rows if row.startswith('f ')] == [
        'f 4/4 3/3 2/2 1/1', 'f 8/8 7/7 6/6 5/5']
    assert len([row for row in rows if row.startswith('v ')]) == 8
    assert len([row for row in rows if row.startswith('vt ')]) == 8
    assert 'v 10.000 -10.000 1.000' in rows
print('NORD_COLLEGE_OBJ_OK')

"""Fresh-load one own cast candidate without touching the merged pilot."""
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_tripo_cast import STYLES, source_plan
from verify_tripo_pilot import verify_assets


def main():
    import unreal as u
    root = Path(u.Paths.project_dir()).resolve()
    assert '-nullrhi' in u.SystemLibrary.get_command_line().lower().split()
    character = os.environ['NORD_TRIPO_CAST_CHARACTER']
    paths, hashes, scale = source_plan(root, character)
    folder = '/Game/ParkComic/CrewGraphicNovelTripo/Resident' + str(STYLES[character])
    verify_assets(u, root, paths, hashes, folder, scale,
                  root / 'Saved/Tests/TripoCastNative' / character / 'FreshLoad.json')
    u.SystemLibrary.quit_editor()


if __name__ == '__main__':
    main()

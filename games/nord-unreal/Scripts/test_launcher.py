"""Exercise launch arguments without starting Unreal or opening a network port."""
import json
from pathlib import Path
import subprocess
import tempfile

source = Path(__file__).with_name("launch.sh").read_text()
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / "Scripts").mkdir()
    (root / "Quebec.uproject").write_text("{}")
    fake = root / "fake_editor"
    fake.write_text("#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n")
    fake.chmod(0o755)
    script = root / "Scripts/launch.sh"
    script.write_text(source.replace("/home/von/.local/share/Epic/UE_5.8.3/Engine/Binaries/Linux/UnrealEditor", str(fake)))

    def run(*args):
        return subprocess.run(["bash", str(script), *args], capture_output=True, text=True)

    for mode in ("editor", "play", "host"):
        result = run(mode)
        assert result.returncode == 0, result.stderr
        argv = json.loads(result.stdout)
        assert str(root / "Quebec.uproject") in argv
        assert ("/Game/Maps/LaFontaine?listen" if mode == "host" else "/Game/Maps/LaFontaine") in argv
    for address in ("127.0.0.1", "192.168.1.2:7777", "localhost:65535", "game.example.com"):
        result = run("join", address)
        assert result.returncode == 0, result.stderr
        assert address in json.loads(result.stdout)
    for address in ("127.1", "256.0.0.1", "01.0.0.1", "host..test", "-host", "host:0", "host:65536", "host;echo", "https://host"):
        assert run("join", address).returncode == 2, address
    assert run("join").returncode == 2
    assert run("host", "unexpected").returncode == 2
print("NORD_LAUNCHER_OK")

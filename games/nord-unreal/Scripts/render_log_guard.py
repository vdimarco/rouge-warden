"""Reject rendered evidence with asset dependency, shader or fatal runtime errors."""
import argparse
import hashlib
import json
from pathlib import Path
import re


ERROR = re.compile(
    r'\bLoadErrors\s*:|\bMissing cached shader map\b|'
    r'\bdependent package\b[^\r\n]*(?:not available|missing|failed)|'
    r'\bSkipped package\b|\b(?:Failed to load|Unable to load|Could not load)[^\r\n]*/Game/|'
    r"\b(?:Can't find file|Couldn't find file for package)\b|"
    r'\bFailed to compile (?:Material|shader)\b|\bFatal error\b|\bAssertion failed\b|'
    r'\bVK_ERROR_OUT_OF_(?:DEVICE|HOST)_MEMORY\b', re.IGNORECASE)


def assert_render_log_clean(text):
    errors = [line.strip()[:400] for line in text.splitlines() if ERROR.search(line)]
    assert not errors, ('Rendered log contains dependency/shader/runtime errors', errors[:8])
    return {'passed': True, 'dependency_shader_and_fatal_errors': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('logs', nargs='+', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = {'passed': False, 'scope': 'Rendered log content scan; caller must require clean process exit separately. No processes launched.', 'logs': []}
    try:
        for path in args.logs:
            data = path.read_bytes()
            row = {'path': str(path.resolve()), 'sha256': hashlib.sha256(data).hexdigest()}
            report['logs'].append(row)
            row.update(assert_render_log_clean(data.decode('utf-8', errors='replace')))
        report['passed'] = True
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

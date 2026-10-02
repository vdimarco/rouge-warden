#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
revision=24d26df10e9f0d369f1caf5b6ba0e8e724ec0888
upstream=.cache/procedural-pixel-creatures
mkdir -p "$upstream"
curl --fail --location --retry 3 "https://api.github.com/repos/idlerunner00/procedural-pixel-creatures/tarball/$revision" -o .cache/creatures-source.tar.gz
tar -xzf .cache/creatures-source.tar.gz --strip-components=1 -C "$upstream"
dotnet run -c Release --project tools/creatures -- public/arcade/creatures/assets
cp "$upstream/LICENSE" public/arcade/creatures/LICENSE
cp "$upstream/THIRD_PARTY_NOTICES.md" public/arcade/creatures/THIRD_PARTY_NOTICES.md

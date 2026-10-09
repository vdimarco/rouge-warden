#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
editor="/home/von/.local/share/Epic/UE_5.8.3/Engine/Binaries/Linux/UnrealEditor"
project="$project_dir/Quebec.uproject"
map="/Game/Maps/LaFontaine"
mode="${1:-editor}"
if [[ $# -gt 0 ]]; then shift; fi

fail() { printf '%s\n' "$*" >&2; exit 2; }

case "$mode" in
    editor|play|host)
        [[ $# -eq 0 ]] || fail "Usage: $0 [editor|play|host|join HOST[:PORT]]"
        ;;
    join)
        [[ $# -eq 1 ]] || fail "Usage: $0 join HOST[:PORT]"
        address="$1"
        [[ "$address" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?$ ]] || fail "Use an IPv4 address or hostname, optionally followed by :PORT."
        host="${address%%:*}"
        [[ ${#host} -le 253 ]] || fail "Hostname is too long."
        IFS=. read -r -a labels <<< "$host"
        if [[ "$host" =~ ^[0-9.]+$ ]]; then
            [[ ${#labels[@]} -eq 4 && "$host" != *. ]] || fail "Invalid IPv4 address."
            for label in "${labels[@]}"; do
                [[ "$label" =~ ^(0|[1-9][0-9]{0,2})$ ]] && (( label <= 255 )) || fail "Invalid IPv4 address."
            done
        else
            [[ "$host" != *. ]] || fail "Invalid hostname."
            for label in "${labels[@]}"; do
                [[ "$label" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]] || fail "Invalid hostname."
            done
        fi
        if [[ "$address" == *:* ]]; then
            port="$((10#${address##*:}))"
            (( port >= 1 && port <= 65535 )) || fail "Port must be between 1 and 65535."
            address="$host:$port"
        fi
        ;;
    *) fail "Usage: $0 [editor|play|host|join HOST[:PORT]]" ;;
esac

if [[ "$mode" == editor ]]; then
    [[ -x "$editor" && -f "$project" ]] || fail "Unreal Editor or Quebec.uproject is missing. See README.md for build instructions."
    exec "$editor" "$project" "$map" -ModelContextProtocolStartServer -ModelContextProtocolPort=8001 -log
fi

if [[ -f "$project_dir/Builds/Linux/Quebec.sh" ]]; then
    runner=(bash "$project_dir/Builds/Linux/Quebec.sh")
else
    [[ -x "$editor" && -f "$project" ]] || fail "No packaged game found, and Unreal Editor or Quebec.uproject is missing."
    runner=("$editor" "$project" -game)
fi

case "$mode" in
    play) exec "${runner[@]}" "$map" -windowed -ResX=1280 -ResY=720 -log ;;
    host) exec "${runner[@]}" "$map?listen" -port=7777 -windowed -ResX=1280 -ResY=720 -log ;;
    join) exec "${runner[@]}" "$address" -windowed -ResX=1280 -ResY=720 -log ;;
esac

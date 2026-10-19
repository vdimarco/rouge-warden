#!/usr/bin/env bash
# Offline UE 5.8 syntax check for the Quebec module (see README.md).
#
# usage: check.sh [--src DIR] [-j N] [--tests | --no-tests] [--no-pch] [--editor | --both] [--obj-dir DIR] [file.cpp ...]
#   no files      -> every .cpp in the source dir (including *Tests.cpp)
#   --no-tests    -> skip *Tests.cpp when no files are given
#   --tests       -> only *Tests.cpp when no files are given
#   -j N          -> compile N files in parallel (default: number of CPUs)
#   --src DIR     -> module source dir (default: $QUEBEC_SRC or the nord-unreal Quebec module)
#   --no-pch      -> do not force-include the Engine shared PCH stub (strict include-what-you-use,
#                    like UBT -NoPCH -DisableUnity); by default it follows the Build.cs PCHUsage
#   --editor      -> compile the editor configuration (WITH_EDITOR=1, WITH_EDITORONLY_DATA=1) instead of
#                    the game configuration (WITH_EDITOR=0); --both runs both configurations
#   --obj-dir DIR -> also generate code: write DIR/<config>/<File>.o instead of -fsyntax-only (used by link.sh)
#
# Steps: 1) uht.py generates <File>.generated.h for every header in the source dir and
# reports UHT-style errors; 2) each .cpp is compiled with clang++ -fsyntax-only using
# the stub headers and UE's Linux clang warning set (-Wall -Werror -Wshadow ...).
# Exit status is non-zero if UHT reported errors or any file failed.
set -u

STUBS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${QUEBEC_SRC:-$STUBS/../../Source/Quebec}"
JOBS="$(nproc 2>/dev/null || echo 4)"
MODE=all
NO_PCH=0
OBJ_DIR=""
CONFIGS=(game)
FILES=()
while [ $# -gt 0 ]; do
    case "$1" in
        --src) SRC_DIR="$2"; shift 2 ;;
        -j) JOBS="$2"; shift 2 ;;
        -j*) JOBS="${1#-j}"; shift ;;
        --tests) MODE=tests; shift ;;
        --no-tests) MODE=notests; shift ;;
        --no-pch) NO_PCH=1; shift ;;
        --editor) CONFIGS=(editor); shift ;;
        --both) CONFIGS=(game editor); shift ;;
        --obj-dir) OBJ_DIR="$2"; shift 2 ;;
        -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
        *) FILES+=("$1"); shift ;;
    esac
done
SRC_DIR="$(cd "$SRC_DIR" && pwd)"
MODULE="$(basename "$SRC_DIR")"
CXX="${CXX:-clang++}"

if [ ${#FILES[@]} -eq 0 ]; then
    while IFS= read -r f; do
        case "$MODE" in
            tests) [[ "$f" == *Tests.cpp ]] || continue ;;
            notests) [[ "$f" == *Tests.cpp ]] && continue ;;
        esac
        FILES+=("$f")
    done < <(find "$SRC_DIR" -name '*.cpp' | sort)
fi

# ---------------------------------------------------------------- module include paths
# Engine-level modules (Core, CoreUObject, Engine, InputCore, NetCore, PhysicsCore...) live in
# include/. Optional modules live in modules/<Name>/ and are only visible when the module's
# Build.cs lists them, like UBT's per-module include paths.
declare -A PUBLIC_DEPS=(
    [PixelStreaming2]="PixelStreaming2Core"
    [AIModule]="GameplayTasks NavigationSystem"
    [UMG]="Slate SlateCore"
)
BUILD_CS="$(ls "$SRC_DIR"/*.Build.cs 2>/dev/null | head -1)"
DEPS=()
PCH_MODE=none
if [ -n "$BUILD_CS" ]; then
    while IFS= read -r m; do
        case "$m" in
            PCH=*) PCH_MODE="${m#PCH=}" ;;
            *) DEPS+=("$m") ;;
        esac
    done < <(python3 - "$BUILD_CS" <<'PY'
import re, sys
text = re.sub(r'//[^\n]*', '', open(sys.argv[1]).read())
names = []
for m in re.finditer(r'(Public|Private)DependencyModuleNames\s*\.\s*(AddRange|Add)\s*\(([^;]*)\)\s*;', text, re.S):
    names += re.findall(r'"([A-Za-z0-9_]+)"', m.group(3))
for n in dict.fromkeys(names):
    print(n)
usage = re.search(r'PCHUsage\s*=\s*(?:ModuleRules\s*\.\s*)?PCHUsageMode\s*\.\s*(\w+)', text)
usage = usage.group(1) if usage else 'UseExplicitOrSharedPCHs'  # UBT default for BuildSettingsVersion >= V2
private_pch = re.search(r'PrivatePCHHeaderFile\s*=\s*"([^"]+)"', text)
if usage == 'NoPCHs':
    print('PCH=none')
elif usage == 'UseSharedPCHs' or (usage == 'UseExplicitOrSharedPCHs' and not private_pch):
    print('PCH=shared')
elif private_pch:
    print('PCH=private:' + private_pch.group(1))
else:
    print('PCH=shared')
PY
)
fi
MOD_INCLUDES=()
declare -A SEEN=()
add_module() {
    local m="$1"
    [ -n "${SEEN[$m]:-}" ] && return
    SEEN[$m]=1
    [ -d "$STUBS/modules/$m" ] && MOD_INCLUDES+=(-I "$STUBS/modules/$m")
    for d in ${PUBLIC_DEPS[$m]:-}; do add_module "$d"; done
}
for m in "${DEPS[@]}"; do add_module "$m"; done

WARNINGS=(-Wall -Werror -Wshadow -Wdelete-non-virtual-dtor -Wenum-conversion -Wbitfield-enum-conversion
    -Wno-enum-enum-conversion -Wno-enum-float-conversion -Wno-gnu-string-literal-operator-template
    -Wno-inconsistent-missing-override -Wno-invalid-offsetof -Wno-switch -Wno-tautological-compare
    -Wno-unknown-pragmas -Wno-unused-function -Wno-unused-lambda-capture -Wno-unused-local-typedef
    -Wno-unused-private-field -Wno-unused-variable -Wno-undefined-var-template -Wno-unused-but-set-variable
    -Wno-deprecated-declarations -Wno-nan-infinity-disabled)
DEFINES=(-DWITH_DEV_AUTOMATION_TESTS=1 -DUE_BUILD_SHIPPING=0 "-D${MODULE^^}_API=")
config_defines() {
    case "$1" in
        game) echo "-DWITH_EDITOR=0" ;;
        editor) echo "-DWITH_EDITOR=1 -DWITH_EDITORONLY_DATA=1" ;;
    esac
}

# Shared PCH: UBT force-includes the Engine shared PCH (any module that depends on Engine).
PCH_FLAGS=()
if [ "$NO_PCH" -eq 0 ]; then
    case "$PCH_MODE" in
        shared) PCH_FLAGS=(-include EngineSharedPCH.h) ;;
        private:*) PCH_FLAGS=(-include "$SRC_DIR/${PCH_MODE#private:}") ;;
    esac
fi

# ---------------------------------------------------------------- 1) UHT
# Each run generates into its own temp dir (safe to run several checks at once); a copy is left
# in generated/<Module>/ for inspection.
TMP="$(mktemp -d "${TMPDIR:-/tmp}/uecheck.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
UHT_STATUS=0
GEN_DIR="$TMP/generated"
UHT_OUT="$(python3 "$STUBS/uht.py" "$SRC_DIR" "$GEN_DIR" "$MODULE" 2>&1)" || UHT_STATUS=$?
if [ -n "$OBJ_DIR" ] && [ -f "$GEN_DIR/uht_manifest.json" ]; then
    mkdir -p "$OBJ_DIR" && cp "$GEN_DIR/uht_manifest.json" "$OBJ_DIR/"
fi
if [ -d "$GEN_DIR" ]; then
    mkdir -p "$STUBS/generated"
    rm -rf "$STUBS/generated/.$MODULE.$$" && cp -r "$GEN_DIR" "$STUBS/generated/.$MODULE.$$" \
        && rm -rf "$STUBS/generated/$MODULE" && mv "$STUBS/generated/.$MODULE.$$" "$STUBS/generated/$MODULE" 2>/dev/null
fi
if [ $UHT_STATUS -ne 0 ]; then
    echo "FAIL UHT ($MODULE headers)"
    echo "$UHT_OUT" | sed 's/^/    /'
fi

# ---------------------------------------------------------------- 2) compile
export CXX
BASE_FLAGS="-std=c++20 -fsyntax-only -fno-color-diagnostics -I $GEN_DIR -I $STUBS/include ${MOD_INCLUDES[*]} -I $SRC_DIR ${DEFINES[*]} ${WARNINGS[*]} ${PCH_FLAGS[*]}"
compile_one() {
    local f="$1" out="$2" flags="$3"
    # shellcheck disable=SC2086
    if $CXX $flags "$f" >"$out.log" 2>&1; then echo PASS >"$out.status"; else echo FAIL >"$out.status"; fi
}
export -f compile_one
for cfg in "${CONFIGS[@]}"; do
    i=0
    flags="$(config_defines "$cfg") $BASE_FLAGS"
    [ -n "$OBJ_DIR" ] && mkdir -p "$OBJ_DIR/$cfg"
    for f in "${FILES[@]}"; do
        fileflags="$flags"
        if [ -n "$OBJ_DIR" ]; then
            fileflags="${flags/-fsyntax-only/-c -O0 -g0 -o $OBJ_DIR/$cfg/$(basename "$f" .cpp).o}"
        fi
        printf '%s\0%s\0%s\0' "$f" "$TMP/$cfg.$i" "$fileflags"
        i=$((i + 1))
    done
done | xargs -0 -n 3 -P "$JOBS" bash -c 'compile_one "$0" "$1" "$2"'

PASS=0
FAIL=0
FAILED=()
for cfg in "${CONFIGS[@]}"; do
    tag=""
    [ ${#CONFIGS[@]} -gt 1 ] || [ "$cfg" != game ] && tag="[$cfg] "
    i=0
    for f in "${FILES[@]}"; do
        st="$(cat "$TMP/$cfg.$i.status" 2>/dev/null || echo FAIL)"
        rel="${f#"$SRC_DIR"/}"
        if [ "$st" = PASS ]; then
            echo "PASS $tag$rel"
            PASS=$((PASS + 1))
        else
            echo "FAIL $tag$rel"
            sed 's/^/    /' "$TMP/$cfg.$i.log"
            FAIL=$((FAIL + 1))
            FAILED+=("$tag$rel")
        fi
        i=$((i + 1))
    done
done

echo
echo "Summary: $PASS passed, $FAIL failed$( [ $UHT_STATUS -ne 0 ] && echo ', UHT errors' )"
if [ $FAIL -gt 0 ]; then printf '  failed: %s\n' "${FAILED[@]}"; fi
[ $FAIL -eq 0 ] && [ $UHT_STATUS -eq 0 ]

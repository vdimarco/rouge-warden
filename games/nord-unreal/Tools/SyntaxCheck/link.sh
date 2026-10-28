#!/usr/bin/env bash
# Offline link check for the Quebec module (see README.md).
#
# usage: link.sh [--src DIR] [-j N] [--editor | --both] [--keep DIR]
#   default        -> game configuration (WITH_EDITOR=0); --editor / --both as in check.sh
#   --keep DIR     -> keep the object files in DIR instead of a temp dir
#
# Every module .cpp is compiled to an object file against the stubs (check.sh --obj-dir).
# nm then lists the symbols each object needs and the symbols the objects define. A symbol
# that belongs to the game module (its outermost scope or name contains Quebec, LaFontaine or
# CollegeBathurst, e.g. AQuebecCar::Foo, QuebecPeople::Bar) and that no object defines is a
# function or variable that is declared and used but never defined: the host link fails on it.
# Members that the real UHT defines in .gen.cpp files are not reported (StaticClass,
# StaticStruct, StaticEnum, RPC/BlueprintNativeEvent/BlueprintImplementableEvent thunks,
# exec* functions, Z_Construct*, the default FObjectInitializer constructor...).
# Engine symbols are never reported: the stubs only declare them.
# Exit status: 0 when nothing is missing, 1 when symbols are missing, 2 when files did not compile.
set -u
STUBS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGS=()
CONFIGS=(game)
KEEP=""
while [ $# -gt 0 ]; do
    case "$1" in
        --src|-j) ARGS+=("$1" "$2"); shift 2 ;;
        -j*) ARGS+=("$1"); shift ;;
        --editor) CONFIGS=(editor); shift ;;
        --both) CONFIGS=(game editor); shift ;;
        --keep) KEEP="$2"; shift 2 ;;
        -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
        *) echo "link.sh: unknown argument $1" >&2; exit 2 ;;
    esac
done
command -v nm >/dev/null && command -v c++filt >/dev/null || { echo "link.sh needs nm and c++filt (binutils)" >&2; exit 2; }

if [ -n "$KEEP" ]; then OBJ="$KEEP"; rm -rf "$OBJ"; mkdir -p "$OBJ"; else OBJ="$(mktemp -d "${TMPDIR:-/tmp}/uelink.XXXXXX")"; trap 'rm -rf "$OBJ"' EXIT; fi
CFG_ARGS=()
[ "${CONFIGS[*]}" = "editor" ] && CFG_ARGS=(--editor)
[ "${CONFIGS[*]}" = "game editor" ] && CFG_ARGS=(--both)

COMPILE_STATUS=0
COMPILE_OUT="$("$STUBS/check.sh" "${ARGS[@]}" "${CFG_ARGS[@]}" --obj-dir "$OBJ" 2>&1)" || COMPILE_STATUS=$?
if [ $COMPILE_STATUS -ne 0 ]; then
    echo "Some files did not compile (their definitions are missing from the link check):"
    echo "$COMPILE_OUT" | grep -E '^(FAIL|Summary)' | sed 's/^/  /'
    echo
fi

STATUS=0
for cfg in "${CONFIGS[@]}"; do
    python3 - "$OBJ/$cfg" "$OBJ/uht_manifest.json" "$cfg" <<'PY' || STATUS=1
import json, os, re, subprocess, sys

obj_dir, manifest_path, cfg = sys.argv[1], sys.argv[2], sys.argv[3]
objs = sorted(f for f in os.listdir(obj_dir) if f.endswith(".o")) if os.path.isdir(obj_dir) else []
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
GAME = re.compile(r"Quebec|LaFontaine|CollegeBathurst")
GENERATED_MEMBERS = {"StaticClass", "StaticStruct", "StaticEnum", "GetPrivateStaticClass", "StaticPackage",
                     "StaticConfigName", "StaticClassFlags", "StaticClassCastFlags", "__DefaultConstructor",
                     "__VTableCtorCaller", "ValidateGeneratedRepEnums", "_getUObject"}

def nm(args, path):
    out = subprocess.run(["nm"] + args + [path], capture_output=True, text=True).stdout
    return [line.split()[-1] for line in out.splitlines() if line.strip()]

defined, needed = set(), {}
for o in objs:
    p = os.path.join(obj_dir, o)
    defined.update(nm(["-g", "--defined-only"], p))
    for sym in nm(["-u"], p):
        needed.setdefault(sym, set()).add(o)
missing = sorted(s for s in needed if s not in defined)
demangled = subprocess.run(["c++filt"], input="\n".join(missing), capture_output=True, text=True).stdout.splitlines()

def top_split(text, sep):
    parts, depth, cur, i = [], 0, "", 0
    while i < len(text):
        c = text[i]
        if c in "<(":
            depth += 1
        elif c in ">)":
            depth -= 1
        if depth == 0 and text.startswith(sep, i):
            parts.append(cur); cur = ""; i += len(sep); continue
        cur += c; i += 1
    parts.append(cur)
    return parts

def strip_targs(name):
    out, depth = "", 0
    for c in name:
        if c == "<": depth += 1
        elif c == ">": depth -= 1
        elif depth == 0: out += c
    return out

def qualified_name(d):
    """'void AQuebecCar::Foo<int>(float) const' -> ['AQuebecCar', 'Foo<int>']"""
    d = d.replace("(anonymous namespace)", "{anon}")
    for prefix in ("vtable for ", "typeinfo for ", "typeinfo name for ", "VTT for ", "guard variable for "):
        if d.startswith(prefix):
            return prefix.strip(), top_split(d[len(prefix):], "::")
    depth, cut = 0, len(d)
    for i, c in enumerate(d):
        if c == "<": depth += 1
        elif c == ">": depth -= 1
        elif c == "(" and depth == 0 and not d[:i].endswith("operator"):
            cut = i; break
    head = d[:cut]
    words = top_split(head, " ")
    for idx, w in enumerate(words):
        if "::" in w:
            name = " ".join(words[idx:])
            break
    else:
        name = words[-1] if words else head
    return "", top_split(name, "::")

findings = []
for mangled, d in zip(missing, demangled):
    kind, parts = qualified_name(d)
    owner = strip_targs(parts[0])
    if not GAME.search(owner):
        continue
    member = strip_targs(parts[-1]) if len(parts) > 1 else owner
    cls = owner if len(parts) > 1 else None
    if kind:
        findings.append((d, kind, needed[mangled]))
        continue
    if member in GENERATED_MEMBERS or member.startswith(("exec", "Z_Construct", "Execute_", "StaticRegisterNatives")) \
            or member.endswith("_DelegateWrapper") or owner.startswith("Z_Construct"):
        continue
    info = manifest.get(cls or "", {})
    if member in info.get("thunks", []):
        continue
    if cls and member == cls:  # constructors UHT declares itself
        params = d[d.find("(") + 1:d.rfind(")")]
        if "FVTableHelper" in params or params in (f"{cls} const&", f"{cls}&&") \
                or ("FObjectInitializer" in params and not info.get("user_ctor", True)):
            continue
    findings.append((d, "", needed[mangled]))

print(f"[{cfg}] {len(objs)} object files, {len(defined)} defined symbols, {len(missing)} unresolved (engine stubs + game)")
if not findings:
    print(f"[{cfg}] OK: every game-module symbol that is used is defined somewhere")
    sys.exit(0)
print(f"[{cfg}] {len(findings)} game-module symbol(s) used but never defined:")
for d, kind, users in sorted(findings):
    note = "  (a virtual function of this class is declared but has no out-of-line definition)" if kind in ("vtable for", "typeinfo for", "VTT for") else ""
    print(f"  {d}{note}")
    print(f"      referenced from: {', '.join(sorted(users))}")
sys.exit(1)
PY
done
[ $COMPILE_STATUS -ne 0 ] && exit 2
exit $STATUS

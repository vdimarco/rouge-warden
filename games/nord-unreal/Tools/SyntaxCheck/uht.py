#!/usr/bin/env python3
"""Mini Unreal Header Tool for offline syntax checks.

Usage: uht.py <source_dir> <out_dir>

Scans every *.h under <source_dir> (recursively) and writes <out_dir>/<File>.generated.h
for each header that includes "<File>.generated.h". Like the real UHT it defines
CURRENT_FILE_ID and one <FileId>_<line>_GENERATED_BODY macro per GENERATED_BODY() line.

The macros declare Super/ThisClass, StaticClass()/StaticStruct(), the private copy/move
constructors, the default FObjectInitializer constructor when the class declares none,
and the _Implementation/_Validate functions of RPC and BlueprintNativeEvent UFUNCTIONs.
UENUMs get StaticEnum<> specialisations and FOREACH_ENUM_ macros.

It also writes <out_dir>/uht_manifest.json: for every reflected class, the UFUNCTIONs whose
bodies UHT generates (RPC and Blueprint event thunks); link.sh uses it.

It also reports a subset of the errors the real UHT reports (see README.md). Errors are
printed as "file:line: error: ..." and make the script exit with status 1.
"""
import os
import re
import sys

ACCESS_WORDS = {"public", "protected", "private"}
DECL_NOISE = {"virtual", "static", "inline", "FORCEINLINE", "FORCENOINLINE", "explicit", "constexpr",
              "FORCEINLINE_DEBUGGABLE", "UE_NODISCARD", "friend", "extern", "mutable"}
VISIBILITY_SPECS = {"EditAnywhere", "EditInstanceOnly", "EditDefaultsOnly", "VisibleAnywhere",
                    "VisibleInstanceOnly", "VisibleDefaultsOnly"}
BP_ACCESS_SPECS = {"BlueprintReadWrite", "BlueprintReadOnly"}
BP_UNSUPPORTED_TYPES = {"int", "unsigned", "long", "short", "char", "uint16", "uint32", "uint64", "int16", "int8",
                        "size_t", "SIZE_T", "wchar_t", "signed"}
CONTAINERS = {"TArray", "TMap", "TSet"}


class Errors:
    def __init__(self):
        self.items = []

    def add(self, path, line, msg):
        self.items.append(f"{path}:{line}: error: UHT: {msg}")


def clean_source(text):
    """Blank out comments, string/char literal contents and preprocessor lines, keeping offsets."""
    out = list(text)
    i, n = 0, len(text)
    at_line_start = True
    while i < n:
        c = text[i]
        if at_line_start:
            j = i
            while j < n and text[j] in " \t":
                j += 1
            if j < n and text[j] == "#":
                # preprocessor line (with continuations)
                k = j
                while k < n:
                    if text[k] == "\n" and text[k - 1] != "\\":
                        break
                    k += 1
                for m in range(j, k):
                    if out[m] != "\n":
                        out[m] = " "
                i = k
                continue
            at_line_start = False
        if c == "\n":
            at_line_start = True
            i += 1
            continue
        if text.startswith("//", i):
            while i < n and text[i] != "\n":
                out[i] = " "
                i += 1
            continue
        if text.startswith("/*", i):
            while i < n and not text.startswith("*/", i):
                if out[i] != "\n":
                    out[i] = " "
                i += 1
            if i < n:
                out[i] = out[i + 1] = " "
                i += 2
            continue
        if c in "\"'":
            q = c
            i += 1
            while i < n and text[i] != q:
                if text[i] == "\\":
                    out[i] = " "
                    i += 1
                if i < n and out[i] != "\n":
                    out[i] = " "
                i += 1
            i += 1
            continue
        i += 1
    return "".join(out)


TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|\d[\w.]*|::|->|<<=|>>=|<=|>=|==|!=|&&|\|\||\+\+|--|[^\s]")


def tokenize(clean):
    return [(m.group(0), m.start()) for m in TOKEN_RE.finditer(clean)]


def line_of(text, pos, cache={}):
    key = id(text)
    starts = cache.get(key)
    if starts is None or starts[0] is not text:
        idx = [0]
        for k, ch in enumerate(text):
            if ch == "\n":
                idx.append(k + 1)
        starts = (text, idx)
        cache[key] = starts
    import bisect
    return bisect.bisect_right(starts[1], pos)


def match_close(tokens, i, open_tok, close_tok):
    depth = 0
    for k in range(i, len(tokens)):
        t = tokens[k][0]
        if t == open_tok:
            depth += 1
        elif t == close_tok:
            depth -= 1
            if depth == 0:
                return k
    return len(tokens) - 1


def parse_specifiers(spec_text):
    """Split 'Server, Reliable, meta=(A=1), ReplicatedUsing=OnRep_X' into a dict."""
    specs = {}
    depth = 0
    cur = ""
    parts = []
    for ch in spec_text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur)
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if "=" in p:
            k, v = p.split("=", 1)
            specs[k.strip()] = v.strip()
        else:
            specs[p] = True
    return specs


def split_top_level(tokens, sep=","):
    groups, cur = [], []
    paren = angle = brace = 0
    for t in tokens:
        tok = t[0]
        if tok in "([":
            paren += 1
        elif tok in ")]":
            paren -= 1
        elif tok == "{":
            brace += 1
        elif tok == "}":
            brace -= 1
        elif tok == "<":
            angle += 1
        elif tok == ">":
            angle -= 1
        elif tok == ">>":
            angle -= 2
        if tok == sep and paren == 0 and angle <= 0 and brace == 0:
            groups.append(cur)
            cur = []
        else:
            cur.append(t)
    if cur:
        groups.append(cur)
    return groups


def join_tokens(toks):
    out = ""
    prev = ""
    for t in toks:
        tok = t[0] if isinstance(t, tuple) else t
        if out and (re.match(r"\w", tok) and re.match(r"\w", prev[-1:] or " ")):
            out += " "
        elif out and tok in ("&", "*") and prev not in ("<", "(", ","):
            out += ""
        out += tok
        prev = tok
        if tok == ",":
            out += " "
    return out


class FuncDecl:
    pass


class PropDecl:
    pass


class ClassInfo:
    def __init__(self):
        self.kind = None  # UCLASS / USTRUCT / UINTERFACE / IINTERFACE
        self.name = None
        self.bases = []
        self.specs = {}
        self.line = 0
        self.body_start = None
        self.body_end = None
        self.generated = []  # (line, macro_kind)
        self.functions = []
        self.properties = []
        self.declared_names = set()
        self.has_ctor = False
        self.interface_uclass = None


def parse_decl_after_macro(tokens, k, stop_at_body=True):
    """Collect declaration tokens from k until ';' or a function body, returns (decl_tokens, next_index, had_body)."""
    decl = []
    paren = 0
    angle_guard = 0
    while k < len(tokens):
        tok = tokens[k][0]
        if tok == "(":
            paren += 1
        elif tok == ")":
            paren -= 1
        if paren == 0 and tok == ";":
            return decl, k + 1, False
        if paren == 0 and tok == "{" and stop_at_body:
            # inline function body or brace initializer: if decl contains '(' it's a body (for functions)
            end = match_close(tokens, k, "{", "}")
            nxt = end + 1
            if nxt < len(tokens) and tokens[nxt][0] == ";":
                nxt += 1
            return decl, nxt, True
        decl.append(tokens[k])
        k += 1
        angle_guard += 1
    return decl, k, False


def parse_function(decl, specs, path, text, errors):
    f = FuncDecl()
    f.specs = specs
    f.line = line_of(text, decl[0][1]) if decl else 0
    # find the first top-level '(' : name precedes it
    idx = None
    angle = 0
    for i, (tok, _) in enumerate(decl):
        if tok == "<":
            angle += 1
        elif tok == ">":
            angle -= 1
        elif tok == ">>":
            angle -= 2
        elif tok == "(" and angle <= 0:
            idx = i
            break
    if idx is None or idx == 0:
        return None
    f.name = decl[idx - 1][0]
    head = [t for t in decl[:idx - 1] if t[0] not in DECL_NOISE and not t[0].endswith("_API")]
    f.is_virtual = any(t[0] == "virtual" for t in decl[:idx - 1])
    f.is_static = any(t[0] == "static" for t in decl[:idx - 1])
    f.ret = join_tokens(head).strip() or "void"
    close = match_close(decl, idx, "(", ")")
    params_toks = decl[idx + 1:close]
    tail = [t[0] for t in decl[close + 1:]]
    f.is_const = "const" in tail
    f.params = []
    for grp in split_top_level(params_toks):
        if not grp:
            continue
        # strip default value
        parts = split_top_level(grp, "=")
        ptoks = parts[0]
        ptoks = [t for t in ptoks]
        # drop UPARAM(...) markup
        cleaned = []
        j = 0
        while j < len(ptoks):
            if ptoks[j][0] == "UPARAM" and j + 1 < len(ptoks) and ptoks[j + 1][0] == "(":
                j = match_close(ptoks, j + 1, "(", ")") + 1
                continue
            cleaned.append(ptoks[j])
            j += 1
        p = join_tokens(cleaned).strip()
        if p and p != "void":
            f.params.append((p, cleaned))
    return f


def parse_property(decl, specs, access, path, text):
    p = PropDecl()
    p.specs = specs
    p.access = access
    p.line = line_of(text, decl[0][1]) if decl else 0
    # cut at '=' or '{' or '[' or bitfield ':'
    toks = []
    p.bitfield = False
    angle = 0
    for i, (tok, pos) in enumerate(decl):
        if tok == "<":
            angle += 1
        elif tok == ">":
            angle -= 1
        elif tok == ">>":
            angle -= 2
        if angle <= 0 and tok in ("=", "{", "["):
            break
        if angle <= 0 and tok == ":" and i + 1 < len(decl) and re.match(r"\d", decl[i + 1][0]):
            p.bitfield = True
            break
        toks.append((tok, pos))
    if not toks:
        return None
    p.name = toks[-1][0]
    p.type_tokens = [t[0] for t in toks[:-1] if t[0] not in DECL_NOISE]
    p.type = join_tokens(p.type_tokens)
    return p


def collect_classes(path, text, clean, tokens, errors):
    classes = []
    i = 0
    n = len(tokens)
    while i < n:
        tok = tokens[i][0]
        if tok in ("UCLASS", "USTRUCT", "UINTERFACE") and i + 1 < n and tokens[i + 1][0] == "(":
            close = match_close(tokens, i + 1, "(", ")")
            spec_text = clean[tokens[i + 1][1] + 1:tokens[close][1]]
            c = ClassInfo()
            c.kind = tok
            c.specs = parse_specifiers(spec_text)
            c.line = line_of(text, tokens[i][1])
            k = close + 1
            if k < n and tokens[k][0] in ("class", "struct"):
                c.keyword = tokens[k][0]
                k += 1
                # skip API macro / alignas / attributes
                name = None
                while k < n and tokens[k][0] not in (":", "{", ";"):
                    t = tokens[k][0]
                    if t.endswith("_API") or t in ("final", "alignas", "MS_ALIGN", "GCC_ALIGN"):
                        if t in ("alignas", "MS_ALIGN", "GCC_ALIGN") and k + 1 < n and tokens[k + 1][0] == "(":
                            k = match_close(tokens, k + 1, "(", ")")
                    elif re.match(r"[A-Za-z_]\w*$", t) and name is None:
                        name = t
                    k += 1
                c.name = name
                if k < n and tokens[k][0] == ":":
                    k += 1
                    base_toks = []
                    while k < n and tokens[k][0] != "{":
                        base_toks.append(tokens[k])
                        k += 1
                    for grp in split_top_level(base_toks):
                        words = [t[0] for t in grp if t[0] not in ("public", "protected", "private", "virtual")]
                        if words:
                            c.bases.append(join_tokens(words))
                if k < n and tokens[k][0] == "{":
                    c.body_start = k
                    c.body_end = match_close(tokens, k, "{", "}")
                    classes.append(c)
                    i = c.body_end
            else:
                errors.add(path, c.line, f"{tok} must be followed by a class/struct declaration")
        i += 1
    # interface I-classes
    for c in list(classes):
        if c.kind == "UINTERFACE" and c.name and c.name.startswith("U"):
            iname = "I" + c.name[1:]
            for k in range(n - 1):
                if tokens[k][0] == "class" and any(tokens[m][0] == iname for m in range(k + 1, min(k + 3, n))):
                    m = k + 1
                    while m < n and tokens[m][0] not in ("{", ";"):
                        m += 1
                    if m < n and tokens[m][0] == "{":
                        ic = ClassInfo()
                        ic.kind = "IINTERFACE"
                        ic.name = iname
                        ic.keyword = "class"
                        ic.interface_uclass = c.name
                        ic.line = line_of(text, tokens[k][1])
                        ic.body_start = m
                        ic.body_end = match_close(tokens, m, "{", "}")
                        classes.append(ic)
                        break
    return classes


def scan_class_body(c, path, text, clean, tokens, errors):
    access = "private" if c.keyword == "class" else "public"
    k = c.body_start + 1
    end = c.body_end
    stmt_start = True
    while k < end:
        tok = tokens[k][0]
        if tok in ACCESS_WORDS and k + 1 < end and tokens[k + 1][0] == ":":
            access = tok
            k += 2
            stmt_start = True
            continue
        if tok.startswith("GENERATED_") and k + 1 < end and tokens[k + 1][0] == "(":
            c.generated.append((line_of(text, tokens[k][1]), tok))
            k = match_close(tokens, k + 1, "(", ")") + 1
            if k < end and tokens[k][0] == ";":
                k += 1
            if tok in ("GENERATED_BODY", "GENERATED_IINTERFACE_BODY") or c.keyword == "class":
                access = "private" if tok == "GENERATED_BODY" and c.kind != "USTRUCT" else access
            if tok in ("GENERATED_UCLASS_BODY", "GENERATED_UINTERFACE_BODY", "GENERATED_IINTERFACE_BODY"):
                access = "public"
            stmt_start = True
            continue
        if tok == "UFUNCTION" and k + 1 < end and tokens[k + 1][0] == "(":
            close = match_close(tokens, k + 1, "(", ")")
            specs = parse_specifiers(clean[tokens[k + 1][1] + 1:tokens[close][1]])
            decl, nk, _ = parse_decl_after_macro(tokens, close + 1)
            f = parse_function(decl, specs, path, text, errors)
            if f:
                f.access = access
                c.functions.append(f)
                c.declared_names.add(f.name)
            k = nk
            stmt_start = True
            continue
        if tok == "UPROPERTY" and k + 1 < end and tokens[k + 1][0] == "(":
            close = match_close(tokens, k + 1, "(", ")")
            specs = parse_specifiers(clean[tokens[k + 1][1] + 1:tokens[close][1]])
            decl, nk, _ = parse_decl_after_macro(tokens, close + 1, stop_at_body=False)
            p = parse_property(decl, specs, access, path, text)
            if p:
                c.properties.append(p)
            k = nk
            stmt_start = True
            continue
        if tok == "{":
            k = match_close(tokens, k, "{", "}") + 1
            stmt_start = True
            continue
        if tok == ";":
            k += 1
            stmt_start = True
            continue
        if tok in ("UPROPERTY", "UFUNCTION", "UENUM", "UMETA"):
            k += 1
            continue
        # plain member declaration: record names and constructors
        decl, nk, had_body = parse_decl_after_macro(tokens, k)
        names = [t[0] for t in decl]
        if decl:
            # constructor: optional 'explicit' then ClassName '('
            core = [t for t in names if t not in ("explicit", "inline", "FORCEINLINE", "constexpr") and not t.endswith("_API")]
            if len(core) >= 2 and core[0] == c.name and core[1] == "(":
                c.has_ctor = True
            for j in range(len(names) - 1):
                if names[j + 1] == "(" and re.match(r"[A-Za-z_]\w*$", names[j]):
                    c.declared_names.add(names[j])
                    break
        k = nk if nk > k else k + 1
        stmt_start = True


def is_rpc(f):
    return any(s in f.specs for s in ("Server", "Client", "NetMulticast"))


def check_class(c, all_classes, path, errors):
    if not c.generated and c.kind != "IINTERFACE":
        errors.add(path, c.line, f"{c.kind} '{c.name}' is missing GENERATED_BODY()")
    if c.kind == "IINTERFACE" and not c.generated:
        errors.add(path, c.line, f"interface '{c.name}' is missing GENERATED_BODY()")
    # prefixes
    if c.kind == "USTRUCT" and c.name and not c.name.startswith("F"):
        errors.add(path, c.line, f"Struct '{c.name}' has an invalid Unreal prefix, expecting 'F{c.name}'")
    if c.kind == "UCLASS" and c.name and c.bases:
        base = c.bases[0].split("<")[0].split("::")[-1]
        if base[:1] in ("A", "U") and len(base) > 1 and base[1].isupper() and c.name[:1] != base[:1]:
            errors.add(path, c.line, f"Class '{c.name}' has an invalid Unreal prefix, expecting '{base[0]}{c.name[1:] if c.name[:1] in 'AUFI' else c.name}'")
    seen = {}
    for f in c.functions:
        if c.kind == "USTRUCT":
            errors.add(path, f.line, f"USTRUCTs cannot contain UFUNCTIONs ('{f.name}')")
        if f.name in seen:
            errors.add(path, f.line, f"'{f.name}': overloaded UFUNCTIONs are not supported (first declared on line {seen[f.name]})")
        seen[f.name] = f.line
        if is_rpc(f):
            if "Reliable" not in f.specs and "Unreliable" not in f.specs:
                errors.add(path, f.line, f"RPC '{f.name}' must specify Reliable or Unreliable")
            if f.ret != "void":
                errors.add(path, f.line, f"Replicated function '{f.name}' cannot have a return value")
            for ptxt, ptoks in f.params:
                pnames = [t[0] for t in ptoks]
                if "&" in pnames and "const" not in pnames:
                    errors.add(path, f.line, f"Replicated function '{f.name}': parameters cannot be passed by non-const reference ('{ptxt}')")
            if f.is_static:
                errors.add(path, f.line, f"RPC '{f.name}' cannot be static")
        if ("BlueprintNativeEvent" in f.specs or "BlueprintImplementableEvent" in f.specs) and f.is_virtual:
            errors.add(path, f.line, f"'{f.name}': BlueprintNativeEvent/BlueprintImplementableEvent functions must not be declared virtual")
    for p in c.properties:
        vis = [s for s in p.specs if s in VISIBILITY_SPECS]
        if len(vis) > 1:
            errors.add(path, p.line, f"Property '{p.name}': found more than one edit/visibility specifier ({', '.join(vis)}), only one is allowed")
        bpa = [s for s in p.specs if s in BP_ACCESS_SPECS]
        if len(bpa) > 1:
            errors.add(path, p.line, f"Property '{p.name}': cannot use both BlueprintReadWrite and BlueprintReadOnly")
        meta = str(p.specs.get("meta", ""))
        if bpa and p.access == "private" and "AllowPrivateAccess" not in meta:
            errors.add(path, p.line, f"Property '{p.name}': {bpa[0]} should not be used on private members (add meta=(AllowPrivateAccess=\"true\"))")
        if bpa and not p.bitfield and p.type_tokens and set(p.type_tokens) & BP_UNSUPPORTED_TYPES:
            bad = sorted(set(p.type_tokens) & BP_UNSUPPORTED_TYPES)[0]
            errors.add(path, p.line, f"Property '{p.name}': type '{bad}' is not supported by blueprint")
        # nested containers
        depth = 0
        stack = []
        for t in p.type_tokens:
            if t in CONTAINERS:
                if any(s in CONTAINERS for s in stack):
                    errors.add(path, p.line, f"Property '{p.name}': nested containers are not supported")
                    break
                stack.append(t)
            elif t == "<":
                depth += 1
            elif t == ">":
                depth -= 1
        rep = "Replicated" in p.specs or "ReplicatedUsing" in p.specs
        if rep and c.kind == "USTRUCT":
            errors.add(path, p.line, f"Struct members cannot be replicated ('{p.name}')")
        if "ReplicatedUsing" in p.specs:
            fn = str(p.specs["ReplicatedUsing"]).strip()
            if not find_ufunction(c, fn, all_classes):
                errors.add(path, p.line, f"Replication notification function '{fn}' for '{p.name}' was not found (it must be a UFUNCTION of '{c.name}' or a base class)")


def find_ufunction(c, name, all_classes):
    seen = set()
    cur = c
    while cur is not None and cur.name not in seen:
        seen.add(cur.name)
        if any(f.name == name for f in cur.functions):
            return True
        if not cur.bases:
            return False
        base = cur.bases[0].split("<")[0].split("::")[-1]
        cur = all_classes.get(base)
        if cur is None:
            return True  # engine base class: cannot verify, assume present
    return False


def emit_function_extras(c, f, iface=False):
    out = []
    params = ", ".join(p for p, _ in f.params)
    const = " const" if f.is_const else ""
    needs_impl = is_rpc(f) or "BlueprintNativeEvent" in f.specs
    if needs_impl and (f.name + "_Implementation") not in c.declared_names:
        out.append(f"virtual {f.ret} {f.name}_Implementation({params}){const};")
    if is_rpc(f) and "WithValidation" in f.specs and (f.name + "_Validate") not in c.declared_names:
        out.append(f"virtual bool {f.name}_Validate({params}){const};")
    if iface and ("BlueprintNativeEvent" in f.specs or "BlueprintImplementableEvent" in f.specs):
        obj = "const UObject*" if f.is_const else "UObject*"
        sep = ", " if params else ""
        out.append(f"static {f.ret} Execute_{f.name}({obj} O{sep}{params});")
    return out


def generate_body(c, line, macro):
    lines = []
    if c.kind == "USTRUCT":
        lines.append(f"friend struct Z_Construct_UScriptStruct_{c.name}_Statics;")
        lines.append("static class UScriptStruct* StaticStruct();")
        if c.bases:
            lines.append(f"typedef {c.bases[0]} Super;")
        for p in c.properties:
            pass
        return lines
    if c.kind == "IINTERFACE":
        lines.append("public:")
        lines.append(f"typedef {c.interface_uclass} UClassType;")
        lines.append(f"typedef {c.name} ThisClass;")
        lines.append("virtual UObject* _getUObject() const { return nullptr; }")
        for f in c.functions:
            lines.extend(emit_function_extras(c, f, iface=True))
        lines.append("protected:")
        if (f"~{c.name}") not in c.declared_names:
            lines.append(f"virtual ~{c.name}() {{}}")
        lines.append("public:" if macro != "GENERATED_BODY" else "private:")
        return lines
    base = c.bases[0] if c.bases else "UObject"
    lines.append("public:")
    lines.append(f"typedef {base} Super;")
    lines.append(f"typedef {c.name} ThisClass;")
    lines.append("static UClass* StaticClass();")
    for p in c.properties:
        if "Replicated" in p.specs or "ReplicatedUsing" in p.specs:
            lines.append(f"static constexpr bool UEStubReplicated_{p.name} = true;")
    for f in c.functions:
        lines.extend(emit_function_extras(c, f))
    # lets AddDynamic/BindDynamic reject handlers that are not UFUNCTIONs (UE only ensures at runtime)
    ufuncs = " || ".join(f'N == "{f.name}"' for f in c.functions) or "false"
    lines.append(f"static constexpr bool UEStubIsUFunction(::std::string_view N) {{ return {ufuncs}; }}")
    legacy = macro in ("GENERATED_UCLASS_BODY", "GENERATED_UINTERFACE_BODY")
    if legacy:
        lines.append(f"{c.name}(const FObjectInitializer& ObjectInitializer);")
    elif not c.has_ctor:
        lines.append(f"{c.name}(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());")
    lines.append("private:")
    lines.append(f"{c.name}({c.name}&&);")
    lines.append(f"{c.name}(const {c.name}&);")
    lines.append("public:" if legacy else "private:")
    return lines


ENUM_RE = re.compile(r"\bUENUM\s*\(((?:[^()]|\([^()]*\))*)\)\s*enum\s+(class\s+)?(\w+)\s*(?::\s*(\w+))?\s*\{([^}]*)\}", re.S)
NS_ENUM_RE = re.compile(r"\bUENUM\s*\(((?:[^()]|\([^()]*\))*)\)\s*namespace\s+(\w+)\s*\{\s*enum\s+(\w+)\s*(?::\s*(\w+))?\s*\{([^}]*)\}", re.S)


def enum_entries(body):
    names = []
    depth = 0
    cur = ""
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            names.append(cur)
            cur = ""
        else:
            cur += ch
    names.append(cur)
    out = []
    for e in names:
        e = re.sub(r"UMETA\s*\(.*\)", "", e, flags=re.S).strip()
        if not e:
            continue
        out.append(e.split("=")[0].strip())
    return out


def process_header(path, rel, src_dir, out_dir, all_classes, errors, module_name):
    text = open(path, encoding="utf-8", errors="replace").read()
    base = os.path.splitext(os.path.basename(path))[0]
    inc_re = re.compile(r'^[ \t]*#[ \t]*include[ \t]*[<"]([^">]+)[">]', re.M)
    includes = [(m.group(1), line_of(text, m.start())) for m in inc_re.finditer(text)]
    gen = [(name, ln) for name, ln in includes if name.endswith(".generated.h")]
    if not gen:
        return None
    gname, gline = gen[-1]
    if gname != base + ".generated.h":
        errors.add(rel, gline, f"expected #include \"{base}.generated.h\", found \"{gname}\"")
    after = [name for name, ln in includes if ln > gline]
    if after:
        errors.add(rel, gline, f"#include found after .generated.h file - the .generated.h file should always be the last #include in a header ({after[0]})")
    clean = clean_source(text)
    tokens = tokenize(clean)
    classes = collect_classes(rel, text, clean, tokens, errors)
    for c in classes:
        scan_class_body(c, rel, text, clean, tokens, errors)
    return dict(path=path, rel=rel, base=base, text=text, clean=clean, classes=classes, gline=gline)


def file_id(module_name, rel):
    return "FID_" + re.sub(r"[^A-Za-z0-9]", "_", module_name + "_" + rel)


def write_generated(info, out_dir, module_name, all_classes, errors):
    rel = info["rel"]
    base = info["base"]
    fid = file_id(module_name, os.path.splitext(rel)[0] + "_h")
    guard = f"{module_name.upper()}_{base}_generated_h"
    out = []
    out.append("// Generated by uht.py (offline stub of the Unreal Header Tool). Do not edit.")
    out.append("#include \"UObject/ObjectMacros.h\"")
    out.append("#include \"UObject/ScriptMacros.h\"")
    out.append(f"#ifdef {guard}")
    out.append(f"#error \"{base}.generated.h already included, missing '#pragma once' in {base}.h\"")
    out.append("#endif")
    out.append(f"#define {guard}")
    out.append("")
    out.append("#undef CURRENT_FILE_ID")
    out.append(f"#define CURRENT_FILE_ID {fid}")
    for c in info["classes"]:
        check_class(c, all_classes, rel, errors)
        if not c.name:
            continue
        if c.kind in ("UCLASS", "UINTERFACE"):
            out.append(f"class {c.name};")
            out.append(f"template<> {module_name.upper()}_API UClass* StaticClass<{c.name}>();")
        if c.kind == "USTRUCT":
            out.append(f"struct {c.name};")
            out.append(f"template<> {module_name.upper()}_API UScriptStruct* StaticStruct<{c.name}>();")
        for line, macro in c.generated:
            body = generate_body(c, line, macro)
            name = f"{fid}_{line}_{'GENERATED_BODY_LEGACY' if macro in ('GENERATED_UCLASS_BODY', 'GENERATED_UINTERFACE_BODY', 'GENERATED_IINTERFACE_BODY') else 'GENERATED_BODY'}"
            out.append(f"#define {name} \\")
            out.append(" \\\n".join("    " + l for l in body))
            out.append("")
    raw = info["clean"]
    for m in ENUM_RE.finditer(raw):
        specs = parse_specifiers(m.group(1))
        is_class = bool(m.group(2))
        name = m.group(3)
        under = m.group(4)
        entries = enum_entries(m.group(5))
        ln = line_of(raw, m.start())
        if "BlueprintType" in specs and is_class and under and under != "uint8":
            errors.add(rel, ln, f"Invalid BlueprintType enum base for '{name}' - currently only uint8 is supported")
        prefix = f"{name}::" if is_class else ""
        out.append(f"#define FOREACH_ENUM_{name.upper()}(op) " + " ".join(f"op({prefix}{e})" for e in entries))
        if is_class and under:
            out.append(f"enum class {name} : {under};")
            out.append(f"template<> struct TIsUEnumClass<{name}> {{ enum {{ Value = true }}; }};")
            out.append(f"template<> {module_name.upper()}_API UEnum* StaticEnum<{name}>();")
    for m in NS_ENUM_RE.finditer(raw):
        ns, inner = m.group(2), m.group(3)
        entries = enum_entries(m.group(5))
        out.append(f"#define FOREACH_ENUM_{ns.upper()}(op) " + " ".join(f"op({ns}::{e})" for e in entries))
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, base + ".generated.h")
    content = "\n".join(out) + "\n"
    if not os.path.exists(dest) or open(dest).read() != content:
        with open(dest, "w") as fh:
            fh.write(content)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src_dir = os.path.abspath(sys.argv[1])
    out_dir = os.path.abspath(sys.argv[2])
    module_name = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(src_dir.rstrip("/"))
    errors = Errors()
    infos = []
    for root, _, files in os.walk(src_dir):
        for fn in sorted(files):
            if fn.endswith(".h"):
                path = os.path.join(root, fn)
                rel = os.path.relpath(path, src_dir)
                info = process_header(path, rel, src_dir, out_dir, None, errors, module_name)
                if info:
                    infos.append(info)
    all_classes = {}
    for info in infos:
        for c in info["classes"]:
            if c.name:
                all_classes[c.name] = c
    for info in infos:
        write_generated(info, out_dir, module_name, all_classes, errors)
    # Manifest of the members the real UHT defines in <File>.gen.cpp (used by link.sh to tell
    # generated symbols from functions the game forgot to define).
    manifest = {}
    for name, c in all_classes.items():
        thunks = [f.name for f in c.functions
                  if is_rpc(f) or "BlueprintNativeEvent" in f.specs or "BlueprintImplementableEvent" in f.specs]
        manifest[name] = {"kind": c.kind, "thunks": sorted(set(thunks)), "user_ctor": bool(c.has_ctor)}
    os.makedirs(out_dir, exist_ok=True)
    import json
    with open(os.path.join(out_dir, "uht_manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)
    for e in errors.items:
        print(os.path.join(src_dir, e) if not e.startswith("/") else e)
    return 1 if errors.items else 0


if __name__ == "__main__":
    sys.exit(main())

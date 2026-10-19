#!/usr/bin/env python3
"""One-off helper: give every declared-only member function of a class template (and every
declared-only namespace-scope function template) a stub body, so that instantiating the
template with an internal-linkage or local type does not trigger clang's
-Wundefined-internal / "used but not defined ... type does not have linkage" errors.

usage: add_template_bodies.py FILE...   (edits in place, prints a count per file)
"""
import re
import sys

SPECIFIERS = ("static", "virtual", "inline", "explicit", "constexpr", "FORCEINLINE", "friend", "consteval")
NOT_FUNC_NAMES = {"decltype", "sizeof", "alignof", "noexcept", "requires", "static_assert", "alignas", "__attribute__"}


def strip_template_prefix(s):
    """Split a leading 'template <...>' (balanced) from s."""
    m = re.match(r"\s*template\s*<", s)
    if not m:
        return "", s
    depth = 0
    i = m.end() - 1
    while i < len(s):
        c = s[i]
        if c == "<":
            depth += 1
        elif c == ">":
            depth -= 1
            if depth == 0:
                return s[: i + 1] + " ", s[i + 1:].lstrip()
        elif c == "(":
            # skip parenthesised expressions inside template params
            pd = 0
            while i < len(s):
                if s[i] == "(":
                    pd += 1
                elif s[i] == ")":
                    pd -= 1
                    if pd == 0:
                        break
                i += 1
        i += 1
    return None, s


def find_param_open(decl):
    """Index of the '(' that opens the parameter list, and the function name."""
    angle = 0
    i = 0
    n = len(decl)
    while i < n:
        if decl.startswith("operator", i) and (i == 0 or not (decl[i - 1].isalnum() or decl[i - 1] == "_")):
            j = i + len("operator")
            # operator() / operator symbol / conversion operator
            k = j
            while k < n and decl[k] == " ":
                k += 1
            if decl.startswith("()", k):
                p = decl.find("(", k + 2)
                return p, decl[i:k + 2].replace(" ", "")
            p = decl.find("(", k)
            if p < 0:
                return -1, None
            return p, decl[i:p].strip()
        c = decl[i]
        if c == "<":
            angle += 1
        elif c == ">":
            angle = max(0, angle - 1)
        elif c == "(" and angle == 0:
            m = re.search(r"(~?[A-Za-z_]\w*)\s*$", decl[:i])
            if m and m.group(1) not in NOT_FUNC_NAMES:
                return i, m.group(1)
            # skip a parenthesised group (decltype(...) etc.)
            depth = 0
            while i < n:
                if decl[i] == "(":
                    depth += 1
                elif decl[i] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
        i += 1
    return -1, None


def matching_paren(s, i):
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "(":
            depth += 1
        elif s[j] == ")":
            depth -= 1
            if depth == 0:
                return j
    return -1


def transform(line, class_name):
    stripped = line.strip()
    if not stripped.endswith(";") or "{" in stripped or "}" in stripped:
        return None
    if stripped.startswith(("typedef", "using", "static_assert", "return", "#", "//", "enum", "class ", "struct ", "namespace", "template <typename", "template<typename")) and not re.match(r"template\s*<.*>\s*\S.*\(", stripped):
        if not stripped.startswith("template"):
            return None
    indent = line[: len(line) - len(line.lstrip())]
    tmpl, rest = strip_template_prefix(stripped)
    if tmpl is None:
        return None
    if rest.startswith(("typedef", "using", "class ", "struct ", "friend class", "friend struct")):
        return None
    body_decl = rest[:-1].rstrip()  # drop ';'
    open_i, name = find_param_open(body_decl)
    if open_i < 0:
        return None
    close_i = matching_paren(body_decl, open_i)
    if close_i < 0:
        return None
    tail = body_decl[close_i + 1:]
    if "=" in tail:
        return None  # = 0 / = delete / = default
    if re.search(r"[^\s\w&]", tail.replace("->", "").replace("::", "").replace("<", "").replace(">", "").replace(",", "").replace("*", "").replace("(", "").replace(")", "")):
        pass
    head = body_decl[:open_i]
    # strip specifiers from head
    head_words = head.strip()
    specs = []
    changed = True
    while changed:
        changed = False
        for sp in SPECIFIERS:
            if head_words.startswith(sp + " "):
                specs.append(sp)
                head_words = head_words[len(sp) + 1:].lstrip()
                changed = True
    ret_type = head_words[: len(head_words) - len(name)].strip() if head_words.endswith(name) else None
    if ret_type is None:
        return None
    trailing = None
    if "->" in tail:
        trailing = tail.split("->", 1)[1].strip()
        trailing = re.sub(r"\b(override|final)\b", "", trailing).strip()
    is_ctor = name == class_name or name.startswith("~") or (ret_type == "" and not name.startswith("operator"))
    if name.startswith("operator") and ret_type == "" and not is_ctor:
        conv = name[len("operator"):].strip()
        ret_type = conv
    if trailing:
        ret_type = trailing
    if ret_type in ("auto", "decltype(auto)"):
        return None
    if is_ctor:
        body = " {}"
    elif ret_type == "void" or ret_type.endswith(" void") and "*" not in ret_type:
        body = " {}"
    else:
        rt = re.sub(r"\b(static|virtual|inline|constexpr|FORCEINLINE)\b", "", ret_type).strip()
        body = " { return ::UEStub::Fake<" + rt + ">(); }"
    return indent + (tmpl or "") + rest[:-1].rstrip() + body


CLASS_HEAD = re.compile(r"^\s*(template\s*<.*>\s*)?(class|struct|union)\s+(?:\w+_API\s+)?([A-Za-z_]\w*)\b(?![^:]*;)")


def process(path):
    lines = open(path).read().split("\n")
    out = []
    stack = []  # entries: ("ns"|"class"|"block", templated, name)
    pending = None  # (templated, name) for a class head waiting for '{'
    prev_template = False
    count = 0
    for line in lines:
        stripped = line.strip()
        top = stack[-1] if stack else None
        in_templ_class = top is not None and top[0] == "class" and top[1]
        at_ns = all(e[0] == "ns" for e in stack)
        new_line = None
        if in_templ_class:
            new_line = transform(line, top[2])
        elif at_ns and stripped.startswith("template") and stripped.endswith(";") and "(" in stripped:
            new_line = transform(line, "")
        if new_line is not None and new_line != line:
            count += 1
            line = new_line
            stripped = line.strip()
        # scope tracking
        head = CLASS_HEAD.match(line)
        templated_here = bool(head and head.group(1)) or prev_template
        enclosing_templ = any(e[0] == "class" and e[1] for e in stack)
        for idx, ch in enumerate(line):
            if ch == "{":
                if pending is not None:
                    stack.append(("class", pending[0], pending[1]))
                    pending = None
                elif head and "{" in line[head.end():] and idx >= head.end() - 1:
                    stack.append(("class", templated_here or enclosing_templ, head.group(3)))
                    head = None
                elif re.search(r"\bnamespace\b[^{]*$", line[:idx]):
                    stack.append(("ns", False, ""))
                else:
                    stack.append(("block", False, ""))
            elif ch == "}":
                if stack:
                    stack.pop()
        if head and "{" not in line and not stripped.endswith(";"):
            pending = (templated_here or enclosing_templ, head.group(3))
        if stripped:
            prev_template = bool(re.match(r"^template\s*<.*>\s*$", stripped))
        out.append(line)
    open(path, "w").write("\n".join(out))
    return count


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p, process(p))

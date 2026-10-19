#!/usr/bin/env bash
# Confirms the checker rejects known-bad code and accepts a known-good actor.
#
# Each case in selftest/cases is a stem (Foo.h and/or Foo.cpp). The first "// EXPECT:" line
# is either PASS or an extended regex that must appear in check.sh's output, which must fail.
# An optional "// MODULES: A B" line adds private module dependencies to the case's Build.cs.
# Cases with "// LINK-EXPECT: regex" lines are also run through link.sh: every LINK-EXPECT regex
# must appear in its report and no "// LINK-REJECT: regex" may match it.
# Every case is checked as its own one-module project (SelfTest, with a Build.cs like Quebec's).
set -u
STUBS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CASES="$STUBS/selftest/cases"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/uestubs-selftest.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

OK=0
BAD=0
for stem in $(ls "$CASES" | sed -E 's/\.(h|cpp)$//' | sort -u); do
    mod="$TMP/$stem/SelfTest"
    mkdir -p "$mod"
    cp "$CASES/$stem".* "$mod/"
    extra="$(grep -h -m1 -o '// MODULES: .*' "$CASES/$stem".* | head -1 | sed 's|^// MODULES: ||')"
    private=""
    for m in $extra; do private="$private\"$m\", "; done
    cat >"$mod/SelfTest.Build.cs" <<EOF
using UnrealBuildTool;
public class SelfTest : ModuleRules
{
    public SelfTest(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "InputCore", "NetCore" });
        PrivateDependencyModuleNames.AddRange(new string[] { ${private} });
    }
}
EOF
    expect="$(grep -h -m1 -o '// EXPECT: .*' "$CASES/$stem".* | head -1 | sed 's|^// EXPECT: ||')"
    out="$("$STUBS/check.sh" --src "$mod" 2>&1)"
    status=$?
    link_expect="$(grep -h -o '// LINK-EXPECT: .*' "$CASES/$stem".* | sed 's|^// LINK-EXPECT: ||' | sort -u)"
    link_reject="$(grep -h -m1 -o '// LINK-REJECT: .*' "$CASES/$stem".* | head -1 | sed 's|^// LINK-REJECT: ||')"
    if [ -n "$link_expect" ]; then
        lout="$("$STUBS/link.sh" --src "$mod" 2>&1)"
        lbad=""
        while IFS= read -r rx; do echo "$lout" | grep -Eq -- "$rx" || lbad="$lbad missing /$rx/;"; done <<<"$link_expect"
        if [ -n "$link_reject" ]; then
            hit="$(echo "$lout" | grep -E -- "$link_reject" | grep -v 'referenced from' | head -1)"
            [ -n "$hit" ] && lbad="$lbad unexpected: $hit;"
        fi
        if [ -n "$lbad" ]; then
            echo "BAD  $stem (link.sh):$lbad"
            echo "$lout" | sed 's/^/     /' | head -30
            BAD=$((BAD + 1))
        else
            echo "ok   $stem (link.sh reports $(echo "$link_expect" | wc -l) missing symbol(s))"
            OK=$((OK + 1))
        fi
    fi
    if [ "$expect" = PASS ]; then
        if [ $status -eq 0 ]; then
            echo "ok   $stem (compiles cleanly)"
            OK=$((OK + 1))
        else
            echo "BAD  $stem: expected a clean compile"
            echo "$out" | sed 's/^/     /' | head -40
            BAD=$((BAD + 1))
        fi
    elif [ $status -ne 0 ] && echo "$out" | grep -Eq -- "$expect"; then
        echo "ok   $stem (rejected: $(echo "$out" | grep -Eo -m1 -- "$expect" | head -1))"
        OK=$((OK + 1))
    else
        echo "BAD  $stem: expected failure matching /$expect/ (check.sh exit $status)"
        echo "$out" | sed 's/^/     /' | head -40
        BAD=$((BAD + 1))
    fi
done
rm -rf "$STUBS/generated/SelfTest"
echo
echo "selftest: $OK ok, $BAD unexpected"
[ $BAD -eq 0 ]

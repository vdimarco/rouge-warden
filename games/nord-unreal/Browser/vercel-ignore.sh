#!/usr/bin/env bash
# Vercel ignored build step for the NORD player. Exit 0 skips the build; exit 1 builds.
# Vercel runs it in the project root directory, games/nord-unreal/Browser.
set -u

# Endpoint-only redeploys still need a fresh browser bundle.
if [ "${NORD_FORCE_BUILD:-0}" = "1" ]; then
  exit 1
fi

# Files that never reach dist/: tests, docs and local tools.
paths=(. ':(exclude)*.test.mjs' ':(exclude)*.md' ':(exclude)stream-sample.mjs'
  ':(exclude).env.example' ':(exclude).gitignore')

head=${VERCEL_GIT_COMMIT_SHA:-HEAD}
# The last successful deployment on this branch, so a push with several commits
# is compared as a whole. A branch's first build has none; use the parent commit.
base=${VERCEL_GIT_PREVIOUS_SHA:-$head^}

if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  # Vercel's clone is shallow. The diff needs only the base commit's tree, not the history between.
  echo "Base $base is not in the clone; fetching it."
  git fetch --quiet --no-tags --depth=1 origin "$base" 2>&1
  if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
    echo "Could not fetch $base; building."
    exit 1
  fi
fi

git diff --quiet "$base" "$head" -- "${paths[@]}"
status=$?
if [ "$status" -eq 0 ]; then
  echo "No served file changed since $base; skipping the build."
  exit 0
fi
if [ "$status" -eq 1 ]; then
  echo "Served files changed since $base:"
  git diff --name-only "$base" "$head" -- "${paths[@]}"
else
  echo "git diff failed ($status); building."
fi
exit 1

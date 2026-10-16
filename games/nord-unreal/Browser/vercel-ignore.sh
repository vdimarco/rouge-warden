#!/usr/bin/env bash
# Vercel ignored build step for the NORD player. Exit 0 skips the build; exit 1 builds.
# Vercel runs it in the project root directory, games/nord-unreal/Browser.
set -u

# Files that never reach dist/: tests, docs and local tools.
paths=(. ':(exclude)*.test.mjs' ':(exclude)*.md' ':(exclude)stream-sample.mjs'
  ':(exclude).env.example' ':(exclude).gitignore')

head=${VERCEL_GIT_COMMIT_SHA:-HEAD}
# The last successful deployment on this branch, so a push with several commits
# is compared as a whole. A branch's first build has none; use the parent commit.
base=${VERCEL_GIT_PREVIOUS_SHA:-$head^}

if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "Base $base is not in the clone; building."
  exit 1
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

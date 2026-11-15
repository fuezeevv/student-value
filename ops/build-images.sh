#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test -z "$(git status --porcelain --untracked-files=no)" || { echo "Refusing to build an unchecked dirty worktree" >&2; exit 1; }
commit=$(git rev-parse HEAD)
docker build --secret id=action_key,src=/srv/studentvalue/secrets/action-key.base64 --target runtime -t "studentvalue:$commit" .
docker build --target migration -t "studentvalue-migration:$commit" .
printf 'Built immutable application and migration images for %s\n' "$commit"

#!/bin/zsh
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <task-name>"
  echo "Example: $0 editor-performance"
  exit 1
fi

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
task_name="$1"
branch_name="codex/${task_name}"

cd "$repo_root"

current_branch="$(git branch --show-current)"
echo "Current branch: ${current_branch}"
echo "Creating branch: ${branch_name}"

mkdir -p .git/refs/heads/codex
git checkout -b "$branch_name"

echo "Switched to ${branch_name}"

#!/usr/bin/env bash
# Automated Version Bump Script for Dispatch Monorepo
# Follows Project Rules in AGENTS.md

set -euo pipefail

bump_flutter() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Warning: $file not found."
    return
  fi
  # Match: version: major.minor.patch+build
  local current
  current=$(grep -E '^version: [0-9]+\.[0-9]+\.[0-9]+\+[0-9]+' "$file" | head -n1 | awk '{print $2}')
  if [ -n "$current" ]; then
    local base="${current%+*}"
    local build="${current#*+}"
    local major="${base%%.*}"
    local rest="${base#*.}"
    local minor="${rest%%.*}"
    local patch="${rest#*.}"

    local new_patch=$((patch + 1))
    local new_build=$((build + 1))
    local new_version="${major}.${minor}.${new_patch}+${new_build}"

    sed -i.bak -E "s/^version: .*/version: ${new_version}/" "$file"
    rm -f "${file}.bak"
    echo "Bumped $file from $current to $new_version"
  else
    echo "Warning: Could not parse version in $file"
  fi
}

bump_server() {
  local file="server/cmd/server/main.go"
  if [ ! -f "$file" ]; then
    echo "Warning: $file not found."
    return
  fi
  local current
  current=$(grep -E 'defaultAPIVersion = "[0-9]+\.[0-9]+\.[0-9]+"' "$file" | head -n1 | sed -E 's/.*"([^"]+)".*/\1/')
  if [ -n "$current" ]; then
    local major="${current%%.*}"
    local rest="${current#*.}"
    local minor="${rest%%.*}"
    local patch="${rest#*.}"
    local new_patch=$((patch + 1))
    local new_version="${major}.${minor}.${new_patch}"

    sed -i.bak -E "s/defaultAPIVersion = \"[^\"]+\"/defaultAPIVersion = \"${new_version}\"/" "$file"
    rm -f "${file}.bak"
    echo "Bumped $file to $new_version"
  fi
}

bump_web() {
  echo "Bumping Web version..."
  (cd web && npm version patch --no-git-tag-version)
}

CHANGED_FILES=$(git status --porcelain || true)

if echo "$CHANGED_FILES" | grep -q "web/"; then
  bump_web
fi

if echo "$CHANGED_FILES" | grep -q "server/"; then
  bump_server
fi

if echo "$CHANGED_FILES" | grep -q "driver_app/"; then
  bump_flutter "driver_app/pubspec.yaml"
fi

if echo "$CHANGED_FILES" | grep -q "parent_app/"; then
  bump_flutter "parent_app/pubspec.yaml"
fi

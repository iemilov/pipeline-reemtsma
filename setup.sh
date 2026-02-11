#!/bin/bash
# Creates symlinks for Claude Code to find config in the pipeline submodule.
# Run once after cloning: cd pipeline && ./setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUBMODULE_NAME="$(basename "$SCRIPT_DIR")"

# Ensure .claude directory exists
mkdir -p "$REPO_ROOT/.claude"

# Symlink settings.local.json
ln -sf "../$SUBMODULE_NAME/.claude/settings.local.json" "$REPO_ROOT/.claude/settings.local.json"

# Symlink skills directory (from .claude/, go up one level to reach repo root)
ln -sf "../$SUBMODULE_NAME/.claude/skills" "$REPO_ROOT/.claude/skills"

# Symlink CLAUDE.md
ln -sf "$SUBMODULE_NAME/CLAUDE.md" "$REPO_ROOT/CLAUDE.md"

echo "Claude Code symlinks created:"
echo "  CLAUDE.md -> $SUBMODULE_NAME/CLAUDE.md"
echo "  .claude/settings.local.json -> ../$SUBMODULE_NAME/.claude/settings.local.json"
echo "  .claude/skills -> ../$SUBMODULE_NAME/.claude/skills"

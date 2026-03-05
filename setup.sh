#!/bin/bash
# Creates symlinks for Claude Code to find config in the pipeline submodule.
# Run once after cloning: cd pipeline && ./setup.sh
#
# Usage:
#   ./setup.sh                  # Uses default customer (lotto-bw)
#   ./setup.sh <customer-name>  # Uses specified customer folder

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUBMODULE_NAME="$(basename "$SCRIPT_DIR")"
CUSTOMER="${1:-lotto-bw}"
CUSTOMER_DIR="$SCRIPT_DIR/customers/$CUSTOMER"

# Initialize customer submodule if needed
if [ -f "$SCRIPT_DIR/.gitmodules" ] && grep -q "customers/$CUSTOMER" "$SCRIPT_DIR/.gitmodules" 2>/dev/null; then
  if [ -z "$(ls -A "$CUSTOMER_DIR" 2>/dev/null)" ]; then
    echo "Initializing customer submodule: customers/$CUSTOMER"
    (cd "$SCRIPT_DIR" && git submodule update --init "customers/$CUSTOMER") || {
      echo "Error: Failed to initialize submodule for customers/$CUSTOMER"
      echo "You may not have access to this customer repository."
      exit 1
    }
  fi
fi

# Validate customer config exists
if [ ! -f "$CUSTOMER_DIR/config.md" ]; then
  echo "Error: config.md not found in customers/$CUSTOMER"
  if [ -f "$SCRIPT_DIR/.gitmodules" ]; then
    echo "You may not have access to this customer repository."
  fi
  echo "Available customers:"
  for d in "$SCRIPT_DIR"/customers/*/; do
    name="$(basename "$d")"
    [ "$name" = "_template" ] && continue
    [ -f "$d/config.md" ] && echo "  $name" || echo "  $name (not initialized)"
  done
  exit 1
fi

# Ensure .claude directory exists
mkdir -p "$REPO_ROOT/.claude"

# Symlink settings.local.json
ln -sf "../$SUBMODULE_NAME/.claude/settings.local.json" "$REPO_ROOT/.claude/settings.local.json"

# Symlink skills directory (from .claude/, go up one level to reach repo root)
ln -sf "../$SUBMODULE_NAME/.claude/skills" "$REPO_ROOT/.claude/skills"

# Symlink commands directory (Claude Code uses .claude/commands/ for slash commands)
ln -sf "../$SUBMODULE_NAME/.claude/skills" "$REPO_ROOT/.claude/commands"

# Symlink CLAUDE.md
ln -sf "$SUBMODULE_NAME/CLAUDE.md" "$REPO_ROOT/CLAUDE.md"

# Symlink customer config files
ln -sf "customers/$CUSTOMER/config.md" "$SCRIPT_DIR/customer.config.md"
ln -sf "customers/$CUSTOMER/domain-knowledge.md" "$SCRIPT_DIR/customer.domain.md"
ln -sf "customers/$CUSTOMER/stack.config.md" "$SCRIPT_DIR/stack.config.md"
ln -sf "customers/$CUSTOMER/testdata.config.md" "$SCRIPT_DIR/testdata.config.md"

echo "Claude Code symlinks created (customer: $CUSTOMER):"
echo "  CLAUDE.md -> $SUBMODULE_NAME/CLAUDE.md"
echo "  .claude/settings.local.json -> ../$SUBMODULE_NAME/.claude/settings.local.json"
echo "  .claude/skills -> ../$SUBMODULE_NAME/.claude/skills"
echo "  .claude/commands -> ../$SUBMODULE_NAME/.claude/skills"
echo "  $SUBMODULE_NAME/customer.config.md -> customers/$CUSTOMER/config.md"
echo "  $SUBMODULE_NAME/customer.domain.md -> customers/$CUSTOMER/domain-knowledge.md"
echo "  $SUBMODULE_NAME/stack.config.md -> customers/$CUSTOMER/stack.config.md"
echo "  $SUBMODULE_NAME/testdata.config.md -> customers/$CUSTOMER/testdata.config.md"

# Rebundle knowledge for projects with bundle-knowledge.js
for bundler in "$REPO_ROOT"/projects/*/scripts/bundle-knowledge.js; do
  [ -f "$bundler" ] || continue
  project_dir="$(dirname "$(dirname "$bundler")")"
  project_name="$(basename "$project_dir")"
  echo "Rebundling knowledge for project: $project_name"
  (cd "$project_dir" && node scripts/bundle-knowledge.js)
done

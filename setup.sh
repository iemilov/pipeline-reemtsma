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

# Validate customer folder exists
if [ ! -d "$CUSTOMER_DIR" ]; then
  echo "Error: Customer folder not found: customers/$CUSTOMER"
  echo "Available customers:"
  ls -1 "$SCRIPT_DIR/customers/" | grep -v '^_'
  exit 1
fi

# Ensure .claude directory exists
mkdir -p "$REPO_ROOT/.claude"

# Symlink settings.local.json
ln -sf "../$SUBMODULE_NAME/.claude/settings.local.json" "$REPO_ROOT/.claude/settings.local.json"

# Symlink skills directory (from .claude/, go up one level to reach repo root)
ln -sf "../$SUBMODULE_NAME/.claude/skills" "$REPO_ROOT/.claude/skills"

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
echo "  $SUBMODULE_NAME/customer.config.md -> customers/$CUSTOMER/config.md"
echo "  $SUBMODULE_NAME/customer.domain.md -> customers/$CUSTOMER/domain-knowledge.md"
echo "  $SUBMODULE_NAME/stack.config.md -> customers/$CUSTOMER/stack.config.md"
echo "  $SUBMODULE_NAME/testdata.config.md -> customers/$CUSTOMER/testdata.config.md"

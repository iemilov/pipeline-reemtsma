#!/bin/bash
# Creates symlinks for Claude Code to find config in the pipeline submodule.
# Run once after cloning: cd pipeline && ./setup.sh <customer>
#
# Usage:
#   ./setup.sh <customer-name>  # Uses specified customer folder
#   ./setup.sh                  # Interactive selection

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUBMODULE_NAME="$(basename "$SCRIPT_DIR")"

# Collect available customers
CUSTOMERS=()
for d in "$SCRIPT_DIR"/customers/*/; do
  name="$(basename "$d")"
  [ "$name" = "_template" ] && continue
  CUSTOMERS+=("$name")
done

if [ ${#CUSTOMERS[@]} -eq 0 ]; then
  echo "Error: No customer folders found in customers/"
  exit 1
fi

# Select customer: argument or interactive
if [ -n "$1" ]; then
  CUSTOMER="$1"
else
  echo "Available customers:"
  for i in "${!CUSTOMERS[@]}"; do
    label="${CUSTOMERS[$i]}"
    if [ -f "$SCRIPT_DIR/customers/$label/config.md" ]; then
      echo "  $((i+1))) $label"
    else
      echo "  $((i+1))) $label (not initialized)"
    fi
  done
  printf "\nSelect customer [1-%d]: " "${#CUSTOMERS[@]}"
  read -r choice
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#CUSTOMERS[@]}" ]; then
    echo "Error: Invalid selection"
    exit 1
  fi
  CUSTOMER="${CUSTOMERS[$((choice-1))]}"
fi

CUSTOMER_DIR="$SCRIPT_DIR/customers/$CUSTOMER"

# Clone customer config repo if directory doesn't exist or is empty, otherwise pull latest
if [ -z "$(ls -A "$CUSTOMER_DIR" 2>/dev/null)" ]; then
  REPO_URL="https://github.com/Lintlinger/pipeline-${CUSTOMER}.git"
  echo "Cloning customer config: $REPO_URL"
  git clone "$REPO_URL" "$CUSTOMER_DIR" || {
    echo "Error: Failed to clone $REPO_URL"
    echo "You may not have access to this customer repository."
    exit 1
  }
elif [ -d "$CUSTOMER_DIR/.git" ]; then
  echo "Updating customer config: $CUSTOMER"
  git -C "$CUSTOMER_DIR" pull --ff-only || {
    echo "Warning: Could not fast-forward customer config. You may have local changes."
    echo "  Resolve manually: cd customers/$CUSTOMER && git pull"
  }
fi

# Validate customer config exists
if [ ! -f "$CUSTOMER_DIR/config.md" ]; then
  echo "Error: config.md not found in customers/$CUSTOMER"
  echo "You may not have access to this customer repository."
  echo "Available customers:"
  for name in "${CUSTOMERS[@]}"; do
    [ -f "$SCRIPT_DIR/customers/$name/config.md" ] && echo "  $name" || echo "  $name (not initialized)"
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

# Validate config completeness
echo ""
echo "Validating configuration..."
WARNINGS=0

check_field() {
  local file="$1" field="$2" label="$3"
  if ! grep -q "$field" "$file" 2>/dev/null || grep -q "| $field |.*| — |" "$file" 2>/dev/null || grep -q "| $field |.*| \`<" "$file" 2>/dev/null; then
    echo "  Warning: $label not configured in $(basename "$file")"
    WARNINGS=$((WARNINGS + 1))
  fi
}

# Check required files exist
for f in config.md domain-knowledge.md stack.config.md; do
  if [ ! -f "$CUSTOMER_DIR/$f" ]; then
    echo "  Warning: $f missing"
    WARNINGS=$((WARNINGS + 1))
  fi
done

# Check key config.md fields
if [ -f "$CUSTOMER_DIR/config.md" ]; then
  check_field "$CUSTOMER_DIR/config.md" "Short Name" "Customer Short Name"
  check_field "$CUSTOMER_DIR/config.md" "Full Name" "Customer Full Name"
fi

# Check stack.config.md has content beyond template
if [ -f "$CUSTOMER_DIR/stack.config.md" ]; then
  if grep -q "<framework>" "$CUSTOMER_DIR/stack.config.md" 2>/dev/null; then
    echo "  Warning: stack.config.md still contains template placeholders"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check domain-knowledge.md has content beyond template
if [ -f "$CUSTOMER_DIR/domain-knowledge.md" ]; then
  if grep -q "<ABR>" "$CUSTOMER_DIR/domain-knowledge.md" 2>/dev/null; then
    echo "  Warning: domain-knowledge.md still contains template placeholders"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

if [ "$WARNINGS" -eq 0 ]; then
  echo "  All checks passed."
else
  echo "  $WARNINGS warning(s) found — some skills may not work correctly."
fi

# Rebundle knowledge for projects with bundle-knowledge.js
for bundler in "$REPO_ROOT"/projects/*/scripts/bundle-knowledge.js; do
  [ -f "$bundler" ] || continue
  project_dir="$(dirname "$(dirname "$bundler")")"
  project_name="$(basename "$project_dir")"
  echo "Rebundling knowledge for project: $project_name"
  (cd "$project_dir" && node scripts/bundle-knowledge.js)
done

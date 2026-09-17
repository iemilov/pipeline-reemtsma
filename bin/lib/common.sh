#!/usr/bin/env bash
# bin/lib/common.sh — shared prelude for the pipeline helper scripts.
# Sourced, not executed. Provides: HARNESS_PIPELINE_DIR, die, usage, require_value, config_value.
# Scripts define their own USAGE text (string) or usage() before sourcing when they need a custom one.

HARNESS_PIPELINE_DIR="$(CDPATH= cd -P -- "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
export HARNESS_PIPELINE_DIR

# die <message> [exit-code]   — print to stderr and exit (default 2 = usage error)
die() {
  printf '%s: %s\n' "${0##*/}" "$1" >&2
  exit "${2:-2}"
}

# usage — print the script's header comment block (lines starting with '#' after the shebang) and stop
if ! declare -F usage >/dev/null 2>&1; then
usage() {
  if [ -n "${USAGE:-}" ]; then printf '%s\n' "$USAGE"; return; fi
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
}
fi

# require_value <flag> <value> — ensure a flag has a non-empty value; sets VALUE
require_value() {
  [ -n "${2:-}" ] || die "$1 requires a value"
  case "$2" in --*) die "$1 requires a value, got flag '$2'" ;; esac
  VALUE="$2"
}

# config_value <Key> [file] — read "| Key | value |" from a config markdown table; strips backticks and surrounding spaces
config_value() {
  local key="$1" file="${2:-$HARNESS_PIPELINE_DIR/customer.config.md}"
  [ -r "$file" ] || return 1
  awk -F'|' -v k="$key" '
    { key=$2; gsub(/^[ \t]+|[ \t]+$/,"",key); if (key==k) { v=$3; gsub(/^[ \t]+|[ \t]+$/,"",v); gsub(/`/,"",v); print v; exit } }' "$file"
}

# harness_config <Key> — like config_value on customer.config.md; honours HARNESS_CONFIG_QUIET=1 (no stderr on miss)
harness_config() {
  local v; v="$(config_value "$1")"
  case "$v" in ""|"<"*">"*)
    [ -n "${HARNESS_CONFIG_QUIET:-}" ] || printf '%s: config key "%s" not set\n' "${0##*/}" "$1" >&2
    return 1 ;;
  esac
  printf '%s\n' "$v"
}

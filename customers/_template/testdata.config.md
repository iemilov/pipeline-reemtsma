# Test Data Configuration: <Customer Name>

## Overview

This configuration defines test data records for the <Customer Name> project. Records are organized by dependency order — parent records are created first.

**Target:** <Platform and API details>
**Auth:** <Authentication method>

## Record Groups

---

### 1. <Parent Entity>

<API method and endpoint>

| Field | Value |
|-------|-------|
| `<field>` | `<value>` |
| referenceId | `<refId>` |

---

### 2. <Child Entity>

<API method and endpoint>

| Field | Value |
|-------|-------|
| `<parent_id>` | `{{Ref:<parentRefId>}}` |
| `<field>` | `<value>` |
| referenceId | `<refId>` |

---

## Presets

Define named presets for common test data scenarios:

| Preset Name | Record Groups | Description |
|-------------|---------------|-------------|
| `<preset-name>` | 1, 2 | <description> |

## Dependency Order

1. **<Parent Entity>** — No dependencies
2. **<Child Entity>** — Needs IDs from step 1

## Notes

- All `{{Ref:<referenceId>}}` tokens are replaced with the ID of the referenced record created earlier
- <Additional platform-specific notes>

# Customer Configuration: drKade

## Atlassian

| Key | Value |
|-----|-------|
| Jira URL | `https://<instance>.atlassian.net` |
| Confluence URL | `https://<instance>.atlassian.net/wiki` |
| Cloud ID | `<uuid>` |
| Project Key | `PP-` |
| Components | `<Component1>`, `<Component2>` |
| Epic Link Field | `customfield_10014` (via `Parent` on story) |
| Confluence Parent Page | `<parent page path>` |

## Customer Identity

| Key | Value |
|-----|-------|
| Full Name | drKade |
| Short Name | drKade |
| Architecture Page Title | `Technische Architektur – Salesforce drKade` |

## Locale & Language

| Key | Value |
|-----|-------|
| Story Language | German |
| Documentation Language | German |
| Release Notes Language | German |
| Validation Rule Messages | German |
| Date Format (Release Notes) | `DD.MM.YYYY` |

## Folder Paths

| Key | Path |
|-----|------|
| Transcript Input | `business/input/<epic-id>/` |
| Implementation Design | `implementation-design/<story-key>/` |
| Deployment Packages | `deployment/<version>/` |
| Skills Logs | `.claude/skills/<skill>/logs/` |

## Repository & CI/CD

| Key | Value |
|-----|-------|
| Submodule Path | `pipeline/` |
| Submodule Branch | `main` |
| Branch Pattern: Feature | `feature/<story-key>` |
| Branch Pattern: Release | `release/<version>` |
| Branch Pattern: Production | `master` |
| CI Skip Pattern | `[skip ci]` |
| Co-Author Policy | **Never** — do not add `Co-Authored-By` lines to any commit |
| AI Attribution Policy | **Never** — do not reference Claude or AI in customer-visible commits or metadata |

### Pipeline Environments

| Branch | Target Environment |
|--------|-------------------|
| `feature/*` | UAT |
| `release/*` | UAT |
| `master` | PROD (with manual approval) |

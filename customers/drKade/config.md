# Customer Configuration: drKade

## Atlassian

| Key | Value |
|-----|-------|
| Jira URL | `https://drkade.atlassian.net` |
| Confluence URL | `https://drkade.atlassian.net/wiki` |
| Cloud ID | `8d23ddk4-ja41-1cj4-657b-jk1cd0ca1bk7` |
| Project Key | `PP-` |
| Components | — |
| Epic Link Field | `customfield_10014` (via `Parent` on story) |
| Confluence Parent Page | — |

## Customer Identity

| Key | Value |
|-----|-------|
| Full Name | Dr. KADE Health Care |
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

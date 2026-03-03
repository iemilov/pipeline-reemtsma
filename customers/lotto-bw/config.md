# Customer Configuration: Lotto Baden-Württemberg

## Atlassian

| Key | Value |
|-----|-------|
| Jira URL | `https://kommit.atlassian.net` |
| Confluence URL | `https://kommit.atlassian.net/wiki` |
| Cloud ID | `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4` |
| Project Key | `CRM` |
| Components | `B2C`, `B2B` |
| Epic Link Field | `customfield_10014` (via `Parent` on story) |
| Confluence Parent Page | `Projekt: Einführung Salesforce/Architect` |

## Customer Identity

| Key | Value |
|-----|-------|
| Full Name | Lotto Baden-Württemberg |
| Short Name | LottoBW |
| Architecture Page Title | `Technische Architektur – Salesforce Lotto BW` |

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

### Azure DevOps

| Key | Value |
|-----|-------|
| Organization | `https://dev.azure.com/LottoBW` |
| Project | `CRM` |
| Repository | `DEV-LottoBW` |

### Pipeline Environments

| Branch | Target Environment |
|--------|-------------------|
| `feature/*` | INT (Integration sandbox) |
| `release/*` | UAT2 (Testing) |
| `master` | PROD (with manual approval) |

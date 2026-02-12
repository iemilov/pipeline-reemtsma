# Customer Configuration: <Customer Name>

## Atlassian

| Key | Value |
|-----|-------|
| Jira URL | `https://<instance>.atlassian.net` |
| Confluence URL | `https://<instance>.atlassian.net/wiki` |
| Cloud ID | `<uuid>` |
| Jira Project Key | `<PROJECT>` |
| Components | `<Component1>`, `<Component2>` |
| Epic Link Field | `customfield_10014` (via `Parent` on story) |
| Confluence Parent Page | `<parent page path>` |

## Customer Identity

| Key | Value |
|-----|-------|
| Full Name | <Customer Full Name> |
| Short Name | <Customer Short Name> |
| Architecture Page Title | `Technische Architektur – Salesforce <Short Name>` |

## Naming Conventions

| Key | Value |
|-----|-------|
| Primary Apex/Flow Prefix | `<PREFIX_>` |
| Secondary Apex/Flow Prefix | `<PREFIX2_>` (if applicable) |
| Primary LWC Prefix | `<prefix_>` |
| Secondary LWC Prefix | `<prefix2_>` (if applicable) |
| Test Data Factory | `<PREFIX_TestDataFactory>` |
| Apex Class Name Max Length | 40 characters |

## Salesforce Project

| Key | Value |
|-----|-------|
| API Version | `<version>` |
| PMD Rules File | `apex-rules.xml` |
| Source Path | `force-app/main/default/` |
| Project Config | `sfdx-project.json` |

## Org Aliases

| Alias | Username | Purpose |
|-------|----------|---------|
| `<DEV Alias>` | `<username>` | DEV sandbox (default development org) |
| `<UAT Alias>` | `<username>` | UAT testing sandbox |
| `<PROD Alias>` | — | Production (validation target) |

## Locale & Language

| Key | Value |
|-----|-------|
| Story Language | <language> |
| Documentation Language | <language> |
| Release Notes Language | <language> |
| Validation Rule Messages | <language> |
| Date Format (Release Notes) | `<format>` |

## Functional Domains

### Domain 1 — <Label>

- **Prefix:** `<PREFIX_>`
- **Scope:** <description>
- **Component (Jira):** `<component>`
- **Release Notes Section Header:** `<header>`

### Domain 2 — <Label> (if applicable)

- **Prefix:** `<PREFIX2_>`
- **Scope:** <description>
- **Component (Jira):** `<component>`
- **Release Notes Section Header:** `<header>`

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
| `feature/*` | <environment> |
| `release/*` | <environment> |
| `master` | <environment> |

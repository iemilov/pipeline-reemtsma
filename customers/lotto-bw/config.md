# Customer Configuration: Lotto Baden-Württemberg

## Atlassian

| Key | Value |
|-----|-------|
| Jira URL | `https://kommit.atlassian.net` |
| Confluence URL | `https://kommit.atlassian.net/wiki` |
| Cloud ID | `2a9f60f6-99f9-4ab6-aedd-ea0fc09fe2d4` |
| Jira Project Key | `CRM` |
| Components | `B2C`, `B2B` |
| Epic Link Field | `customfield_10014` (via `Parent` on story) |
| Confluence Parent Page | `Projekt: Einführung Salesforce/Architect` |

## Customer Identity

| Key | Value |
|-----|-------|
| Full Name | Lotto Baden-Württemberg |
| Short Name | Lotto BW |
| Architecture Page Title | `Technische Architektur – Salesforce Lotto BW` |

## Naming Conventions

| Key | Value |
|-----|-------|
| B2C Apex/Flow Prefix | `STLG_` |
| B2B Apex/Flow Prefix | `STLGS_` |
| B2C LWC Prefix | `stlg_` |
| B2B LWC Prefix | `stlgs_` |
| B2C Aura Prefix | `stlg_` |
| B2B Aura Prefix | `stlgs_` |
| Test Data Factory | `STLG_TestDataFactory` |
| Apex Class Name Max Length | 40 characters |

## Salesforce Project

| Key | Value |
|-----|-------|
| API Version | `64.0` |
| PMD Rules File | `apex-rules.xml` |
| Source Path | `force-app/main/default/` |
| Project Config | `sfdx-project.json` |

## Org Aliases

| Alias | Username | Purpose |
|-------|----------|---------|
| `LottoDEV` | `system.user@lotto-bw.de.dev` | DEV sandbox (default development org) |
| `LottoUAT2` | `system.user@lotto-bw.de.uat2` | UAT2 testing sandbox |
| `LottoPROD` | — | Production (validation target) |

## Locale & Language

| Key | Value |
|-----|-------|
| Story Language | German |
| Documentation Language | German |
| Release Notes Language | German |
| Validation Rule Messages | German |
| Date Format (Release Notes) | `DD.MM.YYYY` |

## Functional Domains

### B2C — Kundenservice (Service Desk & Customer Management)

- **Prefix:** `STLG_`
- **Scope:** Case management, person accounts, service desk, customer communication
- **Component (Jira):** `B2C`
- **Release Notes Section Header:** `B2C (Kundenservice)`

### B2B — Vertrieb (Sales & Store Management)

- **Prefix:** `STLGS_`
- **Scope:** Retail store management, visit reports, test purchases (Testkauf), inspections (VDE), store onboarding
- **Component (Jira):** `B2B`
- **Release Notes Section Header:** `B2B (Vertrieb)`

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
| `feature/*` | INT (Integration sandbox) |
| `release/*` | UAT2 (Testing) |
| `master` | PROD (with manual approval) |

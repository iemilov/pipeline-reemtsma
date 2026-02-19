# Customer Configuration: CloudRise Solutions

## Atlassian

| Key | Value |
|-----|-------|
| Jira URL | - |
| Confluence URL | - |
| Cloud ID | - |
| Jira Project Key | `CR` |
| Components | — |
| Epic Link Field | - |
| Confluence Parent Page | — |

## Customer Identity

| Key | Value |
|-----|-------|
| Full Name | CloudRise Solutions GmbH |
| Short Name | CloudRise |
| Architecture Page Title | `Technische Architektur – CloudRise CRM` |

## Locale & Language

| Key | Value |
|-----|-------|
| Story Language | German |
| Documentation Language | German |
| Release Notes Language | German |
| Validation Rule Messages | — |
| Date Format (Release Notes) | `DD.MM.YYYY` |

## Folder Paths

| Key | Path |
|-----|------|
| Transcript Input | `business/input/<epic-id>/` |
| Implementation Design | `projects/crm/implementation-design/` |
| Deployment Packages | — |
| Skills Logs | `.claude/skills/<skill>/logs/` |

## Repository & CI/CD

| Key | Value |
|-----|-------|
| Submodule Path | `pipeline/` |
| Submodule Branch | `main` |
| Branch Pattern: Feature | `feature/<story-key>` |
| Branch Pattern: Release | — |
| Branch Pattern: Production | `main` |
| CI Skip Pattern | — |
| Co-Author Policy | **Never** — do not add `Co-Authored-By` lines to any commit |
| AI Attribution Policy | **Never** — do not reference Claude or AI in customer-visible commits or metadata |

### Pipeline Environments

| Branch | Target Environment |
|--------|-------------------|
| `main` | Cloudflare Pages (Production) |

### GitHub Actions

Auto-deployment via GitHub Actions (no native Cloudflare Git provider — projects were created via direct upload).

| Workflow | Path Filter | Action |
|----------|-------------|--------|
| `.github/workflows/deploy-crm.yml` | `projects/crm/**` | Build & deploy CRM to Cloudflare Pages |

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` — API token with Cloudflare Pages: Edit permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

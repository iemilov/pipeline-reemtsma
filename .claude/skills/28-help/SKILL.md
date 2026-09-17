---
name: help
description: Display a quick-reference catalog of all available pipeline skills with usage examples, or the details of one skill
argument-hint: "[skill-name (optional)]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Configuration

Read `pipeline/customer.config.md` for the active customer's **Short Name** and **Platform**. They tailor the output: the header shows the customer, and Salesforce-only skills are marked as not applicable for another platform.

## Workflow

Shows the skill catalog in the conversation. No external tools are needed: the skill reads the `SKILL.md` frontmatter of every folder under `pipeline/.claude/skills/` and presents it.

**Usage:** `/help` for the full catalog, `/help <skill-name>` for one skill.

### Step 0: Parse arguments

If `$ARGUMENTS` is empty, show the full catalog (Step 1). Otherwise normalise the name (strip a leading `/`, allow the folder prefix `NN-`), find the matching folder, and show the detail (Step 2). If nothing matches, list the closest names and stop.

### Step 1: Full catalog

Build the catalog **from the folders that exist**: for each `pipeline/.claude/skills/*/SKILL.md` read `name`, `description` and `argument-hint`. Assign each skill to a group by the table below; a folder not listed lands under *Other*. Present in the Documentation Language with this layout:

```
## Pipeline Skills — Quick Reference

Active customer: <Short Name> | Platform: <Platform>

### Story Lifecycle
| Command | Description |
| `/analyze <topic-slug> [--from-transcript <path>]` | Requirements and codebase analysis before stories; concept dossier with story split |
| `/create-story [epic-id] [--concept <slug>] [--create-in-jira]` | Stories from transcripts or a concept; DRAFT implementation notes |
| `/design-us [story-key]` | FINAL implementation notes from the story and the codebase |
| `/implement-us [story-key] [--skip-deploy] [--no-pr]` | Implementation from FINAL notes, review loop, PMD, deploy, tests, test data, PR |
| `/promote-us [story-key] [target-env]` | Promote INT → UAT → PROD via the CI/CD pipeline |
| `/story-testdata <story-key> [org-alias]` | Test data plan for a story, delegates to /create-testdata |
| `/decision-paper <story-key | topic> [--options] [--audience]` | Options, effort with test impact, recommendation for the business |

### Review & Quality
| `/review-pr <pr-id-or-url> [--post-comment] [--base <branch>]` | Review one pull request; optional PR comment |
| `/process-pr-feedback <pr-id-or-url> [--include-resolved]` | Remediation plan from the remarks on a pull request |
| `/code-review [space-key] [--scope repo|branch|story <key>] [--publish]` | Repository or change-set review, local report, optional Confluence |
| `/verify-deployed-state <org-alias> [--scope ...]` | Repository vs. org drift for flows, Apex, metadata, validation rules |

### Analysis (read-only)
| `/investigate-data-issue <org> <records> "<observation>"` | Root-cause analysis of wrong data with durable evidence |
| `/trace-field <Object.Field | Object> [org-alias]` | Who writes a field, what fires on an object, reconciled against the org |
| `/org-review [org-alias] [--modules ...]` | Org health: security, reports, storage, layouts, licences (Salesforce) |
| `/ai-readiness-assessment`, `/security-orgreview`, `/reportsanddashboards-review`, `/storage-review`, `/layouts-lightning-review`, `/user-licenses-review` | Single-purpose org reviews (Salesforce) |

### Documentation & Communication
| `/document [key | topic] [--type epic|manual|architecture|knowledge|process] [--format md|html]` | Documents by type and audience; versioned, optional Confluence or HTML |
| `/document-us [epic-id]`, `/architecture-overview` | Forward to /document |
| `/build-knowledge <epic-key | topic> [--refresh]` | Internal topic documentation |
| `/write-crm-doc [story-keys]` | Salesforce Knowledge article draft |
| `/document-api [--format html|md|openapi] [--diff-only] [--publish]` | Partner-facing API reference from the inbound endpoints |
| `/release-notes [version]` | Release notes from the latest merge |
| `/project-update [date] [--from-previous] [--jql]` | Status one-pager for a customer meeting |
| `/client-update <type> "<topic>"` | Outward-facing customer text: incident, correction, summary, status, agenda, reply |
| `/process-transcript [folder]` | Execute Claude task blocks found in meeting transcripts |

### Test Data (Salesforce only)
| `/create-testdata [org-alias] [story-key | preset] [--dry-run]` | Create test data from testdata.config.md presets |
| `/cleanup-testdata [org-alias] [run-id | today | all] [--dry-run]` | Delete test data by run manifest |
| `/init-sandbox <org-alias> [--no-testdata] [--dry-run]` | Initialise a refreshed sandbox |

### Administration & Meta
| `/commit [message] [--no-push] [--repo ...]` | Commit and push across config, pipeline and main repository |
| `/onboard-pipeline-user <github-username> <project-repo>` | Grant a collaborator access to the pipeline and config repos |
| `/create-customer [customer-name]` | Scaffold a new customer config repo |
| `/help [skill-name]` | This catalog |
| `/improve-skills [--skill] [--days]` | Mine execution logs for recurring failure modes |

Tip: `/help <skill-name>` shows arguments, workflow steps and an example.
```

Group assignment by folder: 00, 01, 11, 02, 03, 26, 32 → Story Lifecycle; 22, 25, 08, 34 → Review & Quality; 30, 31, 29, 16–21 → Analysis; 23, 04, 05, 10, 13, 35, 06, 36, 33, 24 → Documentation & Communication; 09, 12, 27 → Test Data; 07, 14, 15, 28, 96 → Administration & Meta. Use the argument hints from the frontmatter verbatim where they fit on one line; shorten in the table and show the full hint in Step 2.

If `Platform` is not `salesforce`, append "(not applicable for this platform)" to the Salesforce-only rows instead of hiding them.

Read `pipeline/CLAUDE.md > Custom Skills` as a cross-check: a folder without a CLAUDE.md entry, or an entry without a folder, is listed at the end under *Inconsistencies* so the catalog and the index stay aligned.

### Step 2: Single skill detail

Read the skill's `SKILL.md` and present:

```
## /<name> — <description>

**Arguments:** <argument-hint>
**Platform:** all | Salesforce only
**Folder:** pipeline/.claude/skills/<folder>/

### Workflow
<numbered list of the skill's top-level steps, one line each, taken from its headings>

### Reads
<config files and folders the skill reads, from its Configuration section>

### Writes
<files, folders, external systems the skill writes to, from its workflow>

### Example
/<name> <realistic arguments, e.g. AP2-1583>
```

### Step 3: Log

Create `<YYYY-MM-DD>-<customer-short-name>-help-help.json` in `.claude/skills/28-help/logs/` per the CLAUDE.md JSON schema; `identifier` is `help` or the skill name shown.

## Important Rules

- The catalog is generated from the folders on disk, never from a hard-coded list; a new skill appears automatically.
- Descriptions are shortened for the table, not rewritten; argument hints are quoted from the frontmatter.
- No internal paths beyond the skill folder, no AI attribution.

## Error Handling

- Skill name not found: list the closest matches and stop.
- A `SKILL.md` without frontmatter: list the folder with "no description" and continue.

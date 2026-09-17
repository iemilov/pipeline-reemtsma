---
name: help
description: Display a quick-reference catalog of all available pipeline skills with usage examples
argument-hint: "[skill-name (optional)]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


## Configuration

Before executing, read `pipeline/customer.config.md` to determine the active customer's **Short Name**, **Platform**, **Agent Runtime**, and (optionally) **Review Runtime**. These are used to tailor the output (e.g., hide Salesforce-only skills for non-Salesforce customers, flag Claude-Code-only skills when running under a different runtime, show the active customer / runtime in the header, and surface the code-review runtime for `/implement-us`).

Also peek at `pipeline/agent-runtime.md` (symlink to the active runtime's best-practices doc) so the catalog header reflects the active runtime and any unsupported skills can be flagged with a fallback pointer.

## Workflow: Display Skill Catalog

Show a well-formatted skill catalog directly in the conversation. No external tools or APIs are needed — this skill reads SKILL.md frontmatter from disk and presents it to the user.

**Usage:**
- `/help` — Show full catalog of all available skills
- `/help <skill-name>` — Show detailed info for a specific skill

**Codex wrapper usage:** When the active Agent Runtime is `openai-codex`, Claude slash commands are invoked through the root-level wrapper created by `setup.sh`:

### Step 0: Parse Arguments

1. Check if `$ARGUMENTS` contains a skill name (e.g., `implement-us`, `commit`, `dispatch-us`)
2. If a skill name is provided → go to **Step 2** (single skill detail)
3. If no arguments → go to **Step 1** (full catalog)

### Step 1: Full Catalog

1. Read `pipeline/customer.config.md` and extract:
   - **Short Name** (to display active customer)
   - **Platform** (to tag platform-specific skills)
   - **Agent Runtime** (to flag skills with `runtime:` constraints; default to `claude-code` if missing)

2. List all skill directories under `pipeline/.claude/skills/` (pattern: `[0-9]*-*/SKILL.md`) — these are **pipeline skills**.

3. List all skill directories under `pipeline/customers/<active-customer>/skills/` if that folder exists — these are **customer skills** shipped by the active customer's config repo. They are merged into `.claude/skills/` by `setup.sh` and are available as slash commands alongside pipeline skills. A customer skill whose folder name matches a pipeline skill **overrides** the pipeline version (flag these with `(overridden)` in the catalog).

4. For each skill, read only the YAML frontmatter (between `---` markers) to extract:
   - `name` — the slash command name
   - `description` — one-line summary
   - `argument-hint` — usage arguments
   - `runtime` *(optional)* — if present, the skill only runs under that runtime (currently only `/dispatch-us` declares `runtime: claude-code`)
   - `preferred-runtime` *(optional)* — soft hint at which runtime the skill performs best under. Resolve against `customer.config.md > ## Skill Runtime Overrides` first; the customer override (if any) wins, otherwise the frontmatter value applies. See `pipeline/agent-runtime-access.md` §1a.

5. Present the catalog in the following format. Group skills by category. Mark Salesforce-only skills with a platform tag. If the active customer's platform is NOT `salesforce`, add a note that Salesforce-only skills are unavailable. If a skill declares `runtime: <name>` in frontmatter and that runtime does not match the active runtime, mark it as `(unavailable — runtime: <name>)` and point at the fallback at `pipeline/agent-runtimes/<active-runtime>/dispatch-fallback.md` (or the equivalent fallback doc for that skill). If a skill has a resolved `preferred-runtime` (after customer override) that differs from the active runtime, append `*(prefers: <preferred-runtime>)*` to its row — this is purely advisory and does not affect availability. Append a **Customer Skills** section listing skills from the customer repo.

**Output format:**

> The tables below are a formatting example frozen at authoring time. The emitted catalog MUST contain one row for **every** skill discovered in steps 2–3 above — append rows (or whole categories) for skills missing from this example rather than dropping them.

```
## Pipeline Skills — Quick Reference

**Active customer:** <Short Name> | **Platform:** <Platform> | **Agent Runtime:** <Agent Runtime>

Skills are slash commands in Claude Code (for example `/design-us AP2-1583`). Wrapper-resolved commands.

### Story Lifecycle
| Command | Description |
|---------|-------------|
| `/analyze <topic-slug> [--from-transcript <path>]` | Review requirements and codebase before stories; save a concept with evidence and story split |
| `/create-story [epic-id] [--concept <slug>]` | Create stories from transcripts or a reviewed concept; resume partial concept creation |
| `/design-us [story-key]` | Create implementation notes from Jira story + codebase analysis |
| `/implement-us [story-key]` | Generate first draft of implementation code |
| `/promote-us [story-key] [env]` | Promote story through INT/UAT/PROD environments |
| `/dispatch-us <epic-id\|keys> [--flags]` | Parallel implementation of multiple stories *(claude-code only)* |
| `/release-pr <version> [--statuses] [--target-branch] [--dry-run]` | Bundle all deploy-ready stories of a release into one PR, transition them on green validation |

### Documentation & Knowledge
| Command | Description |
|---------|-------------|
| `/08-document [key\|url] [--type <kind>] [--audience <role>] [--reason "text"] [--mirror\|--no-mirror] [--dry-run] [--force]` | One skill for four document types — epic documentation, business user manual, architecture overview, CRM documentation. Asks for type and audience, always writes versioned Markdown, publishes optionally |
| `/release-notes [version]` | Generate release notes from latest merge commit |
| `/code-review [space-key]` | Comprehensive code review → Confluence or Markdown |
| `/build-knowledge <epic-id\|topic>` | Build domain documentation from Jira + Confluence + code |
| `/process-transcript [folder]` | Execute Claude Tasks embedded in meeting transcripts, write results back |
| `/create-meeting-protocol <folder\|file>` | Verified meeting protocol from a transcript, with anti-hallucination pass |
| `/create-project [project-key]` | Scaffold a business project directory (INDEX, open points, subfolders) |
| `/verify-docs <project-key> [--fix] [--full]` | Consistency check across a business project's docs, auto-fix mechanical issues |

### Business Q&A
| Command | Description |
|---------|-------------|
| `/ask <question> [--band executive\|detail\|technical]` | Answer one question from the built knowledge base — grounded, cited, gap-honest |
| `/serve-chat [--port N]` | Start the localhost-only business chat web UI on the same answering engine |

### Development Tools
| Command | Description |
|---------|-------------|
| `/commit [message]` | Safe multi-repo commit with validation rules |
| `/review-pr <pr-id\|url> [--post-comment]` | Review a PR against coding conventions + platform best practices |
| `/process-pr-feedback <pr-id\|url> [--include-resolved]` | Per-remark remediation plan for a PR's review feedback |

### Test Data *(Salesforce only)*
| Command | Description |
|---------|-------------|
| `/create-testdata [org] [preset]` | Create test data records from config presets |
| `/cleanup-testdata [org] [preset\|all\|today]` | Delete test data records interactively |
| `/story-testdata <story-key> [org]` | Derive a story's test data needs and recommend presets |
| `/init-sandbox <org-alias> [--no-testdata] [--dry-run]` | Initialize a freshly refreshed sandbox for development and UI testing |

### Administration
| Command | Description |
|---------|-------------|
| `/onboard-pipeline-user <user> <repo>` | Add GitHub user as collaborator to pipeline repos |
| `/create-customer [name]` | Scaffold new customer config repo |

### Meta
| Command | Description |
|---------|-------------|
| `/help [skill-name]` | Show this catalog, or details for a specific skill |
| `/pipeline-stats [--customer] [--skill] [--days]` | Aggregate execution logs: success rates, trends, failure analysis |
| `/release-harness [patch\|minor\|major\|X.Y.Z] [--dry-run]` | Cut a versioned release of the pipeline product itself |
| `/improve-skills [--skill] [--days] [--apply]` | Mine logs + review reports for recurring failure modes, propose evidence-backed edits to the skills themselves |

### Deprecated — removed in 3.0.0
| Command | Use instead |
|---------|-------------|
| `/document-us [epic-id]` | `/08-document <epic-id> --type epic` |
| `/create-business-manual <epic-key\|url>` | `/08-document <epic-key> --type manual` |
| `/architecture-overview [space-key]` | `/08-document --type architecture` |
| `/write-crm-doc [story-key]` | `/08-document <story-key> --type knowledge` |

### Customer Skills — <Short Name>
*(Shown only if `pipeline/customers/<customer>/skills/` contains skills.)*
| Command | Description |
|---------|-------------|
| `/<name> <argument-hint>` | <description> *(overridden)* if it shadows a pipeline skill |

---
*Tip: Use `/help <skill-name>` for detailed usage and examples.
```

6. If the active platform is **not** `salesforce`, append a note below the "Test Data" section:
   > These skills are unavailable for your platform (`<Platform>`).

7. If the active runtime is **not** `claude-code`, append a note below the "Story Lifecycle" section:
   > `/dispatch-us` requires `Agent Runtime: claude-code`. Under `<active-runtime>`, follow the sequential fallback at `pipeline/agent-runtimes/<active-runtime>/dispatch-fallback.md`. All other skills run under any runtime — see `pipeline/agent-runtime-access.md` for transport mapping (MCP under Claude Code natively and under Gemini CLI when wired in `~/.gemini/settings.json`; `gh`/`curl` fallbacks under Codex and local).

7a. Always append a note below the "Story Lifecycle" section describing the code-review runtime for `/implement-us`. Resolve it with `pipeline/bin/review-runtime` (default = same-runtime; cross-runtime when `Review Runtime` is set):
   > `/implement-us` runs a built-in code review (Step 6) against coding conventions + platform best practices. Reviewer runtime: **<resolved reviewer>** (`<same-runtime | cross-runtime>`). Set `Review Runtime: complement` in `customer.config.md > ## Agent Runtime` for an independent cross-runtime review (Codex reviews Claude, Claude reviews Codex). See `pipeline/agent-runtime-access.md` §2a.

8. If the customer repo has no `skills/` directory or it is empty, omit the **Customer Skills** section entirely.

### Step 2: Single Skill Detail

When `$ARGUMENTS` matches a skill name:

1. Find the matching skill directory — search **both** `pipeline/.claude/skills/` and `pipeline/customers/<active-customer>/skills/`. If a customer skill shadows a pipeline skill by name, prefer the customer version (it is the one that actually runs) but note the shadowed pipeline version in the output.
2. If no match found, suggest the closest match and show the full catalog
3. If matched, read the full SKILL.md file
4. Present a summary with:
   - **Command:** `/<name> <argument-hint>`
   - **Description:** from frontmatter
   - **Platform:** `all` or `salesforce` (based on presence of platform guard in SKILL.md)
   - **Runtime:** `all` or the value of `runtime:` from frontmatter (e.g., `claude-code` for `/dispatch-us`). If the skill is gated to a runtime that doesn't match the active runtime, surface the fallback doc pointer here.
   - **Preferred runtime:** the resolved `preferred-runtime` after applying any `## Skill Runtime Overrides` row from `customer.config.md`. Format: `<runtime> (from customer override)` if a row exists, `<runtime> (from frontmatter)` otherwise, or omit the line entirely when the skill has no preference. If the resolved value differs from the active runtime, append ` — switch with ./setup.sh <customer> --runtime <preferred>`.
   - **Workflow steps:** Extract step headings (### Step N: ...) as a numbered list
   - **Code-review runtime** *(only for `/implement-us`, or any skill with a Step 6 review):* resolve via `pipeline/bin/review-runtime` and show the reviewer runtime plus whether it is same-runtime (default) or cross-runtime (when `Review Runtime` is configured). See `pipeline/agent-runtime-access.md` §2a.
   - **Example usage:** Construct a realistic example using the argument-hint

**Output format:**

```
## /`<name>` — <description>

**Usage:** `/<name> <argument-hint>`
**Platform:** <all | salesforce>
**Runtime:** <all | claude-code> *(if runtime-gated, append: — fallback at `pipeline/agent-runtimes/<active>/dispatch-fallback.md`)*
**Preferred runtime:** <runtime> (from <frontmatter | customer override>) *(omit line if no preference resolved)*

### Workflow
1. <Step 1 title>
2. <Step 2 title>
3. ...

### Example
`/<name> <realistic-example-args>`
```

### Step 3: Log Execution

- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill help --identifier help --status <success|partial|failed> \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-help-help.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).

> **Note:** Since this is a read-only informational skill, status will always be `success` unless the skill directory is unreadable.

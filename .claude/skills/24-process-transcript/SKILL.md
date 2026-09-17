---
name: process-transcript
description: Scan meeting transcripts for inline ## Claude Tasks blocks emitted by Speech2Text, load full customer/project context (customer.config.md, stack.config.md, customer.domain.md, coding-conventions.md, platform best-practices, atlassian-access.md, root CLAUDE.md), then execute each unchecked task in this Claude Code session with full tool access (CRM, Atlassian, Bash, file reads, etc.) and write the results back into the same .md so the supporting info is already there when the user opens the file to draft a concept
argument-hint: "[folder (optional, defaults to active customer's Meetings Folder from config.md)]"
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint:** This skill prefers `claude-code` (NLP over meeting transcripts). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Purpose

Speech2Text records meetings and emits a `## Claude Tasks` block at the bottom of each transcript when the user spoke a configured safeword. This skill is the post-hoc executor: it loads the active customer/project context, resolves the meetings folder from the active customer's `config.md`, scans for unchecked tasks, runs each one with full tool access (CRM MCP, Atlassian, file reads, web), writes the result back into the same `.md` under a `## Claude Results` section, and ticks the checkbox.

Two safety properties:

- **Idempotent** — re-running the skill never re-processes a `[x]` task. The user can manually flip `[x]` → `[ ]` to force a re-run.
- **Scope-bounded** — modifies *only* files inside the chosen folder, and *only* within the `## Claude Tasks` and `## Claude Results` sections. Never touches the `## Transcript` body or renames files.

## Configuration

The folder to scan is resolved from the **active customer's `config.md`** — there is **no separate allow-list file**, no Speech2Text config lookup, and no auto-discovery from any user-level config. Each customer's meetings folder is declared once, in their config, alongside the rest of their configuration. This makes `customer.config.md` the single source of truth and means switching customers (via `setup.sh`) automatically switches which folder this skill scans.

### Required field in each customer's `config.md`

Under the `## Folder Paths` section, every customer must declare:

```markdown
| Meetings Folder | `<absolute path where Speech2Text saves meeting transcripts>` |
```

**Convention:** the path lives under the customer's main project folder, typically `/Users/<you>/Projects/<short-name>/meetings/`. Example: `/Users/<you>/Projects/Acme/meetings`. The exact folder name is the user's choice — what matters is that the path is absolute and points at where Speech2Text saves transcripts for that customer.

The path **must be absolute** (start with `/`). Relative paths are rejected. The folder is auto-created by the skill in Step 0 if it doesn't exist yet — no manual `mkdir` needed.

### Optional user-level preferences (`~/.claude/process-transcripts.json`)

This file holds **user-level execution preferences** only. It is NOT an allow-list and contains no folder list. Schema:

```json
{
  "max_age_days": 7,
  "result_max_chars": 4000,
  "first_run_confirmed": false
}
```

| Key | Purpose | Default if missing |
|---|---|---|
| `max_age_days` | Only consider `.md` files modified within this window. | `7` |
| `result_max_chars` | Per-result truncation threshold (≈4 KB). Truncated results get a footer noting the omitted byte count. | `4000` |
| `first_run_confirmed` | Set to `true` after the first interactive confirmation. Scheduled / non-interactive runs require this to be `true`. | `false` |

If the file is missing, all defaults apply silently. If it has a legacy `folders` key from earlier versions, ignore it and warn once that the field is deprecated and may be removed.

## Workflow

### Step 0: Resolve the target folder

1. If `$ARGUMENTS` is non-empty and looks like an absolute path → that's the **target folder** (must start with `/`; relative paths are rejected with a clear message).
2. Else read `pipeline/customer.config.md` (which is a symlink to the active customer's config) and parse the `## Folder Paths` table. Find the `Meetings Folder` row. The cell value is the **target folder**.
3. If `Meetings Folder` is missing or contains a placeholder (e.g. starts with `<absolute path` or contains `<customer>`), exit with:
   > Active customer's `config.md` does not declare a valid `Meetings Folder` under `## Folder Paths`. Add a row like
   > `| Meetings Folder | \`/absolute/path/to/meetings\` |`
   > and re-run.
4. **Create the folder if it does not exist.** Use `mkdir -p <target>`. This is intentional: a fresh customer should be able to start using the skill without manual filesystem prep. If creation fails (permission denied, parent missing), exit with the OS error message verbatim.

### Step 1: User-prefs + first-run gate

1. Read `~/.claude/process-transcripts.json` if present; otherwise apply the defaults from §Configuration. If a legacy `folders` key is present, log a one-line deprecation warning and ignore it.
2. If `first_run_confirmed` is `false` AND the run is non-interactive (e.g. invoked from `/schedule` or `/loop`), print a one-line message asking the user to run the skill interactively first, then exit.
3. If `first_run_confirmed` is `false` AND the run is interactive, ask the user: "First run — confirm sending tasks from `<target>` to Claude? (yes/no)". On `yes`, set `first_run_confirmed: true` in the JSON file (creating it with default values if missing) and continue. On `no`, exit.

### Step 2: Load project context

This step mirrors the `/03-implement-us` pattern — load all customer/project config files into context BEFORE executing any task. This ensures each task is answered as if the user had typed the prompt directly into a fully-warmed Claude Code session, not in a vacuum.

Read the following files (all are pipeline-relative — assume the skill runs from a project that has `pipeline/` as a nested repository). Cache the contents for use during task execution.

**Customer-specific (always read):**
- `pipeline/customer.config.md` — customer identity, **Platform**, Atlassian deployment type, CI/CD settings, **Meetings Folder** (already used in Step 0)
- `pipeline/stack.config.md` — tech stack: commands (build/lint/test), libraries, naming conventions, API versions, paths
- `pipeline/customer.domain.md` — domain logic, glossary, field-name pitfalls
- `pipeline/coding-conventions.md` — customer-specific coding standards

**Platform-specific (read based on `Platform` field from `customer.config.md`):**
- `pipeline/platforms/<Platform>/best-practices.md` — universal platform rules

**Cross-cutting (always read):**
- `pipeline/atlassian-access.md` — the Atlassian adapter (transport branching, operation map). Required for any Jira/Confluence work in tasks.
- `pipeline/CLAUDE.md` — pipeline-level guidance and global rules (no AI attribution, no pipeline references in customer-visible outputs, etc.)

**Project root (read if present):**
- `CLAUDE.md` at the parent project root — project-specific overrides and conventions
- `README.md` at the parent project root — high-level project context

If any of the pipeline files are missing (e.g. the skill was invoked outside a customer-aware project), log a warning and continue with whatever context is available — the skill should remain useful in that mode, just less informed.

The loaded context informs **how** each task is executed in Step 5 (e.g. a "list customers" task uses CRM MCP because `customer.config.md` says Platform=node-cloudflare and the CRM MCP tools are available; an "implement X" task uses the stack-appropriate commands from `stack.config.md`; a "create a Jira ticket" task uses the Atlassian adapter's transport from `customer.config.md`).

> **Why this matters.** Without this step, a task like *"add a kanban card for the new feature we discussed"* would have no idea which CRM is in scope, which tools to call, or which conventions to follow. With context loaded, the agent treats the prompt the same way `/implement-us` would — fully grounded in the active customer's setup.

### Step 3: Find candidate files

In the target folder, find every `*.md` file modified within the last `max_age_days` days that contains the literal string `## Claude Tasks`. Use Bash:

```bash
find <target-folder> -maxdepth 2 -name "*.md" -mtime -<max_age_days> -print0 \
  | xargs -0 grep -l "^## Claude Tasks$" 2>/dev/null
```

Or read via Glob + Grep tools. Either is fine — keep it fast. If the folder is empty (was just created in Step 0 or has no transcripts yet), print a friendly "no transcripts to process" line and skip to Step 8.

### Step 4: Parse unchecked tasks

For each candidate file, parse all bullets matching this exact regex:

```
^- \[ \] \*\*#(\d+)\*\* `\[([0-9:]+)\]` (.+)$
```

The three captures are: task ID, meeting-relative timestamp, prompt. **Skip `[x]` lines entirely** — those are already done.

Collect tasks across all files into a flat list of `(filepath, task_id, timestamp, prompt)`.

### Step 5: Execute each task — using the loaded context

For each task, in order:

1. **Treat the prompt as if the user typed it directly into a Claude Code session that already has the Step 2 context loaded.** Use whatever tools fit the prompt:
   - Lookups in customer-internal systems → only via MCP servers the active customer registers in its config; if none is registered, answer from the repository and Jira/Confluence and say so
   - Jira / Confluence → the Atlassian adapter (resolve transport from the cached `customer.config.md`; consult the cached `atlassian-access.md` for the operation map)
   - Code / repo questions → `Read`, `Grep`, `Bash` git commands; honor `coding-conventions.md` and `platforms/<Platform>/best-practices.md`
   - Implementation-style prompts ("implement X", "add Y feature") → use commands and library conventions from the cached `stack.config.md`
   - General research → `WebSearch`, `WebFetch`
   - File system on the local machine → `Read`, `Bash`
2. **Prefer pipeline / MCP tools over generic web search** when the prompt obviously matches a tool's domain (e.g. "list our customers" → CRM, not web).
3. **Honor global rules** from `pipeline/CLAUDE.md`: no AI attribution in any output written to the transcript; no pipeline references / skill slash-command names in result bodies (the result is a customer-visible artifact — keep language neutral).
4. **Track wall-clock duration** of each task for the result footer.
5. **Catch any exception** — a single failing task must never block the rest of the run. On failure, capture the exception message for the result block and move on.
6. **Do NOT prompt the user** during execution. If a prompt is too vague to act on, write your clarifying question into the result block (so the user sees it next time they open the file) and mark the task as failed-needs-clarification.

### Step 6: Write back to the transcript

For each completed (or failed) task, modify the transcript file as follows:

1. **Tick the checkbox.** Replace the matching `- [ ] **#N** \`[hh:mm:ss]\` ...` line with `- [x] **#N** ...` (preserve the rest of the bullet exactly).
2. **Ensure a `## Claude Results` section exists** at the end of the file. If absent, append:

   ```
   
   ---
   
   ## Claude Results
   
   ```

   (blank lines as shown). If a `## Claude Results` block already exists, append to it.

3. **Append a result subsection.** Format per the contract:

   **Success:**
   ```markdown
   ### #<N> — <prompt>
   _Processed: <YYYY-MM-DD HH:MM:SS> · <duration>s_

   <result body>
   ```

   **Truncated success** (when `len(result_body) > result_max_chars`):
   ```markdown
   ### #<N> — <prompt>
   _Processed: <YYYY-MM-DD HH:MM:SS> · <duration>s_

   <truncated result body>

   _…truncated, <N> chars omitted — raise `result_max_chars` in `~/.claude/process-transcripts.json` for full output._
   ```

   **Failure:**
   ```markdown
   ### #<N> — <prompt> ❌
   _Processed: <YYYY-MM-DD HH:MM:SS> · failed_

   _Error: <one-line message>_

   _To retry: change `[x]` back to `[ ]` and re-run `/process-transcript`._
   ```

4. **Use the `Edit` tool** for the checkbox flip (exact-string replacement keeps it surgical). Use `Read` + `Write` (or append-mode `Bash`) for the result-section append.

### Step 7: Scope guard — what NOT to do

- Do **not** modify or rewrite any line in the `## Transcript` section of any file.
- Do **not** rename, move, or delete transcript files.
- Do **not** create new `.md` files.
- Do **not** modify files outside the target folder (the one resolved in Step 0).
- Do **not** scan or modify other customers' meetings folders. Only the active customer's folder (or the explicit `$ARGUMENTS` path) is in scope.
- Do **not** strip or alter the `## Meeting Details`, `## Meeting Summary`, or `## Claude Tasks` headers / structure.
- Do **not** re-execute `[x]` tasks — even if the user-visible result block is missing, the checkbox state is the source of truth.
- Do **not** include AI attribution or pipeline / skill references in result bodies — transcripts are customer-visible meeting notes.

### Step 8: Final summary

Print a single concise line:

> Processed N new tasks across M files in `<target-folder>`; X succeeded, Y failed.

Plus a list of the files that were touched, each with a count of new tasks. If the folder was empty: `No transcripts to process in <target-folder>.`

### Step 9: Logging

- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill process-transcript --identifier run-<HHMM> --status <success|partial|failed> \
    --preferred-runtime claude-code \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-run-<HHMM>-process-transcript.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed).

If `pipeline/customer.config.md` cannot be resolved (skill invoked outside a customer-aware project), skip the log and continue — the skill is still useful in that mode.

## Format contract (read-only reference)

This is the section format Speech2Text emits. Both halves of the contract live here so future changes stay consistent.

```markdown
## Claude Tasks

- [ ] **#1** `[12:34]` <prompt>
- [x] **#2** `[15:02]` <prompt>

---

## Claude Results

### #2 — <prompt>
_Processed: 2026-05-03 14:32:08 · 8s_

<result body>

### #3 — <prompt> ❌
_Processed: 2026-05-03 14:32:16 · failed_

_Error: <message>_
```

Rules:
- `## Claude Tasks` is appended by Speech2Text. It only ever writes `- [ ]` lines.
- `## Claude Results` is appended by this skill. Speech2Text never writes here.
- Section ordering at the bottom of the file: `## Meeting Summary` → `## Claude Tasks` → `## Claude Results`.
- A merged transcript (resumed recording) may contain *multiple* `## Claude Tasks` blocks — process all `- [ ]` bullets globally, regardless of which block they live in.

## Triggers

- **Manual without arg:** `/process-transcript` — scans the active customer's `Meetings Folder` from `config.md`. Switch customers (`cd pipeline && ./setup.sh <name>`) to switch which folder is scanned.
- **Manual with arg:** `/process-transcript /absolute/path/to/folder` — scans that folder, regardless of which customer is active. Useful for one-off scans.
- **Scheduled:** invoke via `/schedule` or `/loop` (e.g. `/loop 15m /process-transcript` for the duration of a meeting day). Scheduled runs require `first_run_confirmed: true` in `~/.claude/process-transcripts.json` — otherwise the skill exits with a "run interactively first" message.

## Privacy note

Speech2Text remains fully local — it never sends audio or text anywhere. **This skill** runs in a normal Claude Code session, so meeting content (the task prompts and any context the agent reads to answer them) goes to Anthropic at the moment of execution. This is identical to any other Claude Code use; the `first_run_confirmed` gate exists to make that boundary explicit.

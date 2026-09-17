---
name: process-transcript
description: Scan meeting transcripts in the customer's meetings folder for inline `## Claude Tasks` blocks, load the customer and project context, execute every unchecked task with the repository, the Atlassian tools and the MCP servers registered for this customer, and write the results next to the transcript so the supporting information is ready when the user drafts a concept
argument-hint: "[folder (optional, defaults to the Meetings Folder from customer.config.md)] [--max-age-days N]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

A transcription tool records meetings and appends a `## Claude Tasks` block to the transcript when the user speaks a configured safeword. This skill is the executor: it loads the active customer's context, scans the meetings folder for unchecked tasks, runs each task with the tools available in this session, writes the results into a results file next to the transcript, and ticks the task's checkbox in the transcript.

Two safety properties:

- **Idempotent** — a `[x]` task is never re-processed. Flip `[x]` back to `[ ]` to force a re-run.
- **Scope-bounded** — the skill writes only the `## Claude Tasks` checkboxes inside the transcript and the `<name>-results.md` file next to it. It never touches the transcript body, never renames or deletes files, and never leaves the resolved folder.

## Configuration

Read `pipeline/customer.config.md`: `Short Name`, `Documentation Language`, `Platform`, `Cloud ID`, `Project Key`, and `## Folder Paths > Meetings Folder`. The folder is relative to the main repository root (e.g. `meetings/`) or absolute. `<customer>` is the symlink target of `pipeline/customer.config.md`.

Registered MCP servers: only the Atlassian tools are registered for this customer today. A task that needs another system is answered from the repository and Jira/Confluence, and the result says which system was not available. Never assume a CRM, ticketing or time-tracking MCP exists.

State file: `.claude/skills/24-process-transcript/state.json`

```json
{ "first_run_confirmed": false, "max_age_days": 7, "result_max_chars": 4000, "runs": [] }
```

| Key | Purpose | Default |
|---|---|---|
| `first_run_confirmed` | set to `true` after the first interactive confirmation; non-interactive runs require it | `false` |
| `max_age_days` | only transcripts modified within this window are scanned; `--max-age-days` overrides per run | `7` |
| `result_max_chars` | per-result truncation; longer results get a footer with the omitted count | `4000` |
| `runs` | last 20 runs: date, folder, tasks processed, succeeded, failed | `[]` |

Create the file with defaults when missing.

## Workflow

### Step 0: Resolve the target folder

1. `$ARGUMENTS` starts with `/` or is an existing relative folder → target folder.
2. Otherwise `Meetings Folder` from config. If the row is missing or a placeholder, stop with: *"customer.config.md declares no valid Meetings Folder under Folder Paths. Add `| Meetings Folder | meetings/ |` and re-run."*
3. Create the folder if it does not exist (`mkdir -p`).

### Step 1: First-run gate

1. Read the state file (create with defaults if missing).
2. `first_run_confirmed` false and the run is non-interactive (loop or scheduled invocation): print *"Run `/process-transcript` interactively once to confirm the target folder"* and stop.
3. `first_run_confirmed` false and interactive: ask with `AskUserQuestion` — *"First run: process Claude Tasks from `<folder>` in this session?"* — on yes, set the flag and continue; on no, stop.

### Step 2: Load project context

Read, and keep for task execution:

- `pipeline/customer.config.md`, `pipeline/stack.config.md`, `pipeline/customer.domain.md`
- `pipeline/coding-conventions.md` and `pipeline/platforms/<Platform>/best-practices.md` — only if they contain rules
- `pipeline/CLAUDE.md` for the global rules (no AI attribution, no pipeline references in customer-visible output)
- the main repository's `README.md` if present
- `pipeline/customers/<customer>/docs/INDEX.md` and the topic documents whose titles match a task's keywords

Missing pipeline files are logged as a warning; the skill continues with what it has.

### Step 3: Find candidate transcripts

```bash
find <folder> -maxdepth 2 -name "*.md" ! -name "*-results.md" -mtime -<max_age_days> -print0 | xargs -0 grep -l "^## Claude Tasks" 2>/dev/null
```

No candidates: print *"No transcripts with open tasks in `<folder>`."* and continue with Step 8.

### Step 4: Parse unchecked tasks

Match every line against:

```
^- \[ \] \*\*#(\d+)\*\* `\[([0-9:]+)\]` (.+)$
```

Captures: task id, meeting-relative timestamp, prompt. Skip `[x]` lines. A transcript may contain several `## Claude Tasks` blocks (resumed recordings); collect all open tasks across all blocks into one list of `(file, id, timestamp, prompt)`.

### Step 5: Execute each task

For each task, in order:

1. Treat the prompt as if the user had typed it in this session with the Step 2 context loaded. Choose tools by the prompt:
   - Jira or Confluence → Atlassian MCP tools with the Cloud ID from config (read operations freely; **create, edit or transition only when the prompt explicitly asks for it**, and record the issue key or page URL in the result)
   - code and configuration questions → `Read`, `Grep`, git commands; naming and conventions from `stack.config.md`
   - org data questions (`Platform` salesforce) → read-only `sf data query` against the alias named in the prompt or the DEV alias from `stack.config.md`; never DML
   - research → `WebSearch`, `WebFetch`
   - anything requiring a system without a registered MCP server → answer from what is available and state the limitation
2. Never prompt the user during execution. A prompt too vague to act on gets the clarifying question written into its result and is marked *needs clarification*.
3. Track the duration of each task.
4. Catch every error; one failing task never stops the run.
5. Global rules apply to the results: no AI attribution, no pipeline paths or skill names — the results file may end up in front of the customer.

### Step 6: Write the results

Results go into `<transcript-name>-results.md` next to the transcript (created on first use, appended afterwards):

```markdown
# Claude Results — <transcript file name>

### #<N> — <prompt>
_Processed: <YYYY-MM-DD HH:MM:SS> · <duration>s_

<result body>
```

Truncated result: body cut at `result_max_chars` plus the footer `_…truncated, <N> characters omitted — raise result_max_chars in the state file for full output._`

Failure:

```markdown
### #<N> — <prompt> ❌
_Processed: <YYYY-MM-DD HH:MM:SS> · failed_

_Error: <one-line message>_

_To retry: change `[x]` back to `[ ]` in the transcript and re-run._
```

Then tick the checkbox in the transcript with the `Edit` tool, replacing exactly `- [ ] **#N**` with `- [x] **#N**` on that line and nothing else. Task ids are unique per transcript; if the same id appears twice, process both and note it.

### Step 7: Scope guard

- Never modify the `## Transcript`, `## Meeting Details` or `## Meeting Summary` sections, or any line other than the ticked checkbox.
- Never rename, move or delete transcripts; never create files other than `<name>-results.md`.
- Never write outside the resolved folder.
- Never re-execute `[x]` tasks; the checkbox is the source of truth.
- Never post to Jira or Confluence unless the task asks for it.

### Step 8: Summary and log

Print one line: *Processed N tasks across M transcripts in `<folder>`; X succeeded, Y failed, Z need clarification.* followed by the touched files with counts.

Append a run entry to the state file (keep the last 20). Create `<YYYY-MM-DD>-<customer-short-name>-run-<HHMM>-process-transcript.json` in `.claude/skills/24-process-transcript/logs/` per the CLAUDE.md JSON schema; `artifacts` lists every results file written and every transcript ticked. Skip the log only when no customer config could be resolved.

## Format contract

```markdown
## Claude Tasks

- [ ] **#1** `[12:34]` <prompt>
- [x] **#2** `[15:02]` <prompt>
```

`## Claude Tasks` is written by the transcription tool with `- [ ]` lines only; this skill only flips the checkbox. Results live in `<name>-results.md`. Section order at the bottom of a transcript: `## Meeting Summary` → `## Claude Tasks`.

## Triggers

- `/process-transcript` — scans the active customer's Meetings Folder.
- `/process-transcript <folder>` — scans that folder.
- `/loop 15m /process-transcript` — repeated during a meeting day; requires `first_run_confirmed: true`.

## Privacy note

The transcription tool stays local. This skill runs in a normal Claude Code session, so the task prompts and whatever context is read to answer them are processed by the model at execution time — the same boundary as any other use of this session. The first-run confirmation makes that explicit.

## Error Handling

- Meetings Folder missing or a placeholder: stop with the config instruction.
- State file unreadable: recreate with defaults and say so.
- Transcript not writable: write the results file, leave the checkbox open, report the file.
- Atlassian tools unavailable: tasks needing them fail individually with the error; the rest continue.
- Duplicate task ids within a transcript: process both, note the duplicate in both results.

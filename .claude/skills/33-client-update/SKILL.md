---
name: client-update
description: Use when something has to be communicated to the customer — an incident explanation, a correction of previously communicated figures, a summary of an analysis, a project status one-pager, a meeting agenda. Produces factual, calm, outward-facing text with numbers, cause, impact and next steps, in the customer's language and format, without internal detail or self-flagellation
argument-hint: <type: incident|correction|summary|status|agenda|reply> "<topic or source>" [--audience business|management|technical] [--format text|html|md] [--lang <code>] [--tone formal|neutral]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

Outward-facing text has one standard regardless of occasion: factual, complete on what matters, calm in tone, explicit about what is known and what is not, and clear about what happens next. This skill produces that text from an analysis, a chat, a ticket or a set of files, in the customer's language and the format they will actually read.

## When to Use / When NOT to Use

- Use for: incident explanations, corrections of earlier statements or figures, summaries of an investigation or a decision, project status one-pagers, meeting agendas, replies to a customer question.
- Do NOT use for internal notes, implementation notes or documentation — `/design-us`, `/document`.
- Do NOT use to write the analysis itself — `/investigate-data-issue`, `/decision-paper`; this skill writes it *up*.

## Configuration

Read `pipeline/customer.config.md` (Short Name, documentation language, UI language, customer contacts/roles if listed, date and number locale), `pipeline/customer.domain.md` (business terminology — the customer's words for objects and processes), and any style or template the customer folder provides (`pipeline/customers/<customer>/communication.md`, if present: salutation, sign-off, sender name, banned phrases).

Inputs: the type, the topic or source (a finding file, a decision paper, a ticket key, "the chat", a previous message to correct), `--audience` (default `business`), `--format` (default: `text` for incident/correction/reply, `html` for status, `md` for agenda/summary), `--lang` (default documentation language), `--tone` (default from the customer style file, else `neutral`).

## Text standards

| Standard | Meaning |
|---|---|
| **Lead with the outcome** | First sentence: what is the case now. Cause, history and detail follow. |
| **Numbers are exact and sourced** | Every figure in the text is one the source verified; if a figure is preliminary, say *preliminary*. Never round a verified number into a vaguer one to sound safer. |
| **Corrections are explicit** | Old figure, new figure, reason, in one sentence — then move on. No apology cascade. |
| **Cause without blame** | Name the process and the moment, not a person. "The deployment on 3 September of flow version 22 set …", not "someone forgot". |
| **Known / not known / next** | Three visible parts: what is confirmed, what could not be determined (and why), what happens next with owner and date. |
| **No internal detail** | No file paths, class names, skill names, pipeline references, ticket numbers unless the customer uses them, no excerpts of internal discussion. |
| **No self-flagellation, no over-reassurance** | State the error and the fix. No "deeply regret", no "this will never happen again". |
| **Customer terminology** | The customer's words from the domain file; technical terms only for a technical audience, and then defined once. |
| **One page** | Status and agenda: one page. Incident and correction: under 300 words unless the customer asked for a full report. |

## Workflow

### Step 1: Collect the facts

Read the source completely. Extract: the outcome, the verified figures (with where each comes from), the cause, the affected scope, what was already done, what is open, the next steps with owners and dates. If a fact the text needs is missing from the source, ask for it or mark it as an open point — do not fill it in.

For `correction`: read the earlier message that is being corrected and list every figure or statement that changes.

### Step 2: Draft by type

- **incident** — Outcome · what happened (cause, moment, scope with numbers) · impact for the customer's users or customers · what was done · what is not yet known · next steps.
- **correction** — What was communicated · what is correct now · why the earlier figure was wrong (one sentence, process-level) · consequences of the correction · next steps.
- **summary** — Question that was asked · answer in two sentences · the evidence in three to five bullets · what remains open · recommendation.
- **status** — One-pager table: workstream / status (traffic light or Done / In progress / Blocked / Delivered) / this period / next period / decisions needed. No narrative beyond one line per row.
- **agenda** — Purpose, participants, timeboxed items with the decision or outcome each item should produce, pre-reads.
- **reply** — Answer the question in the first sentence, evidence after, next step last.

### Step 3: Check against the standards

Run the text standards table as a checklist. Specifically verify: every number appears in the source, no internal names, corrections contain old and new figure, next steps have owners and dates or are marked "date to be agreed", the length limit holds.

### Step 4: Deliver

Write to `communication/<YYYY-MM-DD>-<type>-<slug>.<ext>` (create the folder if missing) and show the text in the chat. For `html`, use a single self-contained file with print CSS (A4, no clipped tables). Do not send anything; sending is the user's action.

Create `<YYYY-MM-DD>-<customer-short-name>-<type>-<slug>-client-update.json` in `.claude/skills/33-client-update/logs/` per the CLAUDE.md schema.

## Important Rules

- **Only verified facts from the source.** Nothing invented, nothing softened, nothing sharpened.
- **Corrections name old and new figure.**
- **No internal artefacts, names or paths in the text.** The customer sees the outcome, not the workshop.
- **Do not promise dates or outcomes the source does not contain.** Mark them as to be agreed.
- **The user sends.** The skill writes and stores; it never mails or posts to the customer.
- Language, terminology, salutation and format from config and the customer style file. No AI attribution.

## Error Handling

- **Source contains conflicting figures:** stop and ask which is verified; do not pick one.
- **No source for a required part (e.g. next steps):** mark the part as open in the text and say so in the chat.
- **Customer style file missing:** use neutral tone, documentation language, no salutation; say that a style file would remove this guesswork.

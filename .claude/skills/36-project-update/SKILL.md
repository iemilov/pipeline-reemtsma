---
name: project-update
description: Use when a project status one-pager for a customer meeting is needed — asks for the meeting date and the list of items (story key, title, current status, open questions for the meeting), optionally prefilled from the previous update and from Jira, and writes a self-contained HTML one-pager into the meetings folder in the established layout
argument-hint: [date YYYY-MM-DD] [--from-previous] [--jql "<JQL>"] [--lang <code>]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

One HTML page per customer status meeting: a table of items with key, title, status tags, and — under each item — the open questions to raise in the meeting. Same layout every time, so the customer recognises it and the page prints on one sheet. The skill collects the content interactively; it does not invent statuses.

## Configuration

Read `pipeline/customer.config.md` (Short Name and Full Name for the eyebrow line, Documentation Language, **Meetings Folder** from Folder Paths — default `meetings/`, Atlassian Cloud ID and Project Key), `pipeline/customer.domain.md` (business names for brands and processes used in titles).

Inputs from `$ARGUMENTS`: an optional date (`YYYY-MM-DD`; if absent it is asked), `--from-previous` (prefill the item list from the newest `project_update_*.html` in the meetings folder), `--jql "<JQL>"` (prefill from Jira via `searchJiraIssuesUsingJql`), `--lang` (default: Documentation Language).

Output: `<Meetings Folder>/project_update_<YYYY-MM-DD>.html`. If the file exists, ask whether to overwrite or to write `project_update_<YYYY-MM-DD>-2.html`.

## Workflow

### Step 1: Meeting date

If no date was given, ask with `AskUserQuestion`: today's date as the first option, the next weekday and "other" as alternatives. The date appears in the page title, the subtitle and the footer, formatted long in the page language (e.g. `10 September 2026`).

### Step 2: Collect the items

Build the item list in this order, then let the user complete it:

1. **Prefill** — with `--from-previous`, parse the newest previous update: every table row becomes an item with key, title, and status; open questions from the previous page are carried over marked *(from last meeting)* so the user can keep, edit or drop them. With `--jql`, add every issue as key + summary + a status proposal derived from the Jira status. Without either flag, start empty.
2. **Show the current list** as a numbered plain-text table (key · title · status · open questions count) and ask, in batches of at most four questions per `AskUserQuestion` call:
   - which prefilled items to keep, drop, or re-order;
   - for each item to add: **story key** (or a label such as `Site` for non-ticket items), **title**, **current status** — offer the fixed status vocabulary below as options plus free text — and **open questions for the meeting** (free text, one per line; may be empty);
   - for each kept item: whether its status changed and whether open questions were resolved or new ones came up.
3. Repeat "add another item?" until the user says no. Never fill a status yourself; if the user gives none, ask again rather than defaulting.
4. If a key matches the Jira project key pattern and Jira is reachable, fetch the summary once to check the title; show a mismatch, do not overwrite silently.

**Status vocabulary and tag colour** (the user may add free-text statuses; map them by keyword, else ask which colour):

| Status text | Tag class | Colour |
|---|---|---|
| Done, Delivered, Deployed, Specified, Closed | `t-done` | green |
| In progress, In development, Tested on UAT, In review, Planned | `t-prog` | amber |
| Pending decision, Blocked, Stakeholder alignment pending, On hold, Open | `t-open` | red |

An item may carry two tags (e.g. `Specified` + `Pending decision`); ask for a second status only when the user mentions one.

### Step 3: Confirm

Print the final list once more as plain text — key, title, tags, open questions — and ask for confirmation before writing. Corrections loop back to Step 2.

### Step 4: Render

Write the file with exactly this structure. Escape `&`, `<`, `>` in all user text; render `–` as `&ndash;` and `·` as `&middot;` in titles. One `<tr>` per item; the open-questions block is omitted when the item has none.

```html
<!doctype html>
<html lang="{{lang}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project Update &middot; {{date_long}}</title>
<style>
:root {
  --ground: #f2f4f4; --panel: #ffffff; --ink: #12191b; --ink-soft: #4c5b5f;
  --ink-faint: #7b8a8e; --rule: #d9e0e0; --rule-soft: #e8eded;
  --accent: #0d6a60; --accent-soft: #e2efec;
  --warn: #8c5410; --warn-soft: #f6ecdd;
  --stop: #9c3327; --stop-soft: #f8e7e4;
  --f-body: -apple-system, "Segoe UI", "Source Sans 3", sans-serif;
  --f-mono: ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0d1315; --panel: #141d1f; --ink: #e6ecec; --ink-soft: #a3b2b4;
    --ink-faint: #75868a; --rule: #263234; --rule-soft: #1d2729;
    --accent: #5cbcaf; --accent-soft: #12302d;
    --warn: #d8a462; --warn-soft: #2e2313;
    --stop: #e08278; --stop-soft: #331c19;
  }
}
:root[data-theme="dark"] {
  --ground: #0d1315; --panel: #141d1f; --ink: #e6ecec; --ink-soft: #a3b2b4;
  --ink-faint: #75868a; --rule: #263234; --rule-soft: #1d2729;
  --accent: #5cbcaf; --accent-soft: #12302d;
  --warn: #d8a462; --warn-soft: #2e2313;
  --stop: #e08278; --stop-soft: #331c19;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--f-body); font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 780px; margin: 0 auto; padding: 44px 24px 48px; }
.eyebrow { font-family: var(--f-mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); margin: 0 0 8px; }
h1 { font-size: 28px; margin: 0 0 10px; letter-spacing: -0.01em; }
.date { font-size: 15px; color: var(--ink-soft); margin: 0 0 30px; }
.tablewrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 15px; }
th { text-align: left; font-family: var(--f-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); border-bottom: 2px solid var(--ink); padding: 0 14px 8px 0; white-space: nowrap; }
td { border-bottom: 1px solid var(--rule-soft); padding: 13px 14px 13px 0; vertical-align: top; }
th:last-child, td:last-child { padding-right: 0; }
.key { font-family: var(--f-mono); font-size: 13.5px; white-space: nowrap; color: var(--ink-soft); }
.title { font-weight: 600; }
.tag { display: inline-block; font-family: var(--f-mono); font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; padding: 3px 8px; border: 1px solid currentColor; white-space: nowrap; margin: 1px 0; }
.t-done { color: var(--accent); background: var(--accent-soft); }
.t-prog { color: var(--warn); background: var(--warn-soft); }
.t-open { color: var(--stop); background: var(--stop-soft); }
.url { display: inline-block; font-family: var(--f-mono); font-size: 12px; font-weight: 400; color: var(--accent); word-break: break-all; margin-top: 3px; }
.sub { display: block; font-weight: 400; font-size: 13px; color: var(--ink-soft); margin-top: 4px; }
.questions { margin: 8px 0 0; padding: 8px 12px; border-left: 2px solid var(--stop); background: var(--stop-soft); font-weight: 400; font-size: 13.5px; }
.questions .q-label { display: block; font-family: var(--f-mono); font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--stop); margin-bottom: 4px; }
.questions ul { margin: 0; padding-left: 18px; }
.questions li { margin: 2px 0; }
footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid var(--rule); font-family: var(--f-mono); font-size: 11px; color: var(--ink-faint); }
@media (max-width: 620px) { .key { white-space: normal; } }
@media print { body { background: #fff; } .wrap { padding: 0; max-width: none; } .questions { background: #fff; } }
</style>
</head>
<body>
<div class="wrap">

<p class="eyebrow">{{customer_full_name}}</p>
<h1>Project Update</h1>
<p class="date">{{date_long}}</p>

<div class="tablewrap">
<table>
  <thead>
    <tr><th>{{col_item}}</th><th>{{col_title}}</th><th>{{col_status}}</th></tr>
  </thead>
  <tbody>
    {{#EACH item}}
    <tr>
      <td class="key">{{item.key}}</td>
      <td class="title">{{item.title}}{{#IF item.url}}<br><a class="url" href="{{item.url}}">{{item.url_label}}</a>{{/IF}}{{#IF item.note}}<span class="sub">{{item.note}}</span>{{/IF}}{{#IF item.questions}}
        <div class="questions"><span class="q-label">{{label_open_questions}}</span><ul>{{#EACH item.questions}}<li>{{question}}</li>{{/EACH}}</ul></div>{{/IF}}</td>
      <td>{{#EACH item.tags}}<span class="tag {{tag.class}}">{{tag.text}}</span> {{/EACH}}</td>
    </tr>
    {{/EACH}}
  </tbody>
</table>
</div>

<footer>{{date_long}}</footer>

</div>
</body>
</html>
```

Column labels and the open-questions label follow the page language (`Item / Title / Status`, `Open questions for the meeting`; German: `Thema / Titel / Status`, `Offene Fragen für das Meeting`). Items with a URL (e.g. a delivered site) render it as the `.url` line; a one-line remark renders as `.sub`.

### Step 5: Deliver and log

Show the path and a plain-text summary of the page (items with tags, number of open questions). Do not open or send the file.

Create `<YYYY-MM-DD>-<customer-short-name>-<meeting-date>-project-update.json` in `.claude/skills/36-project-update/logs/` per the CLAUDE.md JSON schema; `artifacts` holds the HTML path.

## Important Rules

- **Never invent a status or a question.** Everything on the page comes from the user, the previous page or Jira, and the user confirms the final list.
- **Layout is fixed** — do not add sections, charts or narrative; the page is a one-pager table.
- **No internal references** on the page: no pipeline paths, skill names, or internal notes. Ticket keys are fine because the customer uses them.
- Escape all user text; keep the file self-contained (no external CSS, fonts or scripts).
- Language, customer name and meetings folder from config. No AI attribution.

## Error Handling

- **Meetings folder missing:** create it.
- **Previous update not parseable** (`--from-previous`): say so and start with an empty list.
- **Jira unreachable** (`--jql` or title check): continue without prefill or check, and say so.
- **User cancels during collection:** write nothing, print a cancellation note, log `failed` with the reason "cancelled".

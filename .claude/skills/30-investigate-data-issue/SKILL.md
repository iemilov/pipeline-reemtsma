---
name: investigate-data-issue
description: Use when records in an org look wrong and nobody knows why — mass status changes, missing points, lost consents, unexpected field values. Strictly read-only root-cause analysis with a fixed chain — scope the records, read the durable history, find every automation that writes the field, test the hypothesis against the code and deployment timeline, quantify — and a finding that states which process set what, when, on how many records, with the evidence per number
argument-hint: <org-alias> <record-ids | "SOQL WHERE clause" | path.csv> "<observation>" [--field <ApiName>] [--since <YYYY-MM-DD>] [--jira <key>]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Read-only, hard-wired.** This skill issues `SELECT` queries, metadata retrieves and log reads only. It never runs DML, anonymous Apex with DML, flow interviews, batch jobs, data loads or deployments — not even "to test the hypothesis". If a step could only be answered by changing data, it is written into the *Open questions* section instead. Restore or correction lists are produced as **CSV artefacts for a human**, never loaded.

## Purpose

Root-cause analysis for data that looks wrong. The input is an observation ("601,272 accounts were set to status 104 on 3 September", "four NPS participants received no points", "consents were cleared in April 2024"). The output is a **finding** with:

1. **Scope** — how many records are affected, verified against a durable source, with the query per number.
2. **Chain of custody** — which process (user, flow, Apex class, batch, integration, deployment) set which value, when, in which order.
3. **Root cause** — the hypothesis that survived the check against code, configuration and deployment timeline, with the alternatives that were ruled out and why.
4. **Blind spots** — what could not be verified because the evidence no longer exists, with the retention rule that deleted it.
5. **Artefacts** — record lists (affected / correct / to restore) as CSVs, plus the exact queries for reproduction.

The same chain every time, so the analysis is not re-invented per incident — and so the numbers do not change three times during the conversation.

## When to Use / When NOT to Use

- Use when a field value, status or count in an org is unexpected and the cause is unknown.
- Use before writing a customer explanation, a correction ticket or a restore list.
- Do NOT use to *fix* the data — that is a story (`/design-us`, `/implement-us`) or a manual data load after human review.
- Do NOT use for a general org health check — that is `/org-review`.
- Do NOT use to review a change before it is deployed — that is `/review-pr`.

## Configuration

Read before executing:

- `pipeline/customer.config.md` — customer identity, **Platform**, Short Name, documentation language, Jira project key
- `pipeline/stack.config.md` — org aliases, source path, API version, key objects, retention/deletion jobs if listed
- `pipeline/customer.domain.md` — field semantics, status codes, glossary, **field name pitfalls** (which field means what, which fields are derived and overwritten)

Resolve inputs from `$ARGUMENTS`:

| Input | Resolution |
|---|---|
| **Org alias** | first token; must match an alias in `stack.config.md`. Say which org (production or sandbox) the finding is about — an investigation on a sandbox rarely answers a production question |
| **Record scope** | second token: one or more 15/18-character IDs (comma-separated), a quoted SOQL `WHERE` clause, or a path to a CSV with an `Id` column |
| **Observation** | quoted text: what was seen, where, when, and what was expected instead |
| `--field <ApiName>` | the field under investigation; if omitted, derive it from the observation and confirm it in the first output line |
| `--since <date>` | earliest date to consider; default: 13 months back, or the customer's shortest retention window if `stack.config.md` names one |
| `--jira <key>` | related ticket; the finding is attached there as a comment only if the user asks |

> **Platform Adaptation:** the commands below are Salesforce (`sf` CLI, SOQL, field history, flows, Apex). On another platform, keep the chain and replace each step with the equivalents from `stack.config.md` — database query tool, audit tables or change-data-capture logs, application logs, the code that writes the column, deployment history. Steps that have no equivalent are reported as blind spots, not skipped silently.

## Evidence Rules (read before querying)

These rules come from investigations where the count changed mid-analysis because the first source was the wrong one.

1. **Derived fields are not evidence.** A "last interaction", "last activity", "status since" or similar timestamp that automation writes is overwritten by the very process under investigation. Use it to *form* a hypothesis, never to *prove* one. Durable sources rank in this order: field history → login/audit history → system audit fields (`CreatedDate`, `LastModifiedDate`, `LastModifiedById`, `SystemModstamp`) → event/log objects → derived fields.
2. **Every number carries its query and its timestamp.** A count without the exact query that produced it does not go into the finding. Save every result as CSV under the evidence folder.
3. **No count is reported before it is verified against a durable source.** Report a preliminary count only labelled *preliminary* with the source named; the finding contains only verified counts. If a verified count later changes, state the old value, the new value and the reason in the finding — never silently replace it.
4. **Same-second history entries have no reliable order.** When several history rows share a timestamp, treat them as one change set by one actor; do not derive "before/after" from row order.
5. **Migration and bulk timestamps are not user behaviour.** A timestamp shared by hundreds of thousands of records marks a migration, a deployment or a batch — find that event before interpreting the date as anything else.
6. **Absence of evidence is a blind spot, not proof.** If activity, event or log objects are deleted after N months, records older than that cannot be cleared or convicted; say so, with the retention rule and the number of records it affects.
7. **Attribute to an actor, not to a guess.** `LastModifiedById` / history `CreatedById` names the user context: an integration user, a deployment user, an admin, a named person. The actor plus the timestamp plus the deployment timeline identifies the process.
8. **Never build a large file by appending into its own source.** Concatenate exports into a *new* file name; check sizes before joining.

## Workflow

| Step | Content |
|---|---|
| 0 | Resolve inputs, confirm read-only, confirm the field and the org |
| 1 | Scope — fix the affected record set and freeze it |
| 2 | Durable history — what changed, when, by whom |
| 3 | Writers — every automation and integration that writes the field |
| 4 | Timeline — deployments, jobs and bulk events around the change |
| 5 | Hypothesis test — code and configuration against the observed values |
| 6 | Quantify — verified counts per group, blind spots sized |
| 7 | Finding, artefacts, log |

Keep a running **evidence folder**: `investigations/<YYYY-MM-DD>-<slug>/` with `queries.md` (every query, in order, with the row count and timestamp), `data/` (CSV per query), and `finding.md`. Create it in Step 0. `<slug>` is the field or observation in kebab-case, e.g. `manualstatus-104-mass-update`.

### Step 0: Set up

```bash
sf org display -o <org-alias> --json                     # confirm org, user, instance
mkdir -p investigations/<YYYY-MM-DD>-<slug>/data
```

Print one line: org, running user, field under investigation, record scope type, `--since` date. If the observation names no field and none can be derived, ask for it — do not guess a field and query around it.

### Step 1: Scope the records

Freeze the affected set first; every later count refers to it.

```bash
# from IDs or a WHERE clause — always include the audit fields
sf data query -o <org-alias> -r csv -q "SELECT Id, <field>, CreatedDate, CreatedById, CreatedBy.Name, LastModifiedDate, LastModifiedById, LastModifiedBy.Name, SystemModstamp FROM <Object> WHERE <scope>" > investigations/<date>-<slug>/data/01-scope.csv
# large sets: bulk export instead of a REST query
sf data export bulk -o <org-alias> --output-file investigations/<date>-<slug>/data/01-scope.csv -r csv -q "SELECT ... FROM <Object> WHERE <scope>" --wait 30
```

Record: total count, distribution of `<field>` values, distribution of `LastModifiedDate` by day and of `LastModifiedById` by user. A single day or a single user covering most of the set is the first lead — note it as a **preliminary** observation, not as a cause.

Also query the **comparison set**: records that meet the same business condition but were *not* affected (e.g. same status set on other days, or same segment but untouched). Without it, "all records with X" cannot be distinguished from "all records touched by process Y".

### Step 2: Durable history

**2a. Field history** — the primary source when tracking is on:

```bash
sf data query -o <org-alias> -r csv -q "SELECT Field FROM <Object>History WHERE Field = '<field>' LIMIT 1"   # is the field tracked at all?
sf data export bulk -o <org-alias> -r csv --output-file investigations/<date>-<slug>/data/02-history.csv \
  -q "SELECT ParentId, Field, OldValue, NewValue, CreatedDate, CreatedById, CreatedBy.Name FROM <Object>History WHERE Field = '<field>' AND CreatedDate >= <since> ORDER BY ParentId, CreatedDate" --wait 60
```

Group by `CreatedDate` (to the minute) and `CreatedById`: a block of many rows in one window by one actor is one event. Also pull history for the **related fields** the observation implies (consents, sync flags, tier fields) — a mass change usually touches several fields in the same second; that is what identifies the flow or class (Rule 4).

If the field is not tracked, say so in the finding as the first blind spot and fall through to 2b–2d.

**2b. Login and authentication history** — durable evidence of user activity, independent of any derived field:

```bash
sf data query -o <org-alias> -r csv -q "SELECT UserId, LoginTime, Status, Application, LoginType FROM LoginHistory WHERE LoginTime >= <since> AND UserId IN (...)"
```

For person or community accounts, also query the durable per-user fields on `User` (`LastLoginDate`) and any login-stamp fields the customer maintains that are **not** written by the process under investigation (`customer.domain.md` lists which are which).

**2c. Activity, event and log objects** — the fastest to disappear:

```bash
sf data query -o <org-alias> -r csv -q "SELECT COUNT(Id), MIN(CreatedDate) FROM <ActivityOrLogObject> WHERE <link> IN (...)"
```

`MIN(CreatedDate)` across the whole object tells you the retention horizon in practice. Anything before it is a blind spot — size it: how many scoped records have their relevant change before that date.

**2d. Setup Audit Trail and deployment history** — who changed configuration when:

```bash
sf data query -o <org-alias> -r csv -q "SELECT Action, Section, CreatedDate, CreatedBy.Name, Display FROM SetupAuditTrail WHERE CreatedDate >= <since> ORDER BY CreatedDate DESC"
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Id, Status, CreatedDate, CreatedBy.Name, CompletedDate, NumberComponentsDeployed FROM DeployRequest WHERE CreatedDate >= <since> ORDER BY CreatedDate DESC"
```

### Step 3: Find every writer of the field

Nothing is attributed until every writer is known. Search source **and** the org, because the org may run a version that is not in the branch.

```bash
# Apex — assignments and dynamic writes
grep -rn "<field>" <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls' | grep -E "=\s|put\(|\.<field>\s*="
# Flows — which flows assign the field, and in which element
grep -rln "<field>" <source-path>/flows/ --include='*.flow-meta.xml'
grep -n -B2 -A6 "<field>" <source-path>/flows/<Flow>.flow-meta.xml | grep -E "<name>|<field>|<value>|<operator>|<elementReference>"
# Triggers, process builders, workflow field updates, validation rules
grep -rln "<field>" <source-path>/triggers/ <source-path>/workflows/ <source-path>/objects/<Object>/ 2>/dev/null
# Configuration that steers the writers (custom metadata, custom settings, labels)
grep -rln "<field>\|<status code or value>" <source-path>/customMetadata/ <source-path>/objects/*__mdt/ 2>/dev/null
```

Then the **org side** — the active versions actually running:

```bash
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Definition.DeveloperName, VersionNumber, Status, LastModifiedDate, LastModifiedBy.Name FROM Flow WHERE Definition.DeveloperName IN ('<flows found>') ORDER BY Definition.DeveloperName, VersionNumber DESC"
sf project retrieve start -o <org-alias> -m "Flow:<Flow>" -m "ApexClass:<Class>" --output-dir investigations/<date>-<slug>/retrieved
diff -r <source-path>/flows/<Flow>.flow-meta.xml investigations/<date>-<slug>/retrieved/...   # branch vs org
```

Also list **scheduled and batch jobs** and **integration users** that can touch the object:

```bash
sf data query -o <org-alias> -r csv -q "SELECT CronJobDetail.Name, State, PreviousFireTime, NextFireTime, CreatedBy.Name FROM CronTrigger ORDER BY PreviousFireTime DESC"
sf data query -o <org-alias> -r csv -q "SELECT ApexClass.Name, Status, JobType, CreatedDate, CompletedDate, JobItemsProcessed, TotalJobItems, NumberOfErrors, CreatedBy.Name FROM AsyncApexJob WHERE CreatedDate >= <since> AND JobType IN ('BatchApex','ScheduledApex','Queueable') ORDER BY CreatedDate DESC"
```

Build the **writer table**: writer (flow element / class.method / job / integration / manual), trigger condition, value written, related fields written in the same transaction, user context it runs as, version and deploy date. This table is the reference the hypothesis is tested against.

### Step 4: Timeline

Put on one timeline, in the org's time zone and in UTC:

- deployments and flow version activations (2d, 3),
- batch and scheduled job runs (3),
- the history blocks from 2a (start, end, actor, row count),
- known external events: migrations, bulk loads, integration incidents (ask the user if the audit trail does not show them),
- the moment the observation was made.

A change that starts within an hour of a deployment by the same or a related user is the strongest lead there is — but it is still a lead until Step 5 confirms that the deployed version writes exactly the observed values.

### Step 5: Test the hypothesis against code and configuration

For the leading writer:

1. **Read the code or flow path** end to end — entry condition, decision elements, the assignment, the fields written alongside. Confirm the observed value combination (e.g. status + sync flag + consent fields all changed) matches **exactly** what this path writes. A path that writes three of the four observed fields is not the cause of the fourth.
2. **Check the version that was live at the time** (retrieved in Step 3), not the branch. If the org version was since changed or reverted, say which version caused the issue and which is live now.
3. **Check the entry condition against the comparison set** from Step 1: records that met the condition but were untouched contradict the hypothesis; records that did not meet it but were touched point to a different path or a bulk update from outside (data loader, integration).
4. **Check the user context**: does the writer run as the actor seen in the history? A flow triggered by a deployment user's mass update runs as that user; an integration user's rows point at the integration.
5. **Rule out the alternatives** from the writer table one by one, each with the evidence that excludes it (never ran in the window, writes a different value, entry condition not met).

If two writers remain possible, the finding says so, names the query or log that would separate them, and states whether that evidence still exists.

### Step 6: Quantify

Now, and only now, the counts. Partition the scoped set into named groups, each defined by a query on durable evidence, e.g.:

| Group | Definition | Count | Query |
|---|---|---|---|
| Correct by rule | condition genuinely met, verified by history/login evidence | … | `02-history.csv`, `03-logins.csv` |
| Wrongly changed | durable evidence of activity inside the window that should have prevented the change | … | … |
| Changed, later legitimately reverted / re-set | history shows a subsequent change by a legitimate process | … | … |
| Unverifiable | relevant evidence older than the retention horizon (blind spot) | … | `MIN(CreatedDate)` from 2c |

Every group count must sum to the scoped total; if they do not, say which records fall between the groups and why. Write each group as a CSV under `data/` with the columns a human needs to act (Id, key fields, the evidence column that put the record in that group).

For restore proposals, add a **restore CSV** with the target values and the source of each value (history `OldValue` at the time of the change). Where the source is ambiguous (Rule 4), pick the safest value, mark the column `ambiguous`, and explain in the finding — do not leave it blank.

### Step 7: Finding, artefacts, log

Write `investigations/<date>-<slug>/finding.md` in the **documentation language** from `customer.config.md`:

1. **Result in three sentences** — what happened, which process caused it, how many records; the confidence level (confirmed / probable / two candidates).
2. **Observation** — verbatim from the input, org, date, who reported it.
3. **Scope** — total, distributions, comparison set.
4. **Chain of custody** — the timeline from Step 4 with the confirmed writer marked; for each step: what was set, on how many records, by which actor, triggered by what.
5. **Root cause** — the confirmed path with the code/flow reference (file and element or method), the version, and the exact value combination it writes. Then the alternatives ruled out, each with its exclusion evidence.
6. **Quantification** — the group table from Step 6, every count with its query file.
7. **Blind spots** — what could not be verified, the retention rule responsible, the number of records affected, and whether any other durable source could still close the gap.
8. **Corrections of earlier numbers** — if a preliminary or previously communicated figure differs from the verified one, old value, new value, reason (Rule 3).
9. **Recommended next steps** — as proposals for a human: restore list, process fix, tracking to enable, retention to reconsider. No DML is proposed as something this skill would execute.
10. **Reproduction** — link to `queries.md`; every query with timestamp and row count.

Artefacts: `finding.md`, `queries.md`, `data/*.csv` (scope, history, logins, groups, restore list), `retrieved/` (org versions of the writers).

Create `<YYYY-MM-DD>-<customer-short-name>-<slug>-investigate-data-issue.json` in `.claude/skills/30-investigate-data-issue/logs/`, using the standard JSON schema from CLAUDE.md; the `summary` starts with `[confidence=confirmed|probable|open] [scoped=<n>] [wrong=<n>] [unverifiable=<n>]`.

With `--jira <key>` and only when the user asks, add the three-sentence result and the artefact path as a comment on the ticket — never the record lists.

Present to the user:

- The three-sentence result and the confidence level
- The group table (names and counts only)
- The confirmed writer with file/element and version
- The blind spots in one line each
- Path to the evidence folder

## Important Rules

- **Read-only, hard-wired.** `SELECT`, `sf data export bulk`, `sf project retrieve start`, tooling-API reads, log reads. Never `sf data update/delete/import`, never `sf apex run` with DML, never a deployment, never a flow or batch start. A "quick test update on one record" is a change and is out of scope.
- **Apply the Evidence Rules literally.** In particular: no count enters the finding without a query file, derived fields never prove anything, blind spots are sized, changed numbers are explained.
- **Say which org.** A finding is per org; do not transfer a sandbox result to production.
- **Distinguish lead from cause.** Timeline coincidence is a lead; the cause is the path whose code writes exactly the observed values and whose entry condition matches the comparison set.
- **Record lists are artefacts, not messages.** IDs and personal data stay in the evidence folder; the chat and any Jira comment carry counts and paths only.
- **Keep the evidence folder out of the customer-visible repository** unless the user decides otherwise — it may contain personal data.
- Read all object, field, org and path names from config and `customer.domain.md`. Never hardcode status codes or field semantics; if the domain file does not define a value, ask.
- Output text uses the **documentation language** from `customer.config.md`.
- No AI attribution anywhere.

## Error Handling

- **Org unreachable:** run Step 3 on source only, produce the writer table and the list of queries that need to be run, and stop with status `partial`. Do not write a finding without org evidence.
- **Field history not enabled for the field:** state it as the first blind spot; rely on 2b–2d and system audit fields; downgrade the confidence level and say so.
- **History or export exceeds limits / times out:** export in date windows with `sf data export bulk`, one file per window, and concatenate into a **new** file (Rule 8).
- **Writer found in the org but not in source (or vice versa):** report the discrepancy as a finding of its own — the org runs code the branch does not know.
- **Two writers cannot be separated with the remaining evidence:** confidence `open`; name the missing evidence and whether it still exists anywhere (backups, data lake, marketing platform).
- **Record scope resolves to zero rows:** stop and show the scope query; do not widen the scope silently.
- **`investigations/` missing:** create it.

## Setup note

After this file is added or changed, re-run `setup.sh` from the repo root so the skill is merged into `.claude/skills/` and `.claude/commands/`. Until then the slash command is not wired up.

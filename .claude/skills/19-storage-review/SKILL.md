---
name: storage-review
description: Use when analysing Salesforce data and file storage consumption — measures usage against the licensed allowance, attributes consumption per object, identifies history/log tables and orphaned files, evaluates retention gaps, projects when the cap will be reached, and produces a phased cleanup plan with GB savings and a cost comparison against buying additional storage
argument-hint: [org-alias (optional, defaults to first org alias from stack.config.md)]
---

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. If the customer uses a different platform, inform the user and abort with a clear message.

## Purpose

Answer four questions with evidence:

1. **Where is the storage actually going?** Attribution per object and per file type, not a Setup screenshot.
2. **What can be removed or offloaded, and how many GB does each measure return?**
3. **When will the org hit its cap** at the current growth rate?
4. **Is cleanup cheaper than buying storage?** A cost comparison the business can decide on.

Output is a report plus a phased action plan. This is a **read-only audit** — it never deletes records or files, and never changes retention settings.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` — customer identity, **Platform**, Short Name, documentation language
- `pipeline/stack.config.md` — source path, org aliases, API version, key objects
- `pipeline/customer.domain.md` — which objects carry business-critical data, so retention proposals do not touch records the business must keep

Resolve the org alias from `$ARGUMENTS`, otherwise the first alias in `stack.config.md`.

## Storage Model Reference

Salesforce bills two separate pools. Never mix them in the analysis.

| Pool | Contents | Sizing rule |
|------|----------|-------------|
| **Data Storage** | Records of standard and custom objects, including history and log tables | Fixed size per record, **not** the actual field content |
| **File Storage** | Files, Attachments, Documents, Content, static resources | Actual byte size |

**Per-record sizing** (used for every estimate in this skill — state the assumption in the report):

| Record type | Size |
|-------------|------|
| Most standard and all custom object records | 2 KB |
| Person Accounts | 4 KB (an Account plus a Contact) |
| Campaigns | 8 KB |
| Campaign Members | 1 KB |
| Email Messages | 2 KB plus body in file storage where applicable |
| Article versions | 4 KB |
| Big Object records | **Not counted** against Data Storage |

> Estimates derived from record counts are approximations. Always reconcile the sum against the **actual** figure from the org limits (Step 1) and report the delta. If the modelled total diverges from the actual by more than ~15%, say so rather than presenting the model as fact.

## Workflow

### Step 1: Baseline — actual consumption

```bash
sf org limits list -o <org-alias> --json | python3 -c "
import sys,json
d=json.load(sys.stdin)['result']
for r in d:
    if 'Storage' in r['name']:
        used=r['max']-r['remaining']
        print(f\"{r['name']}: {used} / {r['max']} MB used ({used*100/r['max']:.1f}%)\")
"
```

Record `DataStorageMB` and `FileStorageMB`: allowance, used, remaining, percentage. This is the ground truth every later estimate is reconciled against.

Also capture the licensed allowance basis (base allocation plus per-user allocation) so the report can state whether the org is genuinely at capacity or simply under-licensed.

### Step 2: Record counts per object

Use the bulk record-count endpoint rather than one query per object:

```bash
sf org display -o <org-alias> --json  # obtain instanceUrl and API version
sf api request rest "/limits/recordCount" -o <org-alias> | python3 -c "
import sys,json
d=json.load(sys.stdin)['sObjects']
for o in sorted(d,key=lambda x:-x['count'])[:60]:
    print(f\"{o['count']:>12,}  {o['name']}\")
"
```

This endpoint covers objects the org tracks; for anything missing, fall back to `SELECT COUNT()`.

Multiply counts by the sizing rules above to produce estimated MB per object, then rank descending. The top 10 objects typically account for 80%+ of data storage.

### Step 3: The usual suspects

These object families dominate storage in most orgs and are frequently invisible to the business. Query counts and age distribution for each that exists:

#### 3a. History and audit tables

```bash
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM AccountHistory" 2>/dev/null
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM ContactHistory" 2>/dev/null
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM CaseHistory" 2>/dev/null
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM OpportunityFieldHistory" 2>/dev/null
```

Also enumerate custom object history tables from local metadata:

```bash
grep -rln 'enableHistory>true' <source-path>/objects/ --include='*.object-meta.xml' 2>/dev/null
grep -rc 'trackHistory>true' <source-path>/objects/*/fields/*.field-meta.xml 2>/dev/null | grep -v ':0' | head -30
```

History rows are 2 KB each and accumulate indefinitely unless Field Audit Trail moves them to `FieldHistoryArchive` (a Big Object, which does **not** count against Data Storage). History tables are very often the single largest consumer and the easiest win, because tracking can be reduced on low-value fields without deleting anything.

#### 3b. Log and integration tables

Identify custom objects whose purpose is logging — names containing `Log`, `Audit`, `Trace`, `History`, `Error`, `Request`, `Response`, `Sync`, `Event`, `Debug`, `Staging`, `Temp`:

```bash
sf data query -o <org-alias> -r csv -q "SELECT QualifiedApiName, Label FROM EntityDefinition WHERE IsCustomSetting = false AND (QualifiedApiName LIKE '%Log%' OR QualifiedApiName LIKE '%Audit%' OR QualifiedApiName LIKE '%Error%' OR QualifiedApiName LIKE '%Request%' OR QualifiedApiName LIKE '%Sync%' OR QualifiedApiName LIKE '%Staging%' OR QualifiedApiName LIKE '%Temp%')"
```

For each, query total count and the count older than 3, 6, 12 and 24 months. Log tables with no retention job are pure waste — they exist to support troubleshooting that happens within days, yet retain records for years.

#### 3c. Platform-generated volume

```bash
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM EmailMessage" 2>/dev/null
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM LoginHistory WHERE LoginTime = LAST_N_DAYS:90" 2>/dev/null
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM Task WHERE CreatedDate < LAST_N_YEARS:2" 2>/dev/null
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM Event WHERE CreatedDate < LAST_N_YEARS:2" 2>/dev/null
```

Also check for marketing/email engagement objects, which grow fastest of all in consumer orgs.

#### 3d. Age distribution for the top objects

For each of the top 10 objects by estimated size, bucket by age:

```bash
for Y in 1 2 3 5; do
  sf data query -o <org-alias> --json -q "SELECT COUNT() FROM <Object> WHERE CreatedDate < LAST_N_YEARS:$Y"
done
```

This converts "the object is big" into "N GB is older than X years", which is what makes a retention decision possible.

### Step 4: File storage

```bash
sf data query -o <org-alias> -r csv -q "SELECT FileType, COUNT(Id) cnt, SUM(ContentSize) bytes FROM ContentVersion WHERE IsLatest = true GROUP BY FileType ORDER BY SUM(ContentSize) DESC"
sf data query -o <org-alias> -r csv -q "SELECT Id, Title, FileType, ContentSize, CreatedDate, CreatedBy.Name FROM ContentVersion WHERE IsLatest = true ORDER BY ContentSize DESC LIMIT 50"
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM Attachment"
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM Document"
```

Analyse:

- **By file type** — which formats dominate. Large PDF/image volumes are the usual offloading candidates.
- **Version bloat** — total `ContentVersion` rows versus `IsLatest = true` rows. Every superseded version consumes storage:
  ```bash
  sf data query -o <org-alias> --json -q "SELECT COUNT() FROM ContentVersion"
  sf data query -o <org-alias> --json -q "SELECT COUNT() FROM ContentVersion WHERE IsLatest = true"
  ```
- **Orphaned files** — `ContentDocument` with no `ContentDocumentLink` to a live record:
  ```bash
  sf data query -o <org-alias> --json -q "SELECT COUNT() FROM ContentDocument WHERE Id NOT IN (SELECT ContentDocumentId FROM ContentDocumentLink)"
  ```
- **Legacy Attachments and Documents** — both are superseded by Files; migration is a modernisation and often a deduplication win.
- **Duplicates** — group by `ContentSize` and `Title` to find the same document uploaded repeatedly.

### Step 5: Retention gap analysis

For every object in the top 20, determine whether a retention mechanism exists:

```bash
grep -rln 'Batchable\|Schedulable' <source-path>/classes/ --include='*.cls' | xargs grep -ln 'delete ' 2>/dev/null
grep -rn 'Database.emptyRecycleBin\|delete \[SELECT' <source-path>/classes/ --include='*.cls' | grep -v Test
```

Cross-reference with scheduled jobs actually running in the org:

```bash
sf data query -o <org-alias> -r csv -q "SELECT CronJobDetail.Name, State, NextFireTime, PreviousFireTime FROM CronTrigger WHERE State = 'WAITING' ORDER BY NextFireTime"
```

Classify each top object:

| Class | Meaning |
|-------|---------|
| **Retention active** | A scheduled job deletes or archives records on a defined age |
| **Retention implemented but not scheduled** | Deletion code exists but no active `CronTrigger` — a common and invisible failure |
| **No retention** | Records accumulate indefinitely |
| **Retention not appropriate** | Master data that must be kept |

"Implemented but not scheduled" is worth calling out explicitly: the team believes retention is handled, and it is not.

### Step 6: Growth rate and time to cap

```bash
for Y in 1 2 3; do
  sf data query -o <org-alias> --json -q "SELECT COUNT() FROM <TopObject> WHERE CreatedDate = LAST_N_YEARS:$Y"
done
```

Derive records created per year for the top objects, convert to MB/year, and project:

- Current usage and remaining headroom in GB
- Net growth per year in GB
- **Months until the cap is reached** at the current rate
- The same projection assuming the proposed cleanup is executed

A date is far more actionable than a percentage. State it plainly: *"At the current rate the data storage cap is reached in <N> months (around <Month Year>)."*

### Step 7: Offloading options

Assess each against the findings, with a recommendation rather than a catalogue:

| Option | Best for | Trade-off |
|--------|----------|-----------|
| **Delete with retention policy** | Logs, staging, superseded history | Cheapest and fastest; irreversible after the Recycle Bin window |
| **Big Objects** | History and audit data needing long retention | Free of Data Storage; queryable only via async SOQL or Bulk API |
| **Field Audit Trail** | Standard field history beyond 18–24 months | Licensed feature; moves history to `FieldHistoryArchive` |
| **Data Cloud / Data 360** | Analytical and segmentation workloads on large volumes | Licence cost; strongest where the data is also needed for marketing or AI |
| **External object / file offloading** | Large files, documents, archives | Requires an external store and integration effort |
| **Buy additional storage** | Where the data must remain hot and in-org | Recurring cost; no engineering effort |

### Step 8: Cost comparison — cleanup vs. buying storage

Build the comparison the business actually decides on:

| Input | Source |
|-------|--------|
| Current overage or projected shortfall in GB | Steps 1 and 6 |
| List price per additional GB per year | Ask the user or the account team — **never invent a price** |
| Estimated engineering effort for the cleanup plan | Step 9, in person-days |
| Recurring saving after cleanup | GB avoided × price |

Present a 1-year and 3-year view. Where the price per GB is unknown, present the comparison **parametrically** (savings in GB, effort in PD) and state clearly that the commercial figure must be supplied — do not fabricate a euro amount.

Include the indirect benefits, but keep them separate from the hard numbers: faster full-copy sandbox refreshes, shorter backup and restore windows, better report and query performance on smaller tables, reduced GDPR surface.

### Step 9: Action plan

Phased, each item carrying its estimated GB saving, effort and risk:

| Phase | Focus | Typical content |
|-------|-------|-----------------|
| **1 — Quick wins** | Reversible, high volume, low risk | Purge log/staging tables past retention, empty the Recycle Bin, delete orphaned files, remove superseded file versions |
| **2 — Retention** | Establish policies where none exist | Schedule retention jobs, activate implemented-but-unscheduled jobs, reduce field history tracking on low-value fields |
| **3 — Structural** | Longer-term relief | Big Objects for history, file offloading, Data Cloud evaluation, archive strategy for closed business records |

For every item state: object, measure, **estimated GB freed**, effort (PD), risk, reversibility, and owner. Sort by GB per person-day so the highest-leverage work is visible first.

**Mandatory safety rules to include in the plan:**

- Take a full export (`sf data export` or Data Export Service) of any object before the first deletion touches it.
- Deleted records occupy the Recycle Bin for 15 days and **still consume storage** until it is emptied — the saving is not realised until then.
- Run every deletion in a full-copy sandbox first, verifying record counts before and after.
- Never delete records referenced by active reports, dashboards, or integrations without checking first.
- Check `customer.domain.md` and legal retention duties (tax, GDPR, industry rules) before proposing deletion of business records.

### Step 10: Generate the report

Save to `org_assessment/<YYYY-MM-DD>-storage-review.md` in the **documentation language** from `customer.config.md`. Create the directory if missing.

Structure:

1. **Executive summary** — usage vs. allowance for both pools, time to cap, total identified saving in GB and as a percentage, and the headline cost comparison.
2. **Current state** — actual figures from org limits, allowance basis, both pools.
3. **Data storage by object** — ranked table: object, record count, estimated MB, share of total, retention class. Include the reconciliation delta against the actual figure.
4. **Per-object analysis** — a subsection for the top consumers: what the data is, why it grew, age distribution, retention status, recommendation, estimated saving.
5. **File storage** — by type, version bloat, orphans, legacy Attachments/Documents, largest files.
6. **Retention gaps** — the classification table from Step 5, highlighting "implemented but not scheduled".
7. **Growth projection** — growth per year, months to cap, the same projection post-cleanup.
8. **Offloading options** — assessment with a recommendation.
9. **Cost comparison** — cleanup vs. additional storage, 1-year and 3-year.
10. **Action plan** — phased, with GB, effort, risk and owner per item.
11. **Governance** — retention policy per object class, a review cadence, and a rule that every new logging or staging object ships with a retention job from day one.
12. **Appendix: verification gaps** — anything Setup-only or otherwise unverifiable.

### Step 11: Save & compare

If a previous storage review exists in `org_assessment/`, add a **Delta** section: usage change per pool, whether proposed measures were implemented, GB actually saved versus estimated, and the revised time to cap. An estimate that did not materialise is the most useful thing in a follow-up review — report it plainly.

### Step 12: Create log file

Create `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-storage-review.json` in `.claude/skills/19-storage-review/logs/`, using the standard JSON schema from CLAUDE.md. Include both pools' usage, total identified saving in GB, and months-to-cap in the summary.

### Step 13: Summary to the user

Present:
- Data and file storage usage against allowance, with percentages
- Months until the cap at the current growth rate
- Top 5 consuming objects with GB each
- Total identified saving in GB and as a percentage of current usage
- The three highest GB-per-person-day measures
- Path to the report

## Important Rules

- **Read-only.** Never delete records or files, never change retention settings, never empty the Recycle Bin. Produce a plan; a human executes it.
- **Reconcile estimates against reality.** Record-count models are approximations — always compare the modelled total to the actual figure from org limits and report the delta.
- **Never invent commercial figures.** If the price per GB is unknown, present the comparison in GB and person-days and mark the euro amount as input required.
- **Check legal retention before proposing deletion.** Consult `customer.domain.md`; flag anything that may be subject to statutory retention for legal review rather than deciding it in the report.
- **Distinguish the two storage pools throughout.** A file-storage problem is not solved by deleting records.
- **Big Object records do not count against Data Storage** — this is what makes archival migration effective, and it should be stated where relevant.
- Report savings as ranges where the underlying counts are estimates, not as false precision.
- Read all object names, source paths and org aliases from config. Never hardcode.
- Output text uses the **documentation language** from `customer.config.md`.

## Error Handling

- **No org access:** run the local metadata checks (history tracking, retention code, scheduled job definitions) and route all volume measurement to the verification-gaps appendix. Do not abort.
- **`/limits/recordCount` unavailable:** fall back to `SELECT COUNT()` per object for the objects named in `stack.config.md` and `customer.domain.md`, and state that the object list is not exhaustive.
- **`COUNT()` times out on very large objects:** query by date range and sum, or report the count as "over N million" from a bounded query rather than leaving it blank.
- **Aggregate queries blocked on an object:** note it and estimate from a bounded sample, marking the figure as sampled.
- **`org_assessment/` missing:** create it.

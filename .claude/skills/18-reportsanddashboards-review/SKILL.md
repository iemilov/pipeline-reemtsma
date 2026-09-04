---
name: reportsanddashboards-review
description: Use when auditing Salesforce reports and dashboards for unused or abandoned assets — inventories every report, dashboard and folder, classifies each as active/dormant/unused/orphaned by usage evidence and inbound references, produces a decommission list with a safe deletion procedure, and derives a governance plan that prevents unused reports and dashboards from accumulating again
argument-hint: [org-alias (optional, defaults to first org alias from stack.config.md)] [--days N (dormancy threshold, default 180)]
---

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. If the customer uses a different platform, inform the user and abort with a clear message.

## Purpose

Two deliverables in one run:

1. **An audit report** listing every unused report and dashboard, each with the evidence that led to that classification and a recommended disposition.
2. **A governance plan** that stops unused reports and dashboards from being created in the first place — naming, folder model, ownership, lifecycle rules, and a recurring review cadence.

This is a **read-only audit**. It never deletes, modifies, or deactivates anything. It *generates* a cleanup script for a human to review and execute separately.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` — customer identity, **Platform**, Short Name, documentation language
- `pipeline/stack.config.md` — source path, org aliases, API version
- `pipeline/customer.domain.md` — business-critical objects and reporting domains, so genuinely important reports are not proposed for deletion

Resolve inputs:
- **Org alias:** first token of `$ARGUMENTS` if present, otherwise the first org alias from `stack.config.md`
- **Dormancy threshold:** `--days N` if present, otherwise **180 days**
- **Source path:** from `stack.config.md` (typically `force-app/main/default`)

## Classification Model

Every report and dashboard is assigned exactly one status:

| Status | Definition |
|--------|------------|
| **Active** | Run or viewed within the dormancy threshold, **or** referenced by an active subscription, dashboard, flexipage, or Apex |
| **Dormant** | No usage within the threshold, but has a valid inbound reference or was used at some point |
| **Unused** | No usage within the threshold **and** no inbound reference, but was run at least once historically |
| **Never used** | `LastRunDate` is null and no inbound reference — created and abandoned |
| **Orphaned** | Owner or running user is inactive/deleted, or the containing folder has no active manager |
| **Broken** | References a deleted report, deleted field, or a report type that no longer exists |

> **Never propose deletion on usage data alone.** A report with no usage but an inbound reference from an active dashboard is Dormant, not Unused. Resolve references before classifying.

## Workflow

### Step 1: Inventory

#### 1a. Reports

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, Name, DeveloperName, FolderName, Format, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name, LastRunDate, Owner.Name, OwnerId FROM Report ORDER BY LastRunDate ASC NULLS FIRST"
```

#### 1b. Dashboards

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, Title, DeveloperName, FolderName, Type, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name, RunningUser.Name, RunningUserId FROM Dashboard ORDER BY LastModifiedDate ASC"
```

#### 1c. Folders

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, Name, DeveloperName, Type, AccessType, IsReadonly FROM Folder WHERE Type IN ('Report','Dashboard') ORDER BY Type, Name"
```

Record totals per type and per folder. Empty folders and folders holding only unused assets are themselves findings.

#### 1d. Local metadata cross-check

```bash
find <source-path>/reports/ -name '*.report-meta.xml' 2>/dev/null | wc -l
find <source-path>/dashboards/ -name '*.dashboard-meta.xml' 2>/dev/null | wc -l
```

Assets present in the org but absent from source control were built directly in production — flag this as a governance gap, not as a deletion candidate.

### Step 2: Usage Evidence

> **Critical pitfall — do not skip.** On `Report` and `Dashboard`, `LastViewedDate` and `LastReferencedDate` are **per-user** fields: they reflect the *querying* user's own activity, not org-wide usage. Querying them as the integration user will return null for assets everyone else uses daily, producing false "unused" verdicts.
>
> Use `Report.LastRunDate` (org-wide) as the baseline signal, and prefer the authoritative sources below when available. Where only `LastRunDate` is available, say so in the report and mark dashboard usage as **inferred**, since `Dashboard` has no org-wide equivalent field.

Attempt each source in order and record which ones succeeded:

#### 2a. Event Monitoring (authoritative, requires Shield)

```bash
sf data query -o <org-alias> -r csv -q "SELECT Report, COUNT(Id) runs FROM ReportEvent WHERE EventDate = LAST_N_DAYS:30 GROUP BY Report ORDER BY COUNT(Id) DESC" 2>&1 | head -50
sf data query -o <org-alias> -r csv -q "SELECT Dashboard, COUNT(Id) views FROM DashboardEvent WHERE EventDate = LAST_N_DAYS:30 GROUP BY Dashboard ORDER BY COUNT(Id) DESC" 2>&1 | head -50
```

`EventLogFile` retains 30 days (1 day without Shield). If these objects are unavailable, note it and continue.

#### 2b. Lightning Usage App (manual)

If Event Monitoring is unavailable, add to the action plan: "Setup > Lightning Usage App > Reports/Dashboards — export the usage listing for the last 90 days and reconcile against the inventory in this report."

#### 2c. Subscriptions — usage without views

An asset with an active subscription is **in use** even with no interactive runs.

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, ReportId, Report.Name, OwnerId, Owner.Name, Owner.IsActive FROM ReportSubscription" 2>&1
sf data query -o <org-alias> -r csv -q "SELECT Id, DashboardId, Dashboard.Title, RunningUserId FROM DashboardComponent" 2>&1 | head -5
```

Also check subscriptions whose owner is inactive — these deliver mail nobody reads and are cleanup candidates in their own right.

### Step 3: Inbound Reference Resolution

A report is only safely deletable when nothing points at it.

#### 3a. Dashboard → report references

```bash
grep -rhoE '<report>[^<]+</report>' <source-path>/dashboards/ 2>/dev/null | sed 's|</\?report>||g' | sort -u
```

Every report named here is referenced by a dashboard. Cross-reference with the dashboard's own status: a report referenced only by an *unused* dashboard is itself a deletion candidate — evaluate the pair together.

#### 3b. Flexipage / app embedding

```bash
grep -rln 'report\|dashboard' <source-path>/flexipages/ --include='*.flexipage-meta.xml' 2>/dev/null
grep -rhoE '<value[^>]*>[a-zA-Z0-9_]{15,18}</value>' <source-path>/flexipages/ 2>/dev/null | sort -u | head -30
```

Reports and dashboards embedded on Lightning pages are in use even with low direct run counts.

#### 3c. Apex, Flow and code references

```bash
grep -rn 'ReportManager\|Reports\.ReportManager\|/lightning/r/Report/' <source-path>/classes/ --include='*.cls' 2>/dev/null | grep -v 'Test'
grep -rln 'analyticsCloud\|reportChart\|dashboardId' <source-path>/lwc/ <source-path>/aura/ 2>/dev/null
grep -rhoE '00O[a-zA-Z0-9]{12,15}|01Z[a-zA-Z0-9]{12,15}' <source-path>/ 2>/dev/null | sort -u
```

`00O` prefixes are report IDs, `01Z` are dashboard IDs. Any hard-coded ID found in source is both an inbound reference **and** a fragility finding worth reporting.

#### 3d. Reporting snapshots

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, DeveloperName, MasterLabel FROM AnalyticSnapshot" 2>&1
```

A report feeding a reporting snapshot must never be deleted — deletion breaks the snapshot job silently.

### Step 4: Ownership & Folder Health

#### 4a. Assets owned by inactive users

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, Name, FolderName, Owner.Name, Owner.IsActive FROM Report WHERE Owner.IsActive = false"
sf data query -o <org-alias> -r csv -q "SELECT Id, Title, FolderName, RunningUser.Name, RunningUser.IsActive FROM Dashboard WHERE RunningUser.IsActive = false"
```

Dashboards with an **inactive running user** do not refresh at all — they display stale data to every viewer. This is a correctness problem, not just hygiene: report it as High.

#### 4b. Private folders and personal assets

Reports in personal folders are invisible to governance and multiply silently. Count them and report the total; do not propose individual deletions for assets in other users' private folders.

#### 4c. Folder sprawl

Flag: folders containing zero assets, folders whose entire content is Unused/Never used, folders with `AccessType = Public` holding sensitive reporting, and near-duplicate folder names indicating an unclear folder model.

### Step 5: Duplicate & Near-Duplicate Detection

```bash
sf data query -o <org-alias> -r csv -q "SELECT Name, COUNT(Id) FROM Report GROUP BY Name HAVING COUNT(Id) > 1 ORDER BY COUNT(Id) DESC"
```

Also detect copy artefacts in names — `copy`, `Kopie`, `v2`, `_new`, `_old`, `TEST`, `tmp`, `final`, `Copy of`, trailing digits — and names identical except for a suffix. These indicate "clone and tweak" behaviour and are the single largest driver of report sprawl.

### Step 6: Classify and Score

Apply the classification model. For each asset record: status, last run/view evidence, inbound references, owner, folder, and recommended disposition (**Keep** / **Reassign owner** / **Archive** / **Delete**).

**Estate health score (100 points):**

| Dimension | Weight | Scoring |
|-----------|--------|---------|
| Usage ratio | 30 | % of assets Active. ≥70% = full marks; deduct 3 points per 5 points below |
| Never-used ratio | 20 | % created and never run. 0% = full marks; deduct 2 points per 5% |
| Ownership health | 15 | Deduct 3 per dashboard with an inactive running user (max −9); 2 per orphaned folder (max −6) |
| Duplication | 15 | Deduct 2 per duplicate-name cluster (max −10); 5 if copy artefacts exceed 10% of the estate |
| Folder model | 10 | Deduct 2 per empty folder (max −6); 4 if no documented folder convention exists |
| Source control | 10 | % of assets present in version control. Deduct proportionally |

Traffic light: ≥80 green, 55–79 yellow, <55 red.

### Step 7: Generate the Report

Save to `org_assessment/<YYYY-MM-DD>-reports-dashboards-review.md`, in the **documentation language** from `customer.config.md`. Create `org_assessment/` if missing.

**Structure:**

1. **Executive summary** — estate health score and traffic light, totals (reports, dashboards, folders), counts per status, estimated cleanup volume, and a one-paragraph verdict.
2. **Inventory overview** — counts by folder, by format/type, by creation year; growth curve if `CreatedDate` supports it.
3. **Unused reports** — the core table:

   | Report | Folder | Owner | Created | Last run | Status | Inbound refs | Disposition |
   |--------|--------|-------|---------|----------|--------|--------------|-------------|

4. **Unused dashboards** — same shape, plus running user and its active flag.
5. **Never-used assets** — created and never run; the clearest deletion candidates. Group by creator and creation period, because a cluster from one person or one month usually indicates a specific abandoned project worth naming.
6. **Ownership and folder issues** — inactive owners, inactive dashboard running users (High — these silently serve stale data), empty folders, private-folder volume.
7. **Duplicates and near-duplicates** — clusters with a recommendation on which to retain.
8. **Broken and at-risk assets** — assets referencing deleted reports/fields, and hard-coded report/dashboard IDs found in source.
9. **Decommission plan** — the deletion list in waves, with the safety procedure from Step 8.
10. **Governance plan** — Step 9 output.
11. **Appendix: verification gaps** — every check that could not be automated, with exact Setup navigation.

### Step 8: Generate the Cleanup Artefacts

**Never delete anything.** Produce artefacts for a human to execute:

1. **`org_assessment/<YYYY-MM-DD>-reports-dashboards-cleanup.csv`** — one row per candidate: Id, Type, Name, Folder, Owner, Status, Disposition, Wave, Evidence.
2. **A staged decommission procedure**, written into the report:

   | Wave | Scope | Action | Safety gate |
   |------|-------|--------|-------------|
   | 0 | All candidates | Export definitions to source control (`sf project retrieve start -m Report -m Dashboard`) | Retrieval committed before anything else happens |
   | 1 | Never used, no references | Move to a quarantine folder named `_Zur Loeschung <YYYY-QN>` | Owner informed, 30-day objection window |
   | 2 | Unused, no references | Move to quarantine | 30-day objection window |
   | 3 | Quarantined ≥30 days with no objection | Delete | Deleted items stay in the Recycle Bin 15 days |
   | 4 | Dormant with references | Decide per asset with the business owner | Never bulk-processed |

   > Moving to a quarantine folder is reversible and surfaces objections from people whose reports you cannot see usage for. Deleting directly is not reversible after the Recycle Bin window. Always quarantine first.

3. **Rollback note:** deleted reports and dashboards are recoverable from the Recycle Bin for 15 days; after that only the Wave 0 metadata retrieval can restore them. Confirm Wave 0 is committed before Wave 3 runs.

### Step 9: Derive the Governance Plan

This is a required deliverable, not an optional appendix. Ground every rule in a finding from Steps 1–6 — a governance plan that does not reference what actually went wrong will not be adopted.

Cover:

**a. Folder and naming model**
- A documented folder taxonomy (by department, by domain, or by lifecycle) with one owner per folder.
- A naming convention, e.g. `<Domain> - <Subject> - <Granularity> [<Interval>]`, and a ban on `copy` / `v2` / `test` / `final` in production names.
- A designated sandbox or personal-folder space for exploratory work, so experiments never land in shared folders.

**b. Creation gate**
- Who may create reports in shared folders (recommendation: restrict the "Create and Customize Reports" and "Manage Public Reports/Dashboards" permissions to a named group; everyone else gets personal folders).
- A short request path: search existing reports first, then adapt an existing one, and only then create new.
- Mandatory description field on creation, stating purpose, audience, and expected review date.

**c. Lifecycle rules**
- Every shared report and dashboard carries a named business owner.
- Every dashboard's running user is a role-based or integration account, never a personal account that can be deactivated.
- Assets unused for the dormancy threshold enter quarantine automatically at the next review.

**d. Recurring review**
- A quarterly review owned by the CRM/Salesforce team: rerun this skill, work the quarantine, confirm ownership.
- The estate health score from Step 6 is tracked over time as the KPI.

**e. Preventive tooling**
- A saved report on the `Report` and `Dashboard` objects surfacing assets with no run in N days, so the estate is visible without rerunning this skill.
- Dashboard subscription for the folder owners.
- Where Shield is licensed, a recurring Event Monitoring export for authoritative usage data.
- Reports and dashboards retrieved into source control as part of the release process, closing the "built directly in production" gap.

**f. Onboarding**
- Include the naming and folder rules in admin/analyst onboarding, since sprawl is a behavioural problem before it is a technical one.

Present the plan as concrete rules with an owner and a start date per rule — not as generic advice.

### Step 10: Save & Compare

1. Save the report and the cleanup CSV.
2. If a previous reports-and-dashboards review exists in `org_assessment/`, add a **Delta** section: score change, assets deleted since, new unused assets created since, and net estate growth. Net growth despite an intervening cleanup is the signal that governance (Step 9) is not being followed.

### Step 11: Create Log File

Create `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-reportsanddashboards-review.json` in `.claude/skills/18-reportsanddashboards-review/logs/`, using the standard JSON schema from CLAUDE.md. Include counts per status and the estate health score in the summary.

### Step 12: Summary to the User

Present:
- Estate health score and traffic light
- Totals: reports, dashboards, folders
- Counts per status (Active / Dormant / Unused / Never used / Orphaned / Broken)
- Number of deletion candidates and the estimated reduction as a percentage
- Which usage sources were available (Event Monitoring / `LastRunDate` only / manual) and the resulting confidence level
- Paths to the report and the cleanup CSV
- The top 3 governance rules to adopt first

## Important Rules

- **Read-only.** Never delete, modify, move, or deactivate a report, dashboard, folder, or subscription. Generate artefacts; a human executes them.
- **Never propose deletion without reference resolution.** Steps 3a–3d must run before any asset is classified Unused.
- **State the confidence level explicitly.** If only `LastRunDate` was available, say that dashboard usage is inferred and that the list requires business confirmation before Wave 1.
- **Respect private folders.** Count them, never propose deletion of assets in another user's personal folder.
- Cross-check against `customer.domain.md` — a report on a business-critical object with low run counts may be a quarterly or annual report, not an abandoned one. Check whether the run interval matches a reporting cycle before classifying.
- Reports feeding **reporting snapshots** or **active subscriptions** are never deletion candidates, regardless of run counts.
- Read all org aliases, source paths, and domain terms from config. Never hardcode.
- Output text uses the **documentation language** from `customer.config.md`.

## Error Handling

- **No org access / auth failure:** run the local metadata checks (Steps 1d, 3a–3c) and route all org-dependent checks to the verification-gaps appendix. Do not abort.
- **`ReportEvent` / `DashboardEvent` unavailable** (no Shield): note it, fall back to `LastRunDate`, and explicitly downgrade the stated confidence level.
- **`ReportSubscription` not queryable** in the org's API version: add a manual check to the appendix — do not assume there are no subscriptions, since that assumption produces unsafe deletion recommendations.
- **Empty `reports/` or `dashboards/` source directories:** report the org/source-control gap as a governance finding and continue with org-based data only.
- **Very large estates (>2000 assets):** query in folder-sized batches, and report per folder rather than listing every asset individually. Include the full detail in the CSV instead.

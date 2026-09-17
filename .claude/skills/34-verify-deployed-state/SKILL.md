---
name: verify-deployed-state
description: Use when you need to know whether the org runs what the repository says — retrieves flows, Apex classes and triggers, custom metadata, validation rules and other selected metadata from an org and diffs them against the branch; reports org-newer, source-newer, inactive-in-org and missing components with who changed them and when
argument-hint: <org-alias> [--scope flows|apex|cmt|validation|all | -m "<Type:Name>" ...] [--branch <name>] [--since <YYYY-MM-DD>]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Read-only.** Retrieves and queries only. Never deploys, never activates or deactivates anything, never writes into the source path — retrieved files go to a scratch folder.

## Purpose

The repository and the org drift: a flow gets a new version in production, a validation rule is switched off, a custom metadata value is edited in Setup, a class is hot-fixed and never merged. Every analysis and every deployment that assumes the branch is the truth then goes wrong. This skill makes the drift visible in one run: what differs, in which direction, who changed it, when — and which of it matters.

## When to Use / When NOT to Use

- Use before an investigation, before a promotion, after a hotfix, after a sandbox refresh, and on a schedule for production.
- Use with `-m` for a targeted check of the components a story touches.
- Do NOT use to *resolve* the drift — that is a commit or a deployment the user decides on.
- Do NOT use to trace what a component does — `/trace-field`.

## Configuration

Read `pipeline/customer.config.md` (Platform, Short Name, documentation language, CI skip pattern), `pipeline/stack.config.md` (source path, org aliases, API version, package directories, `.forceignore` conventions). Resolve the org alias from `$ARGUMENTS`; `--branch` defaults to the current branch; `--scope` defaults to `all` = flows, Apex classes and triggers, custom metadata records, validation rules, plus permission sets and custom labels when present in source.

> **Platform Guard:** metadata retrieve and tooling queries are Salesforce. For other platforms, compare the deployed artefact version or configuration (release tag, container image, environment config) against the branch per `stack.config.md`, and report the same classifications.

## Workflow

### Step 1: Build the component list

From the scope or `-m`, list the components **present in source**, and additionally query the org for components of the same types that are **absent from source**:

```bash
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Definition.DeveloperName, VersionNumber, Status, LastModifiedDate, LastModifiedBy.Name FROM Flow WHERE Status = 'Active' ORDER BY Definition.DeveloperName"
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Name, LastModifiedDate, LastModifiedBy.Name, NamespacePrefix FROM ApexClass WHERE NamespacePrefix = null"
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Name, Status, TableEnumOrId, LastModifiedDate, LastModifiedBy.Name FROM ApexTrigger WHERE NamespacePrefix = null"
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT EntityDefinition.QualifiedApiName, ValidationName, Active, LastModifiedDate, LastModifiedBy.Name FROM ValidationRule"
sf data query -o <org-alias> -r csv -q "SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName LIKE '%__mdt'"
```

With `--since`, keep only components whose org `LastModifiedDate` is after that date plus everything changed in source since that date (`git log --since`).

### Step 2: Retrieve the org state

```bash
sf project retrieve start -o <org-alias> --output-dir <scratch>/org-state -m "Flow:*" -m "ApexClass:*" -m "ApexTrigger:*" -m "CustomMetadata:*" -m "ValidationRule:*" --wait 30
```

Narrow with the component list from Step 1 for large orgs (retrieve in type batches). Never retrieve into the source path.

### Step 3: Diff

Normalise before diffing: strip `<apiVersion>` differences when the project pins one, ignore whitespace-only changes, ignore flow `<interviewLabel>`/`<label>` cosmetic fields, compare custom metadata by field values.

```bash
diff -rq --exclude='*.xml~' <source-path> <scratch>/org-state/<package-dir> | grep -E "differ|Only in"
diff -u <source-path>/flows/<Flow>.flow-meta.xml <scratch>/org-state/.../flows/<Flow>.flow-meta.xml
```

For flows, additionally compare **version and status**: source holds the latest definition, the org holds N versions — report the active version number, whether the source matches the active or a draft/obsolete version, and who activated the active one. For validation rules, compare `Active`. For triggers, compare `Status`. For custom metadata, compare every field value and list records present on one side only.

Classify every component:

| Class | Meaning | Who / when |
|---|---|---|
| **Identical** | no relevant difference | — |
| **Org newer** | org content differs and org `LastModifiedDate` is after the last source commit touching the file | org modifier and date, last source commit |
| **Source newer** | source changed after the org version — not yet deployed | commit, author, date |
| **Diverged** | both changed since the common state | both |
| **Inactive in org** | exists in both, but the org has it inactive/obsolete/draft | who deactivated, when (Setup Audit Trail if needed) |
| **Org only** | exists in the org, not in source | creator, date |
| **Source only** | in source, not in the org (not deployed or deleted in org) | commit |

Pull the Setup Audit Trail for the window to attribute activations and deactivations:

```bash
sf data query -o <org-alias> -r csv -q "SELECT Action, Section, Display, CreatedDate, CreatedBy.Name FROM SetupAuditTrail WHERE CreatedDate >= <since> AND (Section LIKE '%Flow%' OR Section LIKE '%Apex%' OR Section LIKE '%Validation%' OR Section LIKE '%Custom Metadata%') ORDER BY CreatedDate DESC"
```

### Step 4: Assess what matters

For every non-identical component say what the difference **does**: a flow branch that writes different fields, a validation rule that no longer blocks, a trigger that no longer fires, a metadata value that changes a threshold. Read the diff — do not just count lines. Rank: differences on record-triggered automation and on active business rules first; cosmetic differences last.

### Step 5: Report

Write `org_assessment/<YYYY-MM-DD>-deployed-state-<org-alias>.md` in the documentation language:

1. **Summary** — org, branch, commit, counts per class, the three differences that matter most.
2. **Differences table** — component, type, class, org modifier/date, source commit/author/date, what the difference does, severity (blocks analysis / blocks deployment / cosmetic).
3. **Inactive and org-only components** — with the audit-trail attribution.
4. **Recommended resolution per item** — as a proposal: retrieve into a branch and commit, redeploy from source, deactivate in org, delete from source — each with who decides.
5. **Not compared** — types excluded, retrieve failures, managed packages.

Keep the retrieved state in the scratch folder and name its path so the user can commit from it if they choose.

Create `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-verify-deployed-state.json` in `.claude/skills/34-verify-deployed-state/logs/` per the CLAUDE.md schema; summary starts with `[identical=<n>] [org-newer=<n>] [source-newer=<n>] [diverged=<n>] [inactive=<n>] [org-only=<n>] [source-only=<n>]`.

Present: the counts, the top differences with what each does, the report path and the scratch path.

## Important Rules

- **Read-only and source-untouched.** Retrieve into scratch; never overwrite the source path; never deploy.
- **Direction and attribution for every difference.** "Differs" is not a finding; "org newer, changed by X on date, activates branch Y that clears consents" is.
- **Read the diff.** Line counts do not tell whether a difference matters.
- **Flows are compared by active version**, not by file existence.
- Read paths, aliases and types from config. No AI attribution.

## Error Handling

- **Retrieve fails for a type:** compare via tooling-API metadata (dates, versions, status) only, and mark content comparison as not performed for that type.
- **Org unreachable:** stop; there is nothing to compare against.
- **Very large orgs:** retrieve per type and per name prefix; report per batch; note anything skipped.
- **Managed-package components:** list by namespace as not compared.

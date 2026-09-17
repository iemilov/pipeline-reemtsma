---
name: init-sandbox
description: Initialize a freshly refreshed sandbox for development and personal UI testing, driven by the customer's init-sandbox.config.md
argument-hint: "<org-alias> [--no-testdata] [--dry-run]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Platform Guard

This skill requires `Platform: salesforce` in `customer.config.md`. If the active customer uses a different platform, inform the user that this skill is Salesforce-specific and abort.

## Purpose

Brings a **freshly refreshed sandbox** into a workable state for development and personal UI testing:

1. Lock down email sending (Email Deliverability = None — manual gate, no automation)
2. Verify the CI/CD wiring (customer-defined credential check, read-only, optional)
3. Enable flow deploy-as-active org-locally (deployed flow versions go live immediately — removes the manual activation step in this sandbox)
4. Enable admin Login-As org-locally (persona-based UI tests as different user profiles)
5. Check Experience sites and publish where needed (customer site catalog)
6. Create test data (preset selection per org alias, delegated to `/create-testdata`)

The skill changes **nothing unasked**: every mutating step has an explicit confirmation; pure checks run read-only. Which orgs may be initialized, which presets they get, which sites exist, and which CI check applies is **entirely customer-defined** in `pipeline/customers/<customer>/init-sandbox.config.md` — this skill contains no customer values.

## When to Use / When NOT to Use

**Use:**
- Right after a sandbox refresh, for any org alias the customer lists as initializable in `init-sandbox.config.md`
- When a sandbox has no test data and an unclear email/site state

**NOT:**
- Any org alias **not** listed in the customer's `init-sandbox.config.md` — the guard aborts (shared acceptance/UAT/production orgs are typically excluded there)
- Test data only, in an already initialized org → use `/create-testdata` directly
- Deleting test data → `/cleanup-testdata`
- Customer-specific post-refresh repairs outside this skill's steps (e.g. SSO restore) → see the customer's `init-sandbox.config.md > ## Post-Init Checklist` for pointers

## Related Skills

| Need | Use instead | Why |
|------|-------------|-----|
| Derive test data for a story | `/story-testdata` | Analyzes the story and recommends presets |
| Create test data (single preset, ad-hoc) | `/create-testdata` | This skill delegates the data part there anyway |
| Delete test data | `/cleanup-testdata` | Uses the creation logs written at creation time |
| Deploy a story to an environment | `/promote-us` | Deployment is not an init concern |

## Configuration

Read these BEFORE running:

- `pipeline/customer.config.md` — **Platform** (guard), customer Short Name (log file name)
- `pipeline/stack.config.md` — `## Org Aliases` (alias validation), optional key **`Flow Activation Script`** (path to the customer's copy of the flow-activation helper; **default when absent:** `pipeline/platforms/salesforce/scripts/activate-latest-flows.sh`)
- `pipeline/customers/<customer>/init-sandbox.config.md` — **required.** If the file does not exist, abort with: *"No init-sandbox.config.md found for the active customer. Create `pipeline/customers/<customer>/init-sandbox.config.md` (template: `pipeline/customers/_template/init-sandbox.config.md`) before running /init-sandbox."*
- `pipeline/customers/<customer>/testdata.config.md` — preset details (read by the delegated `/create-testdata` runs, not by this skill directly)

### Expected structure of `init-sandbox.config.md`

| Section | Content | Required |
|---------|---------|----------|
| `## Initializable Orgs` | Table `Alias \| Test data presets (in order) \| Notes` — the **allow-list**. Only these aliases may be initialized. Every alias MUST also exist in `stack.config.md > ## Org Aliases`. | yes |
| `## CI Credential Check` | Key/value row `Check Command` — a read-only command verifying the CI/CD credentials for the given org (placeholder `<alias>` is substituted). Exit contract: `0` = up to date, `2` = mismatch, `1` = error. | no — omit if the customer has no post-refresh CI credential concern |
| `## Site Catalog` | Table `Network \| Builder site \| Business context (keywords) \| sendWelcomeEmail` — the customer's Experience sites with business context for the selection dialog. | no — omit if the customer has no Experience Cloud sites; Step 4 then only reports the org's networks |
| `## Post-Init Checklist` | Bullet list of customer-specific manual items appended verbatim to the final report (e.g. integration secrets, SSO restore pointers). | no |

**Catalog drift rules (generic):** the site catalog can go stale — in both directions. Sites that exist in the org but are missing from the catalog: show them in the selection as "(unknown — description missing, update the catalog)" and **do not publish them automatically**. Catalog entries missing from the org: skip silently and note them in the report as "missing in org". Networks with the `ESW_` prefix are auto-generated Embedded Service (messaging/chat) networks — list them for information only, **never publish them manually**.

> **Runtime note:** the confirmation gates are interactive (via AskUserQuestion under Claude Code). Under other runtimes, present the gates as terminal prompts; never skip a gate silently.

## Workflow

> **Abort rule (applies to all steps):** every abort — guard, failed check, declined gate — writes a log per Step 7 with status `failed` before exiting. Sole exception: `--dry-run` (no log). For aborts before an alias is resolved (missing/invalid argument), log with `--identifier no-alias`.

### Step 0: Arguments & guard

1. Parse arguments: `<org-alias>` (required), flags `--no-testdata`, `--dry-run`. If the alias is missing or the first argument starts with `--`, abort with a usage hint (`/init-sandbox <org-alias> [--no-testdata] [--dry-run]`), listing the customer's initializable aliases.
2. **Guard:** the alias must match — **exactly, case-sensitive** — a row in `init-sandbox.config.md > ## Initializable Orgs`. For anything else (including diverging spellings) abort:
   > `⛔ init-sandbox only targets the orgs listed in init-sandbox.config.md (<list>). '<alias>' will not be initialized.`
3. **Config consistency check:** every alias in `## Initializable Orgs` must exist in `stack.config.md > ## Org Aliases`. On mismatch, abort and name the offending alias — the two files have drifted and must be reconciled before any org is touched.
4. Display the resolved plan: alias, its preset list from the config table, and — if the customer's `stack.config.md` maps aliases to release tracks — the resolved track/version context.
5. With `--dry-run`: run Step 1 as a read-only check only (`sf org display`, **without** the confirmation dialog), then print the plan with the resolved values (presets, check commands, script paths) and **stop**. Steps 2–7 are skipped, no log.

### Step 1: Auth check

```bash
sf org display -o <alias> --json
```

- `connectedStatus` must be `Connected`, otherwise abort with the hint:
  `sf org login web -r https://test.salesforce.com -a <alias>`
- Show username and `instanceUrl` and have the user confirm that this is the freshly refreshed sandbox (protection against alias mix-ups — aliases may be mapped per developer).

### Step 2: Email Deliverability → None (manual gate)

**Background:** after a refresh the sandbox is set to "System email only". The target is **"No access" (None)** so that no emails whatsoever (including Experience Cloud welcome emails) can be sent. The access level has no API surface (neither Metadata API nor Tooling API) — this step is therefore deliberately manual, **no browser automation**.

1. Open the Setup page directly:
   ```bash
   sf org open -o <alias> --path "/email-admin/editOrgEmailSettings.apexp"
   ```
2. The user sets **Access level = No access** and saves.
3. **Gate:** require explicit confirmation: "Deliverability is set to None and saved." Without confirmation: abort. Programmatic verification is impossible — the user's confirmation is the verification.

Only after this gate may steps follow that could trigger emails (sites, test data with users/members).

### Step 3: CI/CD credential check (read-only, only if configured)

Skip silently if `init-sandbox.config.md` defines no `## CI Credential Check` section (or an empty `Check Command`).

Otherwise run the configured command with `<alias>` substituted:

- **Exit 0:** CI credentials are up to date → continue.
- **Exit 2 (mismatch):** STOP. The refresh invalidated a credential the CI pipeline relies on (typically a regenerated connected-app consumer key) and it has not been re-synced yet — that must happen **manually first** (this skill deliberately performs no sync). Then re-run the skill.
- **Exit 1 (error):** STOP, show the command output (typically: CLI login missing, or org unreachable).

### Step 3b: Enable flow deploy-as-active (org-local)

**Background:** an org with `enableFlowDeployAsActiveEnabled = false` (the Salesforce default) lands every deployed flow as an *inactive* latest version. In a dev sandbox that is a trap: draft deploys from `/implement-us` silently keep the old flow version active during UI testing. Setting the flag to `true` **org-locally** removes the extra activation step for this sandbox. Sandboxes have no flow-test-coverage requirement, so this is safe; shared acceptance/production orgs are deliberately not targets of this skill.

0. **Precondition:** check the versioned Flow settings in the repo (`<Source Path from stack.config.md>/settings/Flow.settings-meta.xml`). If it versions `enableFlowDeployAsActiveEnabled` as `true`, skip this step (deploys already land active). If it versions `false`, note for sub-step 4 that later pipeline deploys will flip the org back.
1. Confirm with the user (recommended default: yes): "Enable deploy-as-active for flows in <alias>?" — on decline, skip and note it in the report (the Step 6 checklist item about flow activation then applies).
2. Generate a **temporary** MDAPI package (scratchpad — never inside the repo) containing only:
   - `package.xml` with `<types><members>Flow</members><name>Settings</name></types>`
   - `settings/Flow.settings` with `<enableFlowDeployAsActiveEnabled>true</enableFlowDeployAsActiveEnabled>`
   ```bash
   sf project deploy start --metadata-dir <tmpdir> -o <alias> --wait 10
   ```
3. **Never** modify the versioned Flow settings file — the repo value stays as-is.
4. Note (only when the repo versions `false`): a later pipeline deploy that includes the versioned Flow settings flips the org back to `false` — re-run this step if flow-activation surprises reappear.

### Step 3c: Enable admin Login-As (org-local)

**Background:** after a refresh, `enableAdminLoginAsAnyUser` ("Administrators Can Log in as Any User", Setup → Login Access Policies) is typically `false` — user records show no **Login** button and the `servlet.su` Login-As URL fails. Persona-based UI testing (different profiles / portal views: button visibility, related-list actions) needs Login-As. The flag is a plain `SecuritySettings` field; partial settings deploys change only the included fields.

0. **Precondition:** check the versioned Security settings in the repo (`<Source Path>/settings/Security.settings-meta.xml`). If it does **not** contain `enableAdminLoginAsAnyUser`, later pipeline deploys leave the flag untouched (no flip-back trap). If it **does**, warn the user that a later settings deploy will reset it to the versioned value.
1. Confirm with the user (recommended default: yes): "Enable 'Administrators Can Log in as Any User' in <alias>?" — on decline, skip and note it in the report.
2. Generate a **temporary** MDAPI package (scratchpad — never inside the repo) containing only:
   - `package.xml` with `<types><members>Security</members><name>Settings</name></types>`
   - `settings/Security.settings` with `<enableAdminLoginAsAnyUser>true</enableAdminLoginAsAnyUser>` — single field only
   ```bash
   sf project deploy start --metadata-dir <tmpdir> -o <alias> --wait 10
   ```
3. Verify (read-only): retrieve `Settings:Security` with `--target-metadata-dir` into a temp dir and grep for `<enableAdminLoginAsAnyUser>true</enableAdminLoginAsAnyUser>`; delete the temp dir afterwards.
4. Usage afterwards: Setup → Users → user → **Login**, or directly per URL:
   ```bash
   sf org open -o <alias> --path "/servlet/servlet.su?oid=<OrgId>&suorgadminid=<TargetUserId>&retURL=%2Flightning%2Fpage%2Fhome&targetURL=%2Flightning%2Fpage%2Fhome"
   ```

### Step 4: Check & publish Experience sites

> Run only after the Step 2 gate has passed.

1. Read the actual state from the org:
   ```bash
   sf data query -o <alias> -q "SELECT Name, Status, UrlPathPrefix FROM Network ORDER BY Name"
   ```
   If the org has no networks and the customer config has no `## Site Catalog`, report "no Experience sites" and continue with Step 5.
2. Offer a selection (multiSelect): per site show **name, org status, and the business keywords from the customer's site catalog** (apply the drift rules from `## Configuration`; list `ESW_*` networks for information only, do not offer them). Preselect any sites the catalog marks as the usual UI-test candidates. "None" is a valid choice.
3. For every selected site **with a known builder site** (catalog column):
   ```bash
   sf community publish --name "<site-display-name>" -o <alias>
   ```
   > The publish command expects the site **display name** (= network name) — **not** the Experience Bundle API name from the repo (publishing with the bundle name fails with `CommunityNotExistsError`). The builder-site column only indicates that a publishable Experience Builder site exists.
   Report the result (status/URL or job) per site. If a publish fails: report the error, continue with the remaining sites, finish with status `partial`. Sites without a known builder site: **do not publish** — report their status only and note them in the report (if needed, determine the builder site via `SELECT Name, MasterLabel, UrlPathPrefix FROM Site` and present it to the user for a decision).
4. Remind the user: site login testing is manual (member user, site URL); welcome emails stay suppressed by Deliverability=None.

### Step 5: Test data (delegation)

With `--no-testdata`: skip this step and note it in the final report.

Otherwise create the presets from the alias's row in `## Initializable Orgs` **one by one, in table order** — always invoked with the initialized alias, never manually via Apex/SOQL (logging and cleanup capability run through `/create-testdata`):

```
/create-testdata <alias> <preset-1>
/create-testdata <alias> <preset-2>
...
```

The org alias is always passed **explicitly** — a preset's default org may be a different (shared) org. Validation and creation logs are handled by `/create-testdata` itself.

**If a preset fails:** report the error, do **not** start the remaining presets automatically (data/cleanup state unclear) — ask the user how to proceed; log status `partial` at the end.

### Step 6: Final report & remaining checklist

Print a compact report: result per step (✓/⏭/⛔), created presets, published sites. Then list the **open manual items** this skill deliberately does not handle:

- [ ] Only if Step 3b was skipped (or later reverted by a settings deploy): activate flows after each deploy via the resolved **Flow Activation Script** (`stack.config.md` key, default `pipeline/platforms/salesforce/scripts/activate-latest-flows.sh`) — the org otherwise deploys flows as inactive
- [ ] Deliverability deliberately left at None — if email features need testing later, raise it deliberately and temporarily
- [ ] All items from `init-sandbox.config.md > ## Post-Init Checklist`, verbatim

### Step 7: Log

Write the JSON log via the log tool (never hand-author it) — also on abort (see abort rule), except with `--dry-run`:

```bash
pipeline/bin/log-skill \
  --skill init-sandbox --identifier <alias> --status <success|partial|failed> \
  --summary "<1-2 sentences: what was initialized or why it failed>" \
  --artifact "<report path, if any>" \
  --output "<compact per-step results>"
```

Result file: `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-<alias>-init-sandbox.json`. Status choice: `success` = all steps ✓; `partial` = e.g. test data skipped (`--no-testdata`), a single preset failed, or a site publish failed; `failed` = abort by guard, check, or gate.

## Error Handling

- **Missing `init-sandbox.config.md`**: abort with the creation hint from `## Configuration` — never fall back to hardcoded aliases or presets.
- **Alias in config but not authenticated**: Step 1 aborts with the login hint; not a config error.
- **Config drift (alias not in `stack.config.md > Org Aliases`)**: abort per Step 0.3 — reconcile the config files first.
- **`sf` CLI or `jq` missing**: abort with the install instruction.
- **Settings deploy fails (Step 3b/3c)**: show the deploy error, mark the step ⛔ in the report, and continue with the remaining steps — a failed convenience toggle must not block test data creation; final status `partial`.

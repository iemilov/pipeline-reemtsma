---
name: init-sandbox
description: Initialize a freshly refreshed Salesforce sandbox for development and personal UI testing, driven by the customer's init-sandbox.config.md — deliverability gate, org-local settings (flow deploy-as-active, admin login-as), user and permission fixes, custom setting and metadata values, named credentials, Experience sites, test data presets, and a manual checklist
argument-hint: "<org-alias> [--no-testdata] [--dry-run]"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. On any other platform, inform the user and abort.

## Purpose

After a sandbox refresh, a developer needs the same handful of things every time: no outgoing e-mails, deployable flows that land active, the ability to log in as test users, a few users and permission sets fixed, integration settings pointed at test endpoints, sites published, and test data loaded. This skill runs that list from a customer-specific config, with an explicit gate before anything that could send e-mail and a dry-run mode.

## When to Use / When NOT to Use

- Use right after a sandbox refresh, on a developer or UAT sandbox listed in the customer's config.
- Do NOT use on production or on any org not listed in `init-sandbox.config.md`.
- Do NOT use to deploy code — the pipeline does that.

## Configuration

- `pipeline/customer.config.md` — `Platform`, `Short Name`
- `pipeline/stack.config.md` — `## Org Configuration > Sandboxes`, source path, API version
- `pipeline/customers/<customer>/init-sandbox.config.md` — **required**, see structure below
- `pipeline/customers/<customer>/testdata.config.md` — presets, read by the delegated `/create-testdata` runs

### Structure of `init-sandbox.config.md`

| Section | Content | Required |
|---|---|---|
| `## Initializable Orgs` | table `Alias \| Test data presets (in order) \| Notes` — the allow-list; every alias must also exist in `stack.config.md` and must not have purpose "Production" | yes |
| `## Users` | table `Username pattern \| Action \| Notes` — users to activate, whose e-mail to un-mangle (sandbox appends `.invalid`), or to freeze | no |
| `## Permission Set Assignments` | table `Permission Set \| Users (usernames or "current user")` | no |
| `## Custom Settings and Metadata` | table `Object \| Record \| Field \| Value` — values to set for the sandbox (endpoints, toggles, test flags); custom metadata via a temporary deploy, custom settings via DML | no |
| `## Named Credentials` | table `Named Credential \| Sandbox endpoint \| Notes` — what to re-point; secrets are entered by the user in Setup, never stored here | no |
| `## Site Catalog` | table `Network \| Builder site \| Business context \| sendWelcomeEmail` — Experience sites to publish | no |
| `## Post-Init Checklist` | bullet list of manual items appended verbatim to the final report | no |

**If the file does not exist:** create it with these sections, each carrying a one-line comment on what belongs there and the org alias table pre-filled from `stack.config.md` with every non-production alias, then **stop** and tell the user to fill it in. Never initialize an org from a skeleton.

## Workflow

### Step 0: Arguments and guard

Parse `<org-alias>`, `--no-testdata`, `--dry-run`. The alias must be in `## Initializable Orgs` **and** in `stack.config.md` with a purpose that does not contain "Production". Otherwise abort with the allowed list.

With `--dry-run`, every step prints what it would do and asks no confirmation; nothing is deployed, updated or created.

### Step 1: Auth check

`sf org display --target-org <alias> --json` — connected, instance URL is a sandbox (`--sandbox` or `.my.salesforce.com` of a sandbox), username as expected. Abort otherwise.

### Step 2: Email deliverability → None (manual gate)

After a refresh the sandbox is on "System email only"; the target is **No access** so nothing, including Experience Cloud welcome e-mails, can leave the org.

1. `sf org open -o <alias> --path "/email-admin/editOrgEmailSettings.apexp"`
2. The user sets **Access level = No access** and saves.
3. Ask via `AskUserQuestion`: "Deliverability is set to No access and saved" — yes / no. Without yes: abort. There is no API to verify this setting; the confirmation is the verification.

Everything that could trigger e-mail (users, sites, test data) comes after this gate.

### Step 3: Org-local settings

**3a. Flow deploy-as-active.** Check `<source path>/settings/Flow.settings-meta.xml`; if it already versions `enableFlowDeployAsActiveEnabled = true`, skip. Otherwise ask (default yes), then deploy a temporary MDAPI package from the scratchpad containing only `package.xml` (`Settings: Flow`) and `settings/Flow.settings` with `<enableFlowDeployAsActiveEnabled>true</enableFlowDeployAsActiveEnabled>`:

```bash
sf project deploy start --metadata-dir <tmpdir> -o <alias> --wait 10
```

Never modify the versioned settings file. Note that a later pipeline deploy including the versioned settings flips the org back.

**3b. Admin login-as.** Same pattern with `Settings: Security` and `<enableAdminLoginAsAnyUser>true</enableAdminLoginAsAnyUser>` as the only field; verify by retrieving `Settings:Security` into a temp dir and grepping the value.

### Step 4: Users and permission sets

From `## Users`: for each row, query `SELECT Id, Username, Email, IsActive FROM User WHERE Username LIKE '<pattern>'`, show the matches and the action, confirm, then apply via `sf data update record` (activate, strip `.invalid` from the e-mail, freeze via `UserLogin.IsFrozen`). From `## Permission Set Assignments`: check existing assignments, create the missing ones via `sf data create record -s PermissionSetAssignment`. "current user" resolves to the `sf org display` username.

### Step 5: Custom settings, custom metadata, named credentials

- **Custom settings:** for each row, query the record, show current vs. target, confirm, update via `sf data update record`.
- **Custom metadata:** group rows per type, generate the record XML into a temporary deploy package, show the diff against the org values (retrieve first), confirm, deploy.
- **Named credentials:** show the table; for each credential open Setup (`sf org open -o <alias> --path "/lightning/setup/NamedCredential/home"`) and ask the user to confirm it was re-pointed. Secrets are never typed into the session.

### Step 6: Experience sites

Query `SELECT Name, Status, UrlPathPrefix FROM Network ORDER BY Name`. If the org has none and the config has no `## Site Catalog`, continue. Otherwise offer a multi-select of sites with status and business context; publish each selected site that has a known builder site with `sf community publish --name "<network name>" -o <alias>` (display name, not the bundle API name). Report per site; failures do not stop the run.

### Step 7: Test data

Skip with `--no-testdata`. For each preset in the org's row of `## Initializable Orgs`, in order, run `/create-testdata <alias> <preset>`; each run writes its own manifest. Report the manifest paths.

### Step 8: Final report and checklist

Table of steps with result (done / skipped / declined / failed / dry-run), the `## Post-Init Checklist` items verbatim, and the reminders: deliverability stays on No access; flow deploy-as-active may be reverted by the next pipeline deploy; site login testing is manual.

### Step 9: Log

Create `<YYYY-MM-DD>-<customer-short-name>-<alias>-init-sandbox.json` in `.claude/skills/27-init-sandbox/logs/` per the CLAUDE.md JSON schema; `success` when every configured step ran or was deliberately skipped, `partial` when any step failed, `failed` when the run aborted before Step 3.

## Important Rules

- Only aliases from `## Initializable Orgs`; never production.
- The deliverability gate comes before every step that can send e-mail; no exception.
- Every org-changing step is confirmed via `AskUserQuestion`; `--dry-run` changes nothing.
- Never modify versioned settings files in the repository; org-local changes go through temporary packages from the scratchpad.
- Secrets are never stored in the config or typed into the session.
- Read every alias, path and value from config; never hardcode.

## Error Handling

- **Config missing:** create the skeleton and stop.
- **Alias not allowed or production:** abort with the allowed list.
- **Auth failure:** abort with `sf org login web -a <alias>` hint.
- **Deliverability not confirmed:** abort before Step 3.
- **Temporary deploy fails:** show the error, skip the setting, continue, status `partial`.
- **User or record not found:** report, skip the row, continue.
- **Site publish fails:** report, continue with the remaining sites, status `partial`.
- **Test data preset fails:** the manifest documents what was created; report and continue.

---
name: user-licenses-review
description: Use when reviewing Salesforce user licenses — inventories every user, permission set and feature license with utilisation, finds licences wasted on inactive or dormant users, checks whether each user's licence type fits their actual usage, and optionally produces a recommendation for replacing shared admin accounts under phishing-resistant MFA and passkey requirements
argument-hint: [org-alias (optional, defaults to first org alias from stack.config.md)] [--shared-admin (include the shared-admin/passkey recommendation)]
---

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. If the customer uses a different platform, inform the user and abort with a clear message.

## Purpose

A short, focused licence audit answering three questions:

1. **What licences exist, how many are used, and how many are paid for but idle?**
2. **Which licences are held by users who cannot or do not use them** — inactive, dormant, or wrongly typed?
3. *(optional)* **How should shared admin accounts be replaced**, given that passkeys and phishing-resistant MFA are bound to a person and a device?

Read-only. It never deactivates a user, reassigns a licence, or changes a permission set.

## Configuration

Read before executing:
- `pipeline/customer.config.md` — customer identity, **Platform**, Short Name, documentation language
- `pipeline/stack.config.md` — org aliases

Resolve the org alias from `$ARGUMENTS`, otherwise the first alias in `stack.config.md`.
Include Step 4 if `--shared-admin` is passed **or** if Step 3 finds an account that looks shared.

## Workflow

### Step 1: Licence inventory

```bash
sf data query -o <org-alias> -r csv -q "SELECT Name, LicenseDefinitionKey, TotalLicenses, UsedLicenses, Status FROM UserLicense WHERE Status = 'Active' ORDER BY TotalLicenses DESC"
sf data query -o <org-alias> -r csv -q "SELECT MasterLabel, TotalLicenses, UsedLicenses, Status FROM PermissionSetLicense WHERE Status = 'Active' ORDER BY TotalLicenses DESC"
```

For each licence type record: total, used, free, and utilisation percentage. Flag both directions:

| Signal | Meaning |
|--------|---------|
| Utilisation < 60% with total > 5 | Over-provisioned — reclaim at the next renewal |
| Utilisation ≥ 95% | At capacity — plan ahead of the next hire |
| Used = 0, total > 0 | Paid for and untouched — cancel or repurpose |

Feature licences (`PermissionSetLicense`) are frequently forgotten and often the clearest waste.

### Step 2: Waste — licences held by users who do not use them

```bash
# active users per licence type
sf data query -o <org-alias> -r csv -q "SELECT Profile.UserLicense.Name, COUNT(Id) FROM User WHERE IsActive = true GROUP BY Profile.UserLicense.Name ORDER BY COUNT(Id) DESC"

# dormant but still consuming a licence
sf data query -o <org-alias> -r csv -q "SELECT Username, Name, Profile.Name, Profile.UserLicense.Name, LastLoginDate FROM User WHERE IsActive = true AND (LastLoginDate < LAST_N_DAYS:90 OR LastLoginDate = null) ORDER BY LastLoginDate ASC NULLS FIRST"

# never logged in at all
sf data query -o <org-alias> -r csv -q "SELECT Username, Name, CreatedDate, Profile.UserLicense.Name FROM User WHERE IsActive = true AND LastLoginDate = null"
```

Classify every active user:

| Class | Definition | Action |
|-------|-----------|--------|
| **Active** | Logged in within 90 days | Keep |
| **Dormant** | No login in 90+ days | Review with the manager; reclaim if the role has ended |
| **Never used** | Created, never logged in | Reclaim unless onboarding is pending |
| **Integration/service** | Non-human account | Check licence fit (Step 3) |

> Automated platform users (`Automated Process`, `Integration User`, Site Guest Users, `Data.com Clean`) do **not** consume a paid licence in the normal sense. Exclude them from waste figures and say so, or the numbers will be wrong.

Quantify: number of reclaimable licences per type. Convert to money only if a per-licence price is supplied — **never invent one**.

### Step 3: Licence fit

Check whether each user's licence matches what they actually do.

```bash
# users on a full Salesforce licence who may only need Platform
sf data query -o <org-alias> -r csv -q "SELECT Username, Name, Profile.Name, Profile.UserLicense.Name, LastLoginDate FROM User WHERE IsActive = true AND Profile.UserLicense.Name = 'Salesforce' ORDER BY LastLoginDate ASC NULLS FIRST"

# API-only / integration accounts
sf data query -o <org-alias> -r csv -q "SELECT Username, Name, Profile.Name, Profile.UserLicense.Name FROM User WHERE IsActive = true AND Profile.PermissionsApiEnabled = true"

# admins
sf data query -o <org-alias> -r csv -q "SELECT Username, Name, LastLoginDate, Profile.Name FROM User WHERE IsActive = true AND Profile.PermissionsModifyAllData = true ORDER BY LastLoginDate ASC NULLS FIRST"
```

Flag:

- **Integration accounts on a full Salesforce licence** — a Salesforce Integration licence is usually cheaper and more appropriate, and it removes interactive login as a side effect.
- **Users who only read reports/dashboards** on a full licence — candidates for a lower-tier licence.
- **Admin count vs. total users** — benchmark roughly 1 admin per 30 users; more than that is both a licence and a security question.
- **Accounts that look shared** — usernames such as `admin@`, `integration@`, `service@`, `persistent_admin@`, `deployment@`, or any account whose name is a function rather than a person. These are the input to Step 4.

### Step 4 *(optional)*: Shared admin accounts under passkey / phishing-resistant MFA

Run this step when `--shared-admin` is passed or Step 3 found a shared-looking privileged account.

#### 4a. Identify the accounts

```bash
sf data query -o <org-alias> -r csv -q "SELECT Username, Name, Email, LastLoginDate, CreatedDate, Profile.Name FROM User WHERE IsActive = true AND Profile.PermissionsModifyAllData = true ORDER BY Name"
sf data query -o <org-alias> -r csv -q "SELECT Assignee.Username, PermissionSet.Label FROM PermissionSetAssignment WHERE PermissionSet.Label LIKE '%MFA%' OR PermissionSet.Label LIKE '%Disable%'"
```

For each privileged account, determine: is it a named human, or is it used by several people?

Indicators of a shared account: a generic username, an email that is a distribution list or shared mailbox, logins from many different IPs, or several people knowing the password.

#### 4b. Why passkeys break shared accounts

State this plainly in the report, because it is the crux of the recommendation:

> A passkey (and any security key or platform authenticator) is **bound to a specific person and a specific device**. It cannot be copied or handed over the way a password can. For a shared account this leaves only bad outcomes:
>
> - **One person registers the passkey** → in practice only that person can log in; the account stops being shared and becomes an undocumented single point of failure, usually discovered during an incident when that person is unavailable.
> - **The authenticator is shared** (device passed around, or the vault holds an exportable credential) → the phishing-resistance benefit is lost, and so is any ability to attribute an action to a person.
> - **A weaker method is kept as an exemption** → the account with the highest privilege in the org becomes the one with the weakest authentication. That is the exact inversion of what the control is for.
>
> There is no configuration that makes a shared account work well with a personal, device-bound credential. The resolution is organisational: stop sharing the account.

> **Verify the current requirement before quoting deadlines.** Salesforce's MFA and phishing-resistant authentication requirements have changed repeatedly and continue to. Check Setup > Identity Verification and the current Salesforce release notes / MFA requirement page for the state that applies to this org and contract, rather than relying on a date stated in this skill or in a previous report.

#### 4c. Recommended target model

Present these four options with a clear recommendation, adapted to what Step 4a actually found:

| # | Pattern | Use for | Notes |
|---|---------|---------|-------|
| **1** | **Named admin accounts + Permission Set Groups** | Every human who needs admin rights | The default answer. Each person has their own account and their own passkey. Attribution works, offboarding works, passkeys work as designed. |
| **2** | **Integration user, API-only** | System-to-system access currently running through a shared admin | No interactive login at all, so no MFA/passkey question arises. Restrict by IP, use OAuth with a connected app, scope permissions to the objects actually needed. A Salesforce Integration licence usually fits. |
| **3** | **Just-in-time elevation** | Occasional admin needs | Users hold a base licence and are granted an admin Permission Set Group temporarily via an approval process, then it is removed. Reduces the standing admin count and the licence draw. |
| **4** | **Break-glass account** | Genuine emergency access only | **One** account, credentials sealed in the password vault, its passkey held by a named security owner on a dedicated device. Alert on every login. Rotate the credential after each use. Document who may open it and when. This is the only legitimate remaining use of a non-personal privileged account. |

**Recommendation to give:** replace the shared account with pattern 1 for people and pattern 2 for systems, keeping at most one pattern-4 break-glass account. Patterns 1 and 2 usually cover everything the shared account was doing; the break-glass account exists for the case where SSO or the IdP itself is unavailable.

#### 4d. Migration outline

Include a concrete, ordered path — it is the part that determines whether the recommendation is adopted:

1. **Inventory the usage.** Establish what the shared account is actually used for: interactive admin work, deployments, integrations, scheduled jobs, connected apps. Check `OAuthToken` (`AppName`, `LastUsedDate`, `UseCount`) and `LoginHistory` for the account.
2. **Split by purpose.** Every distinct use becomes either a named human account or a dedicated integration user.
3. **Move automation first.** Reassign scheduled jobs, connected apps and integrations to the new integration user. This is the risky part — automation breaks silently when an owner changes.
4. **Provision the humans.** Named accounts, admin rights via Permission Set Group, passkey enrolled per person.
5. **Run both in parallel briefly**, monitoring `LoginHistory` on the old account to catch anything missed.
6. **Freeze, then deactivate** the shared account once its login history is quiet. Freezing first is reversible; deactivation frees the licence.
7. **Revoke its OAuth tokens** explicitly — deactivating a user does not always invalidate every issued token.

Note the licence effect: splitting one shared account into N named accounts **consumes N licences**, but usually reclaims more through Steps 2 and 3 than it costs. State the net figure.

### Step 5: Report

Save to `org_assessment/<YYYY-MM-DD>-user-licenses-review.md`, in the **documentation language** from `customer.config.md`. Create the directory if missing.

Structure:

1. **Summary** — licence types in use, total vs used, overall utilisation, reclaimable count, and a one-paragraph verdict.
2. **Licence inventory** — table per user licence and permission set licence: total, used, free, utilisation, assessment.
3. **Waste** — dormant and never-used accounts holding licences, grouped by licence type, with the reclaimable total.
4. **Licence fit** — integration accounts on full licences, admin count vs. benchmark, downgrade candidates.
5. **Shared admin accounts** *(if Step 4 ran)* — findings, why passkeys change the picture, the four patterns, the recommendation, and the migration outline.
6. **Action plan** — prioritised, each item with the licences reclaimed and an effort estimate.
7. **Appendix** — anything that could not be verified (contract terms, per-licence pricing, Setup-only settings).

### Step 6: Log

Create `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-user-licenses-review.json` in `.claude/skills/21-user-licenses-review/logs/`, using the standard JSON schema from CLAUDE.md. Include totals, utilisation and reclaimable counts.

### Step 7: Summary to the user

Present: licence types and utilisation, reclaimable licence count by type, admin count vs. benchmark, the shared-account finding and recommendation if Step 4 ran, and the report path.

## Important Rules

- **Read-only.** Never deactivate a user, change a licence, or modify a permission set assignment.
- **Never invent licence prices.** Report reclaimable licences as counts; mark any monetary figure as input required from the account team.
- **Exclude platform-internal users** (Automated Process, Site Guest Users, Data.com Clean) from waste figures — they do not consume purchased licences.
- **Do not state a passkey or MFA deadline as fact.** Requirements change; direct the reader to Setup > Identity Verification and the current Salesforce documentation.
- A dormant user is a question for their manager, not automatically a licence to reclaim — someone on long-term leave still needs their account.
- When recommending a break-glass account, always pair it with alerting and credential rotation. An unmonitored emergency account is worse than the shared account it replaced.
- Read org aliases from config. Never hardcode.
- Output text uses the **documentation language** from `customer.config.md`.

## Error Handling

- **No org access:** this skill is almost entirely org-dependent. Report that clearly, list the queries that need to be run, and stop rather than producing an empty report.
- **`UserLicense` or `PermissionSetLicense` not queryable:** fall back to Setup > Company Information > User Licenses and note it as a manual step.
- **Aggregate query blocked on `User`:** query without `GROUP BY` and aggregate locally.
- **`org_assessment/` missing:** create it.

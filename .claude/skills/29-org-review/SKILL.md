---
name: org-review
description: Use when reviewing the health of a Salesforce org — one read-only audit with five selectable modules (security, reports & dashboards, storage, layouts & Lightning pages, user licences), each scored, with a consolidated report, per-module action plans, cleanup artefacts and a governance model. Replaces security-orgreview, reportsanddashboards-review, storage-review, layouts-lightning-review and user-licenses-review
argument-hint: [org-alias] [--modules security,reports,storage,layouts,licenses | all] [--days N] [--object <ApiName>] [--shared-admin] [--separate-reports]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. If the customer uses a different platform, inform the user and abort with a clear message.

## Purpose

One read-only audit of a Salesforce org, organised in five **modules** that used to be five separate skills:

| Module | `--modules` key | Question it answers | Replaces |
|---|---|---|---|
| A — Security | `security` | Is the org secure in code, configuration, data, integrations and process? | `/security-orgreview` |
| B — Reports & Dashboards | `reports` | Which reports and dashboards are unused, orphaned or broken, and how do we stop the sprawl? | `/reportsanddashboards-review` |
| C — Storage | `storage` | Where is data and file storage going, when is the cap reached, is cleanup cheaper than buying? | `/storage-review` |
| D — Layouts & Lightning | `layouts` | Which layouts and Lightning pages are unassigned, duplicated, heavy or still Classic-era? | `/layouts-lightning-review` |
| E — User Licences | `licenses` | Which licences are paid for but idle, wrongly typed, or held by shared admin accounts? | `/user-licenses-review` |

Every module produces the same shape: an inventory, findings with evidence, a **score out of 100** with a traffic light, a phased action plan, and a governance section. The run produces **one consolidated report** with a health dashboard across all modules run, plus per-module cleanup artefacts.

**Everything is read-only.** The skill never deletes, modifies, deactivates, reassigns or reconfigures anything in the org or in source. It generates artefacts; a human reviews and executes them.

## When to Use / When NOT to Use

- Use for a periodic org health check (all modules), or a focused audit of one area (`--modules storage`).
- Use to track improvement over time — the delta section compares against the previous run in `org_assessment/`.
- Do NOT use for AI readiness scoring — that is `/ai-readiness-assessment`.
- Do NOT use for general code quality — that is `/code-review`; module A only references its security-relevant findings.
- Do NOT use to execute cleanups — this skill only produces the plan and the artefacts.

## Configuration

Before executing, read:

- `pipeline/customer.config.md` — customer identity, **Platform**, Short Name, documentation language, Atlassian settings
- `pipeline/stack.config.md` — source path, org aliases, API version, naming prefixes, PMD rules file, key objects
- `pipeline/customer.domain.md` — business-critical objects and fields, sensitive data, reporting domains, statutory retention — so no module proposes removing something the business must keep

Resolve inputs from `$ARGUMENTS`:

| Input | Resolution |
|---|---|
| **Org alias** | first token if it does not start with `--`; otherwise the first org alias from `stack.config.md` |
| **Modules** | `--modules` comma list, or `all` (default). Unknown keys abort with the list of valid keys |
| **Dormancy threshold** (B) | `--days N`, default **180** |
| **Object filter** (D) | `--object <ApiName>` restricts module D to one object; say so in the report |
| **Shared-admin analysis** (E) | `--shared-admin` forces E-4; it also runs automatically when E-3 finds a shared-looking privileged account |
| **Report layout** | `--separate-reports` writes one file per module instead of the consolidated report (for handing single chapters to different owners) |

Resolve `<source-path>` from `stack.config.md`. Never hardcode paths, object names, field names, org aliases or prices.

If the user runs the skill without arguments interactively, ask one question: which modules to run (multi-select, default all). Do not ask anything else up front — every other value has a default.

## Workflow

| Step | Content |
|---|---|
| 0 | Platform Guard, resolve inputs, confirm org access |
| 1 | **Shared evidence** — queries several modules need, run once |
| 2 | Run the selected modules (A–E), in the order given below |
| 3 | Consolidate: health dashboard, cross-module findings, action plan |
| 4 | Write the report and the cleanup artefacts |
| 5 | Delta against the previous run |
| 6 | Log file and summary to the user |

### Step 0: Access check

```bash
sf org display -o <org-alias> --json
```

If the org is unreachable, do **not** abort: run every source-based check, route every org-dependent check to the *Verification gaps* appendix of each module, and mark the affected score dimensions as **unverified** rather than scoring them zero or full. Module E is almost entirely org-dependent — for E alone, report that clearly, list the queries to run, and skip the module.

### Step 1: Shared evidence

These queries feed more than one module. Run them once, keep the CSVs under `org_assessment/evidence/<YYYY-MM-DD>/`, and let every module read from there instead of re-querying.

```bash
mkdir -p org_assessment/evidence/<YYYY-MM-DD>
# users — used by A-3, B-4, E-2, E-3
sf data query -o <org-alias> -r csv -q "SELECT Id, Username, Name, Email, IsActive, LastLoginDate, CreatedDate, Profile.Name, Profile.UserLicense.Name, Profile.PermissionsModifyAllData, Profile.PermissionsApiEnabled, UserType FROM User ORDER BY LastLoginDate ASC NULLS FIRST" > org_assessment/evidence/<YYYY-MM-DD>/users.csv
# scheduled jobs — used by A-1g, C-5
sf data query -o <org-alias> -r csv -q "SELECT CronJobDetail.Name, CronJobDetail.JobType, State, NextFireTime, PreviousFireTime, CreatedBy.Name FROM CronTrigger ORDER BY State, NextFireTime" > org_assessment/evidence/<YYYY-MM-DD>/cronjobs.csv
# org limits — used by C-1, and for context in A
sf org limits list -o <org-alias> --json > org_assessment/evidence/<YYYY-MM-DD>/limits.json
# history tracking in source — used by A-7d, C-3a
grep -rln 'enableHistory>true' <source-path>/objects/ --include='*.object-meta.xml' 2>/dev/null > org_assessment/evidence/<YYYY-MM-DD>/history-objects.txt
grep -rc 'trackHistory>true' <source-path>/objects/*/fields/*.field-meta.xml 2>/dev/null | grep -v ':0' > org_assessment/evidence/<YYYY-MM-DD>/history-fields.txt
```

> Platform-internal users (`Automated Process`, `Integration User`, Site Guest Users, `Data.com Clean`) appear in `users.csv`. Every module that counts users must exclude them and say so, or admin counts, dormancy and licence waste figures will be wrong.

### Step 2: Modules

Run only the selected modules. Each module ends with its own score, its own action plan and its own governance rules; Step 3 consolidates them.

---

## Module A — Security

A read-only **security posture assessment** — code, configuration, data, integrations, process. Not performance, not architecture modernisation, except where security-relevant.

### Assessment domains

| # | Domain | Weight | Focus |
|---|---|---|---|
| 1 | **Apex Security** | 20 | CRUD/FLS enforcement, sharing keywords, SOQL/SOSL injection, hard-coded secrets, insecure deserialization, error handling and information disclosure |
| 2 | **UI Layer Security** (VF / Aura / LWC) | 15 | XSS, CSRF, CSP violations, open redirects, DOM injection, insecure client-side storage |
| 3 | **Access & Permission Model** | 20 | Profiles vs. Permission Sets, `View All`/`Modify All`, dangerous system permissions, admin count, guest/Experience Cloud users, orphaned access |
| 4 | **Data Protection & Privacy** | 15 | PII discovery and classification, encryption, field-level security, data retention, test data in prod, compliance tagging |
| 5 | **Integration & Credential Security** | 15 | Named Credentials vs. hard-coded endpoints and keys, Connected Apps, OAuth scopes, API users, CORS/trusted sites, remote sites, inbound endpoints |
| 6 | **Org & Session Configuration** | 10 | Health Check, password/session policy, MFA, login IP ranges, login hours, certificates, My Domain, clickjack protection |
| 7 | **Monitoring, Audit & Response** | 5 | Setup Audit Trail, Event Monitoring / Shield, transaction security policies, field history tracking, incident response readiness |

Cross-cutting: PMD security ruleset over all Apex, a secret scan over the whole repository, and a reference to `/code-review` output for general quality.

### A-1: Apex Security

**1a. CRUD / FLS enforcement**

```bash
grep -rn 'WITH SECURITY_ENFORCED\|WITH USER_MODE\|Security\.stripInaccessible\|AccessType\.' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
grep -rn 'isAccessible()\|isCreateable()\|isUpdateable()\|isDeletable()' <source-path>/classes/ --include='*.cls'
grep -rln '\[SELECT\|insert \|update \|delete \|upsert ' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
```

Every class in the third list but in neither of the first two is an **FLS/CRUD gap** — record path, operation and object. Critical when the class is `without sharing` or exposed via `@AuraEnabled`, `@RestResource`, `webservice` or a guest-accessible surface; High otherwise.

**1b. Sharing keywords**

```bash
grep -rn 'without sharing' <source-path>/classes/ --include='*.cls'
grep -rn 'inherited sharing' <source-path>/classes/ --include='*.cls'
grep -rLn 'with sharing\|without sharing\|inherited sharing' <source-path>/classes/ --include='*.cls'
```

`without sharing` reachable from a controller, `@AuraEnabled`, REST resource or Flow invocable → Critical. No sharing keyword → High. For each `without sharing` class, read it and document why the elevation exists and whether it can be narrowed to an inner class.

**1c. SOQL / SOSL / DML injection**

```bash
grep -rn 'Database\.query\|Database\.queryWithBinds\|Search\.query' <source-path>/classes/ --include='*.cls'
grep -rnE 'Database\.query\(.*\+' <source-path>/classes/ --include='*.cls'
grep -rn 'String\.escapeSingleQuotes' <source-path>/classes/ --include='*.cls'
```

Flag every concatenated dynamic query without `escapeSingleQuotes` or bind variables — Critical when the value comes from a request parameter, `@AuraEnabled` argument or REST body. Also flag dynamic object/field names taken from input (`getSObjectType()`, `getGlobalDescribe()`, dynamic SObject construction).

**1d. Hard-coded secrets** — scan the whole repository:

```bash
grep -rnEi '(api[_-]?key|apikey|secret|client[_-]?secret|passwd|password|private[_-]?key|bearer|authorization)\s*[:=]' <source-path>/ | grep -v 'Test\.cls'
grep -rnE 'AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.' <source-path>/
grep -rn 'sf-[a-zA-Z0-9]\{20,\}\|xox[baprs]-' <source-path>/
grep -rniE '(password|secret|token)' <source-path>/ --include='*.customMetadata-meta.xml' --include='*.labels-meta.xml' --include='*.settings-meta.xml' --include='*.flow-meta.xml'
```

Every confirmed hit is **Critical** and **compromised**: the remedy is rotation plus removal from git history, not deleting the line. Recommend Named/External Credentials or protected Custom Metadata. Never paste the value into the report — `file:line` with the value redacted.

**1e. Insecure patterns and information disclosure**

```bash
grep -rn 'JSON\.deserializeUntyped\|JSON\.deserialize(' <source-path>/classes/ --include='*.cls'
grep -rn 'Crypto\.' <source-path>/classes/ --include='*.cls'
grep -rn 'catch\s*(\w*Exception\s*\w*)\s*{\s*}' <source-path>/classes/ --include='*.cls'
grep -rn 'getMessage()\|getStackTraceString()' <source-path>/classes/ --include='*.cls'
grep -rn 'System\.debug' <source-path>/classes/ --include='*.cls' | grep -iE 'password|token|secret|key|ssn|iban'
```

Flag weak crypto (MD5/SHA-1, static IV, `Math.random()` for tokens), empty catch blocks (High), exception messages or stack traces returned to the client (Medium–High), sensitive values in debug logs (High).

**1f. Exposed entry points**

```bash
grep -rn '@AuraEnabled' <source-path>/classes/ --include='*.cls'
grep -rn '@RestResource\|@HttpGet\|@HttpPost\|@HttpPut\|@HttpDelete\|@HttpPatch' <source-path>/classes/ --include='*.cls'
grep -rn 'webservice ' <source-path>/classes/ --include='*.cls'
grep -rn '@InvocableMethod' <source-path>/classes/ --include='*.cls'
grep -rn 'global class' <source-path>/classes/ --include='*.cls'
```

Build the **attack surface inventory**: entry point, class, sharing keyword, FLS enforced, input validated, guest-accessible. `without sharing` + no FLS = Critical.

**1g. Trigger and async context**

```bash
grep -rn 'System\.runAs' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
grep -rn '@future\|System\.enqueueJob\|Database\.executeBatch' <source-path>/classes/ --include='*.cls'
```

Async runs in system mode; flag async classes doing DML on sensitive objects without re-applying FLS. Cross-check `cronjobs.csv` for jobs owned by a user who has left.

### A-2: UI Layer Security

**2a. Visualforce**

```bash
find <source-path>/pages/ -name '*.page' 2>/dev/null | wc -l
grep -rn '<form ' <source-path>/pages/ --include='*.page'
grep -rn '<script\|<style' <source-path>/pages/ --include='*.page'
grep -rn 'escape="false"' <source-path>/pages/ --include='*.page'
grep -rn 'showHeader="false"\|standardStylesheets="false"' <source-path>/pages/ --include='*.page'
```

Unencoded `{! }` merge fields and `escape="false"` → XSS; raw `<form>` → CSRF; inline script/style → CSP. Custom controllers behind pages need the CRUD/FLS check from 1a.

**2b. Aura**

```bash
grep -rn 'navigateToURL\|window\.location\|window\.open' <source-path>/aura/ --include='*.js'
grep -rn 'aura:unescapedHtml' <source-path>/aura/ --include='*.cmp'
grep -rn 'localStorage\|sessionStorage\|document\.cookie' <source-path>/aura/ --include='*.js'
grep -rn 'access="global"' <source-path>/aura/ --include='*.cmp'
```

**2c. LWC**

```bash
grep -rn 'lwc:dom="manual"\|innerHTML\|outerHTML\|eval(\|new Function(' <source-path>/lwc/ --include='*.js' --include='*.html'
grep -rn '<script src=\|fetch(\|XMLHttpRequest' <source-path>/lwc/ --include='*.js' --include='*.html'
grep -rn 'localStorage\|sessionStorage\|document\.cookie' <source-path>/lwc/ --include='*.js'
grep -rn 'isExposed>true' <source-path>/lwc/ --include='*.js-meta.xml'
```

Manual DOM + `innerHTML`, `eval`, `new Function` → Critical. External `fetch`/script → must go through Named Credential + Apex. `isExposed` components combined with a `without sharing` controller are a data-exposure path.

**2d. Experience Cloud / guest user**

```bash
find <source-path> -name '*.site-meta.xml' -o -name '*.network-meta.xml' 2>/dev/null
find <source-path>/profiles/ -name '*Guest*' 2>/dev/null
```

For each guest profile: any create/edit/delete, `ViewAllData`, Apex class access to classes lacking FLS, VF page access → **Critical**. Add the manual check that "Secure guest user record access" is enabled.

### A-3: Access & Permission Model

**3a. Elevated system permissions**

```bash
sf data query -o <org-alias> --json -q "SELECT Name, PermissionsViewAllData, PermissionsModifyAllData, PermissionsAuthorApex, PermissionsCustomizeApplication, PermissionsManageUsers, PermissionsApiEnabled FROM Profile WHERE PermissionsViewAllData = true OR PermissionsModifyAllData = true OR PermissionsAuthorApex = true OR PermissionsManageUsers = true"
sf data query -o <org-alias> --json -q "SELECT Name, Label, PermissionsViewAllData, PermissionsModifyAllData, PermissionsAuthorApex, PermissionsManageUsers, PermissionsApiEnabled FROM PermissionSet WHERE PermissionsViewAllData = true OR PermissionsModifyAllData = true OR PermissionsAuthorApex = true OR PermissionsManageUsers = true"
grep -rn 'ModifyAllData\|ViewAllData\|AuthorApex\|ManageUsers\|CustomizeApplication\|ViewSetup' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
```

**3b. Admin and privileged users** — from `users.csv`: count active users with `PermissionsModifyAllData`, exclude platform-internal users. Benchmark ~1 admin per 30 users; every admin a named human. Flag admins dormant 90+ days. Shared-looking privileged accounts are handed to module E-4 when it runs; otherwise report them here.

**3c. Dormant, orphaned and integration users** — from `users.csv`: active users dormant 90+ days, API-enabled service accounts with interactive login, service accounts without IP restrictions. When module E runs, reference its waste table instead of repeating the list.

**3d. Permission set vs. profile hygiene**

```bash
sf data query -o <org-alias> --json -q "SELECT PermissionSet.Name, COUNT(Id) assignments FROM PermissionSetAssignment WHERE PermissionSet.IsOwnedByProfile = false GROUP BY PermissionSet.Name ORDER BY COUNT(Id) DESC"
```

Flag sets assigned to nearly everyone and sets with zero assignments. Target: minimal base profile + Permission Set Groups with muting.

**3e. Sharing model**

```bash
grep -rn 'sharingModel' <source-path>/objects/ --include='*.object-meta.xml'
find <source-path> -name '*.sharingRules-meta.xml' 2>/dev/null
grep -rn 'externalSharingModel' <source-path>/objects/ --include='*.object-meta.xml'
grep -rn '__Share\|ShareAccessLevel\|RowCause\|AccountShare\|OpportunityShare' <source-path>/classes/ --include='*.cls'
```

Flag permissive OWD on sensitive objects (from `customer.domain.md`), over-permissive external sharing, Apex managed sharing without review, missing restriction rules on broad OWD.

**3f. FLS spot check** on the sensitive fields from A-4a:

```bash
grep -rn -A3 '<field>.*<SensitiveFieldApiName>' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
```

### A-4: Data Protection & Privacy

**4a. PII discovery**

```bash
sf data query -o <org-alias> --json -q "SELECT QualifiedApiName, EntityDefinition.QualifiedApiName, DataType, SecurityClassification, ComplianceGroup FROM FieldDefinition WHERE IsCustom = true AND (QualifiedApiName LIKE '%Email%' OR QualifiedApiName LIKE '%Phone%' OR QualifiedApiName LIKE '%SSN%' OR QualifiedApiName LIKE '%Birth%' OR QualifiedApiName LIKE '%Address%' OR QualifiedApiName LIKE '%IBAN%' OR QualifiedApiName LIKE '%Tax%' OR QualifiedApiName LIKE '%Passport%' OR QualifiedApiName LIKE '%Salary%' OR QualifiedApiName LIKE '%Health%')"
grep -rlEi 'email|phone|ssn|birth|iban|passport|salary|tax|geburt|adresse' <source-path>/objects/*/fields/ 2>/dev/null
```

Add domain-specific sensitive fields from `customer.domain.md`. Build the PII inventory: object, field, type, classification, compliance group, encrypted, FLS-restricted.

**4b. Classification coverage** — PII fields with null `SecurityClassification` or `ComplianceGroup` are untagged; report coverage as a percentage. Manual action: Setup > Data Classification.

**4c. Encryption**

```bash
find <source-path> -name '*.EncryptionKeySettings*' -o -name '*.platformEncryptionSettings*' 2>/dev/null
grep -rn 'EncryptedText' <source-path>/objects/ --include='*.field-meta.xml'
```

Flag PII fields neither Classic-encrypted nor under Shield. Manual: verify encryption policy and tenant secret rotation.

**4d. Retention and test data in production**

```bash
sf data query -o <org-alias> --json -q "SELECT COUNT(Id) FROM Contact WHERE LastModifiedDate < LAST_N_YEARS:5"
sf data query -o <org-alias> --json -q "SELECT COUNT(Id) FROM Lead WHERE Email LIKE '%test%' OR Email LIKE '%example.com'"
```

When module C runs, reference its retention-gap table (C-5) instead of repeating it — the GDPR angle belongs here, the volume angle there.

**4e. Export and exfiltration paths**

```bash
grep -rn 'PermissionsDataExport\|PermissionsWeeklyDataExport\|PermissionsExportReport\|PermissionsRunReports' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
```

### A-5: Integration & Credential Security

**5a. Named Credentials vs. hard-coded endpoints**

```bash
find <source-path> -name '*.namedCredential-meta.xml' -o -name '*.externalCredential-meta.xml' 2>/dev/null
grep -rn 'callout:' <source-path>/classes/ --include='*.cls'
grep -rnE 'setEndpoint\(\s*['"'"'"]https?://' <source-path>/classes/ --include='*.cls'
grep -rn 'new HttpRequest\|new Http(' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
```

Literal `setEndpoint` URL → High (Critical with an embedded credential). Any `http://` endpoint → Critical.

**5b. Named / External Credential configuration** — per credential: protocol (prefer OAuth/JWT over password), manual re-adding of headers, `allowMergeFieldsInHeader/Body` combined with debug logging, named principal with broad access.

**5c. Connected Apps and OAuth**

```bash
sf data query -o <org-alias> --json -q "SELECT Name, CreatedDate, LastModifiedDate FROM ConnectedApplication"
find <source-path> -name '*.connectedApp-meta.xml' 2>/dev/null
grep -rn 'scopes\|oauthConfig\|refreshTokenPolicy\|ipRanges' <source-path>/connectedApps/ 2>/dev/null
```

Flag `full` scope, infinite refresh tokens, relaxed IP restrictions, self-authorising users, apps untouched for 12+ months or without an owner.

**5d. Remote sites, trusted sites, CORS**

```bash
find <source-path> -name '*.remoteSiteSetting-meta.xml' 2>/dev/null
find <source-path> -name '*.cspTrustedSite-meta.xml' 2>/dev/null
find <source-path> -name '*.corsWhitelistOrigin-meta.xml' 2>/dev/null
```

Flag `http://`, wildcard origins, `unsafe-inline`/`unsafe-eval`, entries without an owner.

**5e. Inbound API surface** — for each `@RestResource`/`webservice` from 1f: authentication enforced, input bound, minimal response, rate limiting.

### A-6: Org & Session Configuration

Mostly Setup-only; emit exact manual instructions where the CLI cannot reach.

- **6a. Health Check** — manual: record score and export High-Risk settings; target ≥ 90 %, minimum 80 %.
- **6b. Password and session policy**

  ```bash
  find <source-path> -name '*.securitySettings-meta.xml' -o -name 'Security.settings-meta.xml' 2>/dev/null
  grep -rn 'sessionTimeout\|lockoutInterval\|minimumPasswordLength\|passwordExpiration\|forceLogoutOnSessionTimeout\|enableCSRFOnGet\|enableClickjackUserPageHeaderless' <source-path> --include='*.settings-meta.xml' 2>/dev/null
  ```

  Baseline: password length ≥ 10, complexity, expiry ≤ 90 days, history ≥ 5; session timeout ≤ 2 h (≤ 30 min privileged), force logout, lock to IP where feasible; clickjack and CSRF protection on; HttpOnly required.
- **6c. MFA and authentication** — manual: MFA enforced for all interactive logins, no "Waive MFA" grants. **Do not state an MFA or passkey deadline as fact** — requirements change; point to Setup > Identity Verification and current Salesforce documentation.

  ```bash
  grep -rn 'PermissionsMultiFactorAuthUiLogins\|MFA' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
  find <source-path> -name '*.samlSsoConfig-meta.xml' -o -name '*.authProvider-meta.xml' 2>/dev/null
  ```
- **6d. Login restrictions** — `grep -rn 'loginIpRanges\|loginHours' <source-path>/profiles/`; flag privileged profiles without either.
- **6e. Certificates and My Domain** — manual: certificates expiring within 90 days or < 2048 bit; My Domain deployed, legacy redirects off, HTTPS-only.

### A-7: Monitoring, Audit & Response

- **7a. Setup Audit Trail** — manual: export the last 6 months; the trail retains 180 days, recommend automated export.
- **7b. Event Monitoring / Shield** — manual: which event types stream to the SIEM.
- **7c. Transaction Security Policies** — manual: large export, anomalous login, credential stuffing, session hijacking, admin permission set assignment.
- **7d. Field history** — from the shared `history-*.txt`: sensitive fields (A-4a) without tracking, objects without history.
- **7e. Incident response readiness** — qualitative, ask if unknown: documented plan and owner, tested token/session revocation, restorable backups, offboarding checklist.

### A-8: PMD security ruleset

```bash
pmd check -d <source-path>/classes/ -R <pmd-rules-file> -f json --no-cache
```

Filter to `category/apex/security.xml` (`ApexCRUDViolation`, `ApexSharingViolations`, `ApexSOQLInjection`, `ApexOpenRedirect`, `ApexInsecureEndpoint`, `ApexXSSFromURLParam`, `ApexXSSFromEscapeFalse`, `ApexBadCrypto`, `ApexCSRF`, `ApexDangerousMethods`, `ApexSuggestUsingNamedCred`). Report each with file, line, rule, fix. If PMD is missing, add "install PMD and wire the security ruleset into CI" as a High action and mark the check unverified.

### A-9: Code review cross-reference

If a recent `/code-review` output exists, reference its security-relevant findings; otherwise note that it has not been run. Do not invoke it from here — a full code review is a separate, longer run.

### A-10: Score

| Domain | Weight | Deductions |
|---|---|---|
| Apex Security | 20 | CRUD/FLS gap on exposed entry point −5 each (max −10); `without sharing` on exposed class −4 each (max −8); SOQL injection −5 each; hard-coded secret −5 each; weak crypto −3; empty catch −1 each (max −3); info disclosure −2 each (max −4) |
| UI Layer | 15 | XSS −5 each (max −10); CSRF −3 each; open redirect −3 each; CSP violation −2 each (max −4); secrets in client storage −3; guest-accessible component with unenforced controller −5 |
| Access & Permissions | 20 | Modify All Data grant −3 each (max −9); View All Data −2 each (max −6); excess admins −3; dormant privileged users −2 (max −4); over-assigned permission set −2 each (max −4); OWD ReadWrite on sensitive object −3 each (max −6); guest profile over-permissioned −8 |
| Data Protection | 15 | Untagged PII field −1 each (max −5); unencrypted Restricted field −3 each (max −6); no retention policy −3; test data in prod −2; broad export permissions −2 |
| Integration & Credentials | 15 | Hard-coded endpoint −2 each (max −6); `http://` endpoint −5 each; full-scope Connected App −3 each (max −6); self-authorising app −3; wildcard CORS −3 each; unauthenticated REST endpoint −5 each |
| Org & Session Config | 10 | Health Check < 80 % −4; weak password policy −2; session timeout > 2 h −2; clickjack/CSRF off −2 each; MFA not enforced −5; no IP restriction on privileged profiles −2 |
| Monitoring & Audit | 5 | No Event Monitoring −2; no transaction security policies −1; sensitive fields without history −1; no incident response plan −1 |

Floor each domain at 0. Traffic light: ≥ 85 green, 60–84 yellow, < 60 red. **Any single Critical finding forces red** regardless of score — for the module and for the overall dashboard.

### A-11: Chapter content

1. Summary — score, traffic light, per-domain table, findings by severity, top 5 for a non-technical reader, verdict.
2. Critical findings in full — what, exact location, realistic exploitation, business impact, exact fix.
3. One section per domain: score, findings table (ID, finding, location, severity, evidence), recommendations (what, why, effort S/M/L/XL, priority, owner role), preventive improvements.
4. Attack surface inventory (1f, guest surfaces, inbound APIs).
5. PII inventory (4a).
6. Security technical debt table — control, current state, target, pass/fail (CRUD/FLS, sharing, injection, secrets, permission model, PII, transport, authentication, session hardening, monitoring).
7. PMD security findings.
8. Code review cross-reference.
9. Remediation plan — numbered table (finding, domain, severity, fix, owner, effort, automatable), grouped P0 fix now / P1 this sprint / P2 next quarter / P3 backlog, with quick wins under a day and exact Setup paths for manual tasks.
10. Verification gaps.

---

## Module B — Reports & Dashboards

Two deliverables: the **audit** of every unused report and dashboard with the evidence behind each verdict, and a **governance plan** that stops sprawl from returning.

### Classification model

| Status | Definition |
|---|---|
| **Active** | Run or viewed within the dormancy threshold, **or** referenced by an active subscription, dashboard, flexipage or Apex |
| **Dormant** | No usage within the threshold, but a valid inbound reference or historical use |
| **Unused** | No usage within the threshold and no inbound reference, but run at least once historically |
| **Never used** | `LastRunDate` null and no inbound reference |
| **Orphaned** | Owner or running user inactive/deleted, or folder without an active manager |
| **Broken** | References a deleted report, field or report type |

> **Never propose deletion on usage data alone.** Resolve references (B-3) before classifying anything Unused.

### B-1: Inventory

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, Name, DeveloperName, FolderName, Format, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name, LastRunDate, Owner.Name, OwnerId FROM Report ORDER BY LastRunDate ASC NULLS FIRST"
sf data query -o <org-alias> -r csv -q "SELECT Id, Title, DeveloperName, FolderName, Type, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name, RunningUser.Name, RunningUserId FROM Dashboard ORDER BY LastModifiedDate ASC"
sf data query -o <org-alias> -r csv -q "SELECT Id, Name, DeveloperName, Type, AccessType, IsReadonly FROM Folder WHERE Type IN ('Report','Dashboard') ORDER BY Type, Name"
find <source-path>/reports/ -name '*.report-meta.xml' 2>/dev/null | wc -l
find <source-path>/dashboards/ -name '*.dashboard-meta.xml' 2>/dev/null | wc -l
```

Totals per type and folder. Assets in the org but not in source were built in production — a governance gap, not a deletion candidate.

### B-2: Usage evidence

> **Pitfall:** `LastViewedDate` and `LastReferencedDate` on `Report`/`Dashboard` are **per-user** — they reflect the querying user only. Use `Report.LastRunDate` (org-wide) as the baseline; `Dashboard` has no org-wide equivalent, so dashboard usage is **inferred** unless Event Monitoring is available. State this in the chapter.

```bash
# Event Monitoring (Shield) — authoritative; 30-day retention
sf data query -o <org-alias> -r csv -q "SELECT Report, COUNT(Id) runs FROM ReportEvent WHERE EventDate = LAST_N_DAYS:30 GROUP BY Report ORDER BY COUNT(Id) DESC" 2>&1 | head -50
sf data query -o <org-alias> -r csv -q "SELECT Dashboard, COUNT(Id) views FROM DashboardEvent WHERE EventDate = LAST_N_DAYS:30 GROUP BY Dashboard ORDER BY COUNT(Id) DESC" 2>&1 | head -50
# subscriptions — usage without views
sf data query -o <org-alias> -r csv -q "SELECT Id, ReportId, Report.Name, OwnerId, Owner.Name, Owner.IsActive FROM ReportSubscription" 2>&1
```

Without Event Monitoring, add the manual step: Setup > Lightning Usage App > Reports/Dashboards, export 90 days, reconcile. Subscriptions with an inactive owner are cleanup candidates in their own right.

### B-3: Inbound reference resolution

```bash
grep -rhoE '<report>[^<]+</report>' <source-path>/dashboards/ 2>/dev/null | sed 's|</\?report>||g' | sort -u
grep -rln 'report\|dashboard' <source-path>/flexipages/ --include='*.flexipage-meta.xml' 2>/dev/null
grep -rn 'ReportManager\|Reports\.ReportManager\|/lightning/r/Report/' <source-path>/classes/ --include='*.cls' 2>/dev/null | grep -v 'Test'
grep -rln 'analyticsCloud\|reportChart\|dashboardId' <source-path>/lwc/ <source-path>/aura/ 2>/dev/null
grep -rhoE '00O[a-zA-Z0-9]{12,15}|01Z[a-zA-Z0-9]{12,15}' <source-path>/ 2>/dev/null | sort -u
sf data query -o <org-alias> -r csv -q "SELECT Id, DeveloperName, MasterLabel FROM AnalyticSnapshot" 2>&1
```

A report referenced only by an unused dashboard is evaluated together with that dashboard. Hard-coded `00O`/`01Z` IDs in source are both a reference and a fragility finding. Reports feeding reporting snapshots are never deletion candidates.

### B-4: Ownership and folder health

```bash
sf data query -o <org-alias> -r csv -q "SELECT Id, Name, FolderName, Owner.Name, Owner.IsActive FROM Report WHERE Owner.IsActive = false"
sf data query -o <org-alias> -r csv -q "SELECT Id, Title, FolderName, RunningUser.Name, RunningUser.IsActive FROM Dashboard WHERE RunningUser.IsActive = false"
```

Dashboards with an inactive running user do not refresh — stale data for every viewer, **High**. Count assets in private folders; never propose deletions there. Flag empty folders, folders holding only unused assets, public folders with sensitive content, near-duplicate folder names.

### B-5: Duplicates

```bash
sf data query -o <org-alias> -r csv -q "SELECT Name, COUNT(Id) FROM Report GROUP BY Name HAVING COUNT(Id) > 1 ORDER BY COUNT(Id) DESC"
```

Also copy artefacts in names — `copy`, `Kopie`, `v2`, `_new`, `_old`, `TEST`, `tmp`, `final`, `Copy of`, trailing digits.

### B-6: Score

| Dimension | Weight | Scoring |
|---|---|---|
| Usage ratio | 30 | % Active; ≥ 70 % full marks, −3 per 5 points below |
| Never-used ratio | 20 | 0 % full marks, −2 per 5 % |
| Ownership health | 15 | −3 per dashboard with inactive running user (max −9); −2 per orphaned folder (max −6) |
| Duplication | 15 | −2 per duplicate-name cluster (max −10); −5 if copy artefacts > 10 % |
| Folder model | 10 | −2 per empty folder (max −6); −4 if no documented folder convention |
| Source control | 10 | % of assets in version control, proportional |

Traffic light: ≥ 80 green, 55–79 yellow, < 55 red.

### B-7: Cleanup artefacts and decommission procedure

Write `org_assessment/<YYYY-MM-DD>-reports-dashboards-cleanup.csv` — Id, Type, Name, Folder, Owner, Status, Disposition (Keep / Reassign owner / Archive / Delete), Wave, Evidence — and this staged procedure into the chapter:

| Wave | Scope | Action | Safety gate |
|---|---|---|---|
| 0 | All candidates | `sf project retrieve start -m Report -m Dashboard` into source control | Committed before anything else |
| 1 | Never used, no references | Move to quarantine folder `_Zur Loeschung <YYYY-QN>` | Owner informed, 30-day objection window |
| 2 | Unused, no references | Move to quarantine | 30-day objection window |
| 3 | Quarantined ≥ 30 days, no objection | Delete | Recycle Bin 15 days |
| 4 | Dormant with references | Decide per asset with the business owner | Never bulk |

### B-8: Chapter content

Summary (score, totals, counts per status, cleanup volume, confidence level from the usage sources available) · inventory overview · unused reports table (report, folder, owner, created, last run, status, inbound refs, disposition) · unused dashboards (plus running user) · never-used assets grouped by creator and period · ownership and folder issues · duplicates · broken and at-risk assets · decommission plan · governance plan (folder and naming model, creation gate, lifecycle rules with named owners and role-based running users, quarterly review with the score as KPI, preventive tooling, onboarding) — every rule grounded in a finding, with an owner and a start date · verification gaps.

---

## Module C — Storage

Four questions: where storage goes, what can be removed or offloaded and how many GB each measure returns, when the cap is reached, and whether cleanup is cheaper than buying.

### Storage model

Two pools, never mixed: **Data Storage** (records, fixed size per record) and **File Storage** (files, attachments, documents, content, actual bytes).

| Record type | Size |
|---|---|
| Most standard and all custom object records | 2 KB |
| Person Accounts | 4 KB |
| Campaigns | 8 KB |
| Campaign Members | 1 KB |
| Email Messages | 2 KB plus body in file storage |
| Article versions | 4 KB |
| Big Object records | **not counted** |

State this assumption in the chapter and reconcile every estimate against the actual limits; if the modelled total diverges by more than ~15 %, say so.

### C-1: Baseline

From the shared `limits.json`:

```bash
python3 -c "
import json
d=json.load(open('org_assessment/evidence/<YYYY-MM-DD>/limits.json'))['result']
for r in d:
    if 'Storage' in r['name']:
        used=r['max']-r['remaining']
        print(f\"{r['name']}: {used} / {r['max']} MB used ({used*100/r['max']:.1f}%)\")
"
```

Record allowance, used, remaining, percentage for both pools, and the allowance basis (base plus per-user) so the chapter can say whether the org is at capacity or under-licensed.

### C-2: Record counts per object

```bash
sf api request rest "/limits/recordCount" -o <org-alias> | python3 -c "
import sys,json
d=json.load(sys.stdin)['sObjects']
for o in sorted(d,key=lambda x:-x['count'])[:60]:
    print(f\"{o['count']:>12,}  {o['name']}\")
"
```

Multiply by the sizing rules, rank descending. Fall back to `SELECT COUNT()` for objects the endpoint omits.

### C-3: The usual suspects

**3a. History and audit tables** — `SELECT COUNT() FROM AccountHistory / ContactHistory / CaseHistory / OpportunityFieldHistory`, plus custom history from the shared `history-objects.txt`. History rows accumulate indefinitely unless Field Audit Trail moves them to `FieldHistoryArchive`; reducing tracking on low-value fields is the easiest win.

**3b. Log and integration tables**

```bash
sf data query -o <org-alias> -r csv -q "SELECT QualifiedApiName, Label FROM EntityDefinition WHERE IsCustomSetting = false AND (QualifiedApiName LIKE '%Log%' OR QualifiedApiName LIKE '%Audit%' OR QualifiedApiName LIKE '%Error%' OR QualifiedApiName LIKE '%Request%' OR QualifiedApiName LIKE '%Sync%' OR QualifiedApiName LIKE '%Staging%' OR QualifiedApiName LIKE '%Temp%')"
```

For each: total and counts older than 3, 6, 12, 24 months.

**3c. Platform-generated volume** — `EmailMessage`, `LoginHistory` (90 days), `Task`/`Event` older than 2 years, marketing engagement objects.

**3d. Age distribution** for the top 10 objects: `COUNT() WHERE CreatedDate < LAST_N_YEARS:1/2/3/5` — turns "the object is big" into "N GB is older than X years".

### C-4: File storage

```bash
sf data query -o <org-alias> -r csv -q "SELECT FileType, COUNT(Id) cnt, SUM(ContentSize) bytes FROM ContentVersion WHERE IsLatest = true GROUP BY FileType ORDER BY SUM(ContentSize) DESC"
sf data query -o <org-alias> -r csv -q "SELECT Id, Title, FileType, ContentSize, CreatedDate, CreatedBy.Name FROM ContentVersion WHERE IsLatest = true ORDER BY ContentSize DESC LIMIT 50"
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM ContentVersion"
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM ContentVersion WHERE IsLatest = true"
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM ContentDocument WHERE Id NOT IN (SELECT ContentDocumentId FROM ContentDocumentLink)"
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM Attachment"
sf data query -o <org-alias> --json -q "SELECT COUNT() FROM Document"
```

Analyse by file type, version bloat, orphaned files, legacy Attachments/Documents, duplicates by `ContentSize` + `Title`.

### C-5: Retention gap analysis

```bash
grep -rln 'Batchable\|Schedulable' <source-path>/classes/ --include='*.cls' | xargs grep -ln 'delete ' 2>/dev/null
grep -rn 'Database.emptyRecycleBin\|delete \[SELECT' <source-path>/classes/ --include='*.cls' | grep -v Test
```

Cross-reference with the shared `cronjobs.csv` and classify each top-20 object: **Retention active** / **Implemented but not scheduled** / **No retention** / **Retention not appropriate**. Call out "implemented but not scheduled" explicitly — the team believes retention is handled, and it is not.

### C-6: Growth and time to cap

`COUNT() WHERE CreatedDate = LAST_N_YEARS:1/2/3` for the top objects → MB per year → months until the cap, with and without the proposed cleanup. State the date plainly: *"At the current rate the data storage cap is reached in N months (around Month Year)."*

### C-7: Offloading options

Delete with retention policy · Big Objects · Field Audit Trail · Data Cloud / Data 360 · external object or file offloading · buy additional storage — assess each against the findings and give a recommendation, not a catalogue.

### C-8: Cost comparison

Inputs: overage or projected shortfall in GB, list price per GB per year (**ask — never invent**), engineering effort in person-days, recurring saving. Present 1-year and 3-year views; when the price is unknown, present parametrically and mark the commercial figure as input required. Keep indirect benefits (sandbox refresh, backup windows, query performance, GDPR surface) separate from the hard numbers.

### C-9: Score

| Dimension | Weight | Scoring |
|---|---|---|
| Headroom | 30 | ≥ 40 % free in both pools full marks; −5 per 10 points less free in the worse pool; 0 if any pool > 95 % |
| Time to cap | 20 | ≥ 36 months full marks; −5 per 6 months less; 0 if < 6 months |
| Retention coverage | 25 | % of top-20 growing objects with active retention or "not appropriate"; −2.5 per 10 points below 100; −5 extra per "implemented but not scheduled" (max −10) |
| File hygiene | 15 | −5 if superseded versions > 30 % of `ContentVersion`; −5 if orphaned files > 10 %; −5 if legacy Attachments/Documents still dominate |
| Estimate reconciliation | 10 | model within 15 % of actual full marks; −5 within 30 %; 0 beyond |

Traffic light: ≥ 80 green, 55–79 yellow, < 55 red.

### C-10: Action plan and chapter content

Phased plan — **1 Quick wins** (purge logs past retention, empty Recycle Bin, orphaned files, superseded versions), **2 Retention** (schedule jobs, activate unscheduled ones, reduce history tracking), **3 Structural** (Big Objects, file offloading, Data Cloud, archive strategy) — each item with object, measure, estimated GB, effort in PD, risk, reversibility, owner; sorted by GB per person-day. Mandatory safety rules: full export before the first deletion, Recycle Bin still consumes storage for 15 days, rehearse in a full-copy sandbox, check reports/dashboards/integrations (module B when run) and statutory retention from `customer.domain.md`.

Chapter: summary (both pools, time to cap, total GB identified, headline cost comparison) · current state · data storage by object with reconciliation delta · per-object analysis of the top consumers · file storage · retention gaps · growth projection · offloading options · cost comparison · action plan · governance (retention policy per object class, review cadence, every new log/staging object ships with a retention job) · verification gaps.

---

## Module D — Layouts & Lightning Pages

Four questions: how many layouts and Lightning pages exist and which are assigned; where the org is still on Classic-era layouts; which pages are heavy enough to hurt load time; what can be consolidated and what governance stops the sprawl.

> A layout not assigned to any profile × record-type combination is dead weight — but assignments may live in profiles not in source control. **Always confirm against the org before proposing deletion.** A Lightning record page does **not** replace the page layout: layouts still drive related lists, actions and mobile.

### D-1: Inventory

```bash
ls <source-path>/layouts/*.layout-meta.xml 2>/dev/null | wc -l
ls <source-path>/layouts/ | sed 's/-.*//' | sort | uniq -c | sort -rn | head -30
ls <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | wc -l
grep -l '<type>RecordPage</type>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | wc -l
for f in <source-path>/flexipages/*.flexipage-meta.xml; do
  printf "%-55s %s\n" "$(basename $f .flexipage-meta.xml)" "$(grep -oE '<type>(RecordPage|HomePage|AppPage|UtilityBar|CommAppPage|CommObjectPage|MailAppAppPage)</type>' $f | head -1 | tr -d '<>type/')"
done | sort -k2
find <source-path>/objects -name '*.recordType-meta.xml' 2>/dev/null | sed 's|.*/objects/||;s|/recordTypes/.*||' | sort | uniq -c | sort -rn
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Id, Name, TableEnumOrId FROM Layout ORDER BY TableEnumOrId" 2>&1 | head -50
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Id, DeveloperName, Type, EntityDefinitionId FROM FlexiPage ORDER BY Type, DeveloperName" 2>&1 | head -50
```

Org-vs-source gap = UI metadata changed directly in production — a governance finding.

### D-2: Assignment analysis

```bash
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Layout.Name, Layout.TableEnumOrId, Profile.Name, RecordType.Name FROM ProfileLayout ORDER BY Layout.TableEnumOrId, Layout.Name" 2>&1
grep -A3 '<layoutAssignments>' <source-path>/profiles/*.profile-meta.xml 2>/dev/null | grep -oE '<layout>[^<]+' | sed 's/<layout>//' | sort | uniq -c | sort -rn
```

Classes: **Assigned** / **Unassigned** / **Single-assignment** (merge candidate) / **Universally assigned** (de-facto default). If `ProfileLayout` is not queryable and profiles are not in source, mark assignment analysis **unverified** — never infer "unassigned" from missing source metadata.

### D-3: Lightning adoption

```bash
grep -l '<type>RecordPage</type>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | while read f; do
  obj=$(grep -oE '<sobjectType>[^<]+' "$f" | sed 's/<sobjectType>//' | head -1); echo "$obj  $(basename $f .flexipage-meta.xml)"; done | sort
grep -c '<fieldInstance>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | grep -v ':0'
grep -l 'force:detailPanel\|runtime_sales_activities\|force:highlightsPanel' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null
grep -c '<visibilityRule>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | grep -v ':0' | sort -t: -k2 -rn
```

Lightning coverage = objects with a record page ÷ objects with layouts. Dynamic Forms (`fieldInstance`) replace "one layout per audience" with conditional visibility on one page — usually the real fix for layout sprawl.

### D-4: Complexity and performance

```bash
for f in <source-path>/flexipages/*.flexipage-meta.xml; do
  printf "%-55s components:%3s regions:%2s fields:%3s visibility:%3s\n" "$(basename $f .flexipage-meta.xml)" \
    "$(grep -c '<componentName>' $f)" "$(grep -c '<itemInstances>' $f)" "$(grep -c '<fieldInstance>' $f)" "$(grep -c '<visibilityRule>' $f)"
done | sort -t: -k2 -rn | head -25
for f in <source-path>/layouts/*.layout-meta.xml; do
  printf "%-70s fields:%3s relLists:%3s actions:%3s\n" "$(basename $f .layout-meta.xml)" \
    "$(grep -c '<field>' $f)" "$(grep -c '<relatedLists>' $f)" "$(grep -c '<quickActionListItems>' $f)"
done | sort -t: -k2 -rn | head -25
grep -hoE '<componentName>[^<]+' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | sed 's/<componentName>//' | sort | uniq -c | sort -rn | head -30
ls -d <source-path>/lwc/*/ 2>/dev/null | xargs -n1 basename | sort > org_assessment/evidence/<YYYY-MM-DD>/lwc_all.txt
grep -hoE '<componentName>c:[^<]+' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | sed 's/<componentName>c://' | sort -u > org_assessment/evidence/<YYYY-MM-DD>/lwc_used.txt
comm -23 org_assessment/evidence/<YYYY-MM-DD>/lwc_all.txt org_assessment/evidence/<YYYY-MM-DD>/lwc_used.txt
```

Guidance thresholds (judgement, not law): > 25 components per record page, > 5 custom components per page, > 10 eagerly rendered related lists, > 60 fields per layout. Components on no FlexiPage may still be used in Flows, Quick Actions, Communities or other components — **verify before calling anything dead**.

### D-5: Duplication

```bash
for f in <source-path>/layouts/<Object>-*.layout-meta.xml; do
  echo "== $(basename $f)"; grep -oE '<field>[^<]+' $f | sed 's/<field>//' | sort | md5; done
```

Identical hashes are exact duplicates; for near-duplicates diff the field lists. Flag lifecycle artefacts in names (`Copy`, `Kopie`, `Test`, `Old`, `Alt`, `New`, `Neu`, `v2`, `Backup`, `DRAFT`, `tmp`, trailing dates). Managed-package artefacts (namespace prefix) are reported separately and excluded from consolidation.

### D-6: Score

| Dimension | Weight | Scoring |
|---|---|---|
| Assignment hygiene | 25 | % of layouts assigned; −2.5 per 10 points below 100 (unverified if D-2 could not run) |
| Lightning adoption | 20 | % of layout-bearing objects with a record page; −2 per 10 points below |
| Dynamic Forms adoption | 15 | % of record pages using `fieldInstance`; −1.5 per 10 points below |
| Layout consolidation | 15 | −2 per object with > 3 layouts (max −10); −5 if exact duplicates exist |
| Page complexity | 15 | −3 per record page > 25 components (max −9); −3 per layout > 60 fields (max −6) |
| Source control & naming | 10 | proportional for org/source gap; −3 for lifecycle artefacts |

Traffic light: ≥ 80 green, 55–79 yellow, < 55 red.

### D-7: Plan and chapter content

Phased plan — **1 Safe removals** (unassigned layouts/FlexiPages after org confirmation, lifecycle copies), **2 Consolidation** (merge near-duplicates via Dynamic Forms, related lists to tabs), **3 Lightning modernisation** (record pages for objects lacking them, Record Detail → Dynamic Forms), **4 Performance** (split heavy pages, defer components, review custom components on high-traffic pages) — ordered by user impact per effort using `customer.domain.md`. Safety rules: confirm no assignment in the org, retrieve before deleting, communicate ahead, never delete a layout because a record page exists, test Dynamic Forms migrations per record type × profile.

Chapter: summary (score, totals, Lightning %, Dynamic Forms %, unassigned count) · inventory · assignment analysis with the full unassigned list · Lightning adoption ranked by business importance · complexity and performance · components with the dead-code caveat · duplication · plan · governance (one page per object by default, naming convention, assignment mandatory at creation, complexity budget, new objects ship with a record page, UI metadata via pipeline, quarterly review) · verification gaps.

---

## Module E — User Licences

Three questions: what licences exist and how many are idle; which are held by users who cannot or do not use them; and, optionally, how shared admin accounts should be replaced under passkey / phishing-resistant MFA.

### E-1: Licence inventory

```bash
sf data query -o <org-alias> -r csv -q "SELECT Name, LicenseDefinitionKey, TotalLicenses, UsedLicenses, Status FROM UserLicense WHERE Status = 'Active' ORDER BY TotalLicenses DESC"
sf data query -o <org-alias> -r csv -q "SELECT MasterLabel, TotalLicenses, UsedLicenses, Status FROM PermissionSetLicense WHERE Status = 'Active' ORDER BY TotalLicenses DESC"
```

| Signal | Meaning |
|---|---|
| Utilisation < 60 % with total > 5 | Over-provisioned — reclaim at renewal |
| Utilisation ≥ 95 % | At capacity — plan ahead of the next hire |
| Used = 0, total > 0 | Paid for and untouched — cancel or repurpose |

Feature licences are frequently forgotten and often the clearest waste.

### E-2: Waste

From the shared `users.csv` (active users only, platform-internal users excluded):

| Class | Definition | Action |
|---|---|---|
| **Active** | Logged in within 90 days | Keep |
| **Dormant** | No login in 90+ days | Review with the manager |
| **Never used** | Created, never logged in | Reclaim unless onboarding is pending |
| **Integration/service** | Non-human account | Check licence fit (E-3) |

Quantify reclaimable licences per type. Money only with a supplied price — **never invent one**. A dormant user is a question for their manager, not automatically a reclaim.

### E-3: Licence fit

From `users.csv` plus:

```bash
sf data query -o <org-alias> -r csv -q "SELECT Assignee.Username, PermissionSet.Label FROM PermissionSetAssignment WHERE PermissionSet.Label LIKE '%MFA%' OR PermissionSet.Label LIKE '%Disable%'"
```

Flag integration accounts on a full Salesforce licence (Integration licence fits better and removes interactive login), report-only users on full licences, admin count vs. ~1 per 30 users, and **shared-looking accounts** — `admin@`, `integration@`, `service@`, `persistent_admin@`, `deployment@`, or any name that is a function rather than a person. These feed E-4.

### E-4: Shared admin accounts under passkey / phishing-resistant MFA *(with `--shared-admin` or when E-3 finds one)*

For each privileged account decide: named human, or used by several people (generic username, shared mailbox, many login IPs, several people knowing the password)?

**Why passkeys break shared accounts** — state plainly in the chapter: a passkey is bound to one person and one device and cannot be handed over like a password. One person registers it → undocumented single point of failure. The authenticator is shared → phishing resistance and attribution are lost. A weaker method is kept as an exemption → the most privileged account gets the weakest authentication. No configuration fixes this; the resolution is organisational. **Verify the current Salesforce requirement before quoting any deadline.**

**Target model:**

| # | Pattern | Use for |
|---|---|---|
| 1 | Named admin accounts + Permission Set Groups | Every human needing admin rights — the default answer |
| 2 | Integration user, API-only, OAuth via connected app, IP-restricted, scoped | System-to-system access currently running through the shared admin |
| 3 | Just-in-time elevation via approval | Occasional admin needs |
| 4 | One break-glass account — sealed in the vault, passkey on a dedicated device with a named owner, alert on every login, rotate after use | Genuine emergencies only (SSO/IdP unavailable) |

Recommend 1 for people, 2 for systems, at most one 4.

**Migration outline:** inventory the usage (`OAuthToken` — `AppName`, `LastUsedDate`, `UseCount` — and `LoginHistory`) → split by purpose → move automation first (scheduled jobs from `cronjobs.csv`, connected apps, integrations) → provision the humans → run in parallel monitoring `LoginHistory` → freeze, then deactivate → revoke OAuth tokens explicitly. State the net licence effect: N named accounts cost N licences, usually more than offset by E-2 and E-3.

### E-5: Score

| Dimension | Weight | Scoring |
|---|---|---|
| Utilisation | 30 | weighted utilisation of paid licence types between 60 % and 95 % full marks; −5 per 10 points outside that band (worse direction counts) |
| Waste | 25 | % of active licensed users that are dormant or never used; 0 % full marks, −5 per 5 % |
| Licence fit | 20 | −5 per integration account on a full licence (max −10); −5 if admins exceed 1 per 30 users; −5 if downgrade candidates > 10 % |
| Privileged accounts | 15 | −5 per shared-looking privileged account (max −10); −5 if any admin dormant 90+ days |
| Feature licences | 10 | −5 per feature licence with 0 used (max −10) |

Traffic light: ≥ 80 green, 55–79 yellow, < 55 red.

### E-6: Chapter content

Summary (licence types, total vs used, utilisation, reclaimable count, verdict) · licence inventory table · waste by licence type · licence fit · shared admin accounts (if E-4 ran) · action plan with licences reclaimed and effort per item · verification gaps (contract terms, prices, Setup-only settings).

---

### Step 3: Consolidate

1. **Health dashboard** — one row per module run: score, traffic light, top finding, number of actions. Overall score = arithmetic mean of the modules run, stated as such; overall traffic light = the worst module, and **red whenever module A has a Critical finding**. Do not blend module scores into anything more sophisticated — five different scales averaged are a signal, not a measurement.
2. **Cross-module findings** — list findings that appear in more than one module once, with both angles, e.g. dormant admins (A-3b and E-2), inactive dashboard running users who are also dormant licence holders (B-4 and E-2), unscheduled retention jobs (A-4d and C-5), reports on objects proposed for purge (B and C-10), unassigned layouts on objects with no record page (D-2 and D-3). Each such item gets one owner, not two.
3. **Consolidated action plan** — merge the module plans into one table: `#`, module, finding, severity/priority, action, owner, effort, saving (GB / licences / assets), automatable. Group P0 / P1 / P2 / P3 as in module A; within a group sort by benefit per effort. Keep module plans in their chapters as well.
4. **Governance summary** — one page collecting the governance rules of all modules into a review calendar: what is re-run when, who owns it, which score is the KPI.

### Step 4: Write the report and artefacts

Default: **one consolidated report** at `org_assessment/<YYYY-MM-DD>-org-review.md` in the **documentation language** from `customer.config.md` (create the directory if missing):

1. Executive summary — health dashboard, overall verdict, the five things a non-technical reader must understand, total identified savings (GB, licences, assets, findings by severity).
2. Cross-module findings.
3. One chapter per module run, in order A–E, each with the structure defined in its *Chapter content* section.
4. Consolidated action plan.
5. Governance summary and review calendar.
6. Delta (Step 5).
7. Appendix: verification gaps per module — every check that could not run, with exact Setup navigation, so nothing is silently dropped.

With `--separate-reports`, write `org_assessment/<YYYY-MM-DD>-org-review-<module>.md` per module (same chapter content plus its own summary and gaps) and a short `org_assessment/<YYYY-MM-DD>-org-review.md` holding only items 1, 2, 4, 5 and 6 with links to the module files.

Artefacts alongside the report:

| Artefact | Module | Content |
|---|---|---|
| `<date>-reports-dashboards-cleanup.csv` | B | one row per decommission candidate with wave and evidence |
| `<date>-storage-cleanup-plan.csv` | C | one row per measure: object, phase, GB, PD, risk, owner |
| `<date>-layouts-cleanup.csv` | D | one row per unassigned / duplicate artefact with confirmation status |
| `<date>-license-reclaim.csv` | E | one row per reclaimable licence: user, licence type, class, recommended action |
| `<date>-security-findings.csv` | A | one row per finding: ID, domain, severity, location, fix |
| `evidence/<date>/` | all | raw query results the verdicts were derived from |

### Step 5: Delta

If a previous `*-org-review.md` — or a previous single-module report from the replaced skills (`*-security-orgreview.md`, `*-reports-dashboards-review.md`, `*-storage-review.md`, `*-layouts-lightning-review.md`, `*-user-licenses-review.md`) — exists in `org_assessment/`, add a Delta per module: score change, findings resolved, still open, new; and the module-specific measures (assets deleted and net estate growth for B, GB actually saved vs. estimated and revised time to cap for C, layouts removed and coverage change for D, licences reclaimed for E). Net growth despite an intervening cleanup means the governance rules are not being followed — say so. An estimate that did not materialise is the most useful thing in a follow-up; report it plainly.

### Step 6: Log and summary

Create `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-org-review.json` in `.claude/skills/29-org-review/logs/`, using the standard JSON schema from CLAUDE.md. The `summary` starts with the module list and one score per module, e.g. `[modules=A,B,C,D,E] [A=72/yellow] [B=58/yellow] [C=81/green] [D=44/red] [E=90/green] [overall=69/red:critical]`, followed by the one-sentence verdict; `artifacts` lists the report, every CSV and the evidence folder.

Present to the user:

- The health dashboard (module, score, traffic light)
- Overall verdict and whether a Critical security finding forced red
- Per module, the single most important number: Critical/High counts (A), deletion candidates and confidence level (B), months to cap and GB identified (C), unassigned count and Lightning coverage (D), reclaimable licences (E)
- The top 3 P0/P1 actions across all modules
- Paths to the report, the CSVs and the evidence folder
- Which checks were unverified and why

## Important Rules

- **Read-only, without exception.** Never delete, modify, move, deactivate, reassign, reconfigure or "fix as you go" — in the org or in source. Artefacts are for a human to execute.
- **Unverified is not pass and not zero.** A check that could not run goes to the verification-gaps appendix with exact Setup navigation, and its score dimension is marked unverified.
- **Grep results are indicators, not verdicts.** Read the surrounding code or metadata before assigning severity; list dropped false positives so the next run does not re-raise them.
- **Never invent commercial figures** — prices per GB or per licence are input from the user or account team; present parametrically otherwise.
- **Never paste secret values** into any report or CSV; `file:line` with the value redacted. A secret in source is compromised — rotation plus history removal, not line deletion.
- **Never propose deletion on usage data alone** (B), from source metadata alone (D), or without checking statutory retention in `customer.domain.md` (C).
- **Exclude platform-internal users** from every count; state the exclusion.
- **Do not state MFA or passkey deadlines as fact.**
- **Distinguish the two storage pools throughout.**
- Prioritise by business usage from `customer.domain.md`, not by artefact count.
- Read all org aliases, source paths, object and field names, PMD rule files from config. Never hardcode.
- Output text uses the **documentation language** from `customer.config.md`.
- No AI attribution anywhere in the report, the CSVs or the log.

## Error Handling

- **No org access:** see Step 0 — source-based checks run, org-dependent checks become verification gaps, module E is skipped with the query list. Do not abort.
- **Unknown module key:** abort before any query, listing the valid keys.
- **PMD missing (A):** note it, add installation to the plan, mark the PMD check unverified, continue.
- **`ReportEvent`/`DashboardEvent` unavailable (B):** fall back to `LastRunDate`, downgrade the stated confidence explicitly. **`ReportSubscription` not queryable:** add a manual check — never assume there are no subscriptions.
- **`/limits/recordCount` unavailable (C):** `SELECT COUNT()` per object from `stack.config.md` and `customer.domain.md`; state the list is not exhaustive. **`COUNT()` times out:** query by date range and sum, or report "over N million" from a bounded query. **Aggregate blocked:** estimate from a bounded sample, marked as sampled.
- **`ProfileLayout` / Tooling API unavailable, or `profiles/` empty (D):** assignment analysis unverified; no deletion proposals. **Managed-package artefacts:** report separately, exclude from consolidation.
- **`UserLicense` / `PermissionSetLicense` not queryable (E):** manual step Setup > Company Information. **Aggregate blocked on `User`:** aggregate locally from `users.csv`.
- **Very large estates (> 2000 reports, > 500 layouts):** report per folder / per object in the chapter, full detail in the CSV.
- **Empty source path:** tell the user to retrieve metadata first; continue with org-based checks only.
- **`org_assessment/` missing:** create it.

## Setup note

After this file is added or changed, re-run `setup.sh` from the repo root so the skill is merged into `.claude/skills/` and `.claude/commands/`. Until then the slash command is not wired up.

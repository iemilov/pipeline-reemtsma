---
name: security-orgreview
description: Use when performing a security review of a Salesforce org — audits Apex/UI code vulnerabilities, CRUD/FLS/sharing enforcement, permission and access model, PII and data protection, integration and credential security, session/network/auth settings, monitoring and compliance, then produces a scored security report with a prioritized remediation plan
argument-hint: [org-alias (optional, defaults to default org from stack.config.md)]
---

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. If the customer uses a different platform, inform the user and abort with a clear message.

## Purpose

A focused, read-only **security posture assessment** of a Salesforce org — code, configuration, data, integrations, and process. The result is a scored report plus an exhaustive remediation plan. This skill does **not** assess AI readiness, performance, or architecture modernization except where they are security-relevant.

## Assessment Domains

| # | Domain | Weight | Focus |
|---|--------|--------|-------|
| 1 | **Apex Security** | 20 pts | CRUD/FLS enforcement, sharing keywords, SOQL/SOSL injection, hard-coded secrets, insecure deserialization, error handling and information disclosure |
| 2 | **UI Layer Security** (VF / Aura / LWC) | 15 pts | XSS, CSRF, CSP violations, open redirects, DOM injection, insecure client-side storage |
| 3 | **Access & Permission Model** | 20 pts | Profiles vs. Permission Sets, `View All`/`Modify All`, dangerous system permissions, admin count, guest/Experience Cloud users, license hygiene, orphaned access |
| 4 | **Data Protection & Privacy** | 15 pts | PII discovery and classification, Shield/Classic encryption, field-level security, data retention, test data in prod, GDPR/compliance tagging |
| 5 | **Integration & Credential Security** | 15 pts | Named Credentials vs. hard-coded endpoints and keys, Connected Apps, OAuth scopes, API-enabled users, CORS/trusted sites, remote site settings, webhooks/inbound endpoints |
| 6 | **Org & Session Configuration** | 10 pts | Health Check baseline, password/session policy, MFA, login IP ranges, login hours, certificate expiry, my domain, clickjack protection |
| 7 | **Monitoring, Audit & Response** | 5 pts | Setup Audit Trail review, Event Monitoring / Shield, transaction security policies, field history tracking, incident response readiness |

Cross-cutting activities:
- **PMD security ruleset scan** over the whole Apex codebase
- **Secret scan** across the full repository (not only Apex)
- **Delegation to `/code-review`** for general code quality — this skill references its output rather than duplicating it

## Configuration

Before executing, read:
- `pipeline/customer.config.md` — customer identity, **Platform**, documentation language, Atlassian settings
- `pipeline/stack.config.md` — source path, naming prefixes, PMD rules file, org aliases, API version
- `pipeline/customer.domain.md` — which objects/fields carry sensitive business data

Resolve the org alias: use `$ARGUMENTS` if provided, otherwise the first org alias from `stack.config.md`.

Resolve `<source-path>` from `stack.config.md`. Never hardcode paths, object names, or field names.

## Workflow: Org → Security Report + Remediation Plan

### Step 1: Apex Security

#### 1a. CRUD / FLS Enforcement

Enforcement must exist for every DML and query touching user-visible data. Check which mechanism the project uses:

```bash
grep -rn 'WITH SECURITY_ENFORCED\|WITH USER_MODE\|Security\.stripInaccessible\|AccessType\.' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
grep -rn 'isAccessible()\|isCreateable()\|isUpdateable()\|isDeletable()' <source-path>/classes/ --include='*.cls'
```

Then list all classes performing DML or SOQL without any of the above:

```bash
grep -rln '\[SELECT\|insert \|update \|delete \|upsert ' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
```

Cross-reference both lists. Every class in the second list but not the first is an **FLS/CRUD gap** — record file path, the specific operation, and the object touched. Severity: Critical when the class is `without sharing`, exposed via `@AuraEnabled`, `@RestResource`, `webservice`, or a Guest-accessible surface; High otherwise.

#### 1b. Sharing Keywords

```bash
grep -rn 'without sharing' <source-path>/classes/ --include='*.cls'
grep -rn 'inherited sharing' <source-path>/classes/ --include='*.cls'
grep -rLn 'with sharing\|without sharing\|inherited sharing' <source-path>/classes/ --include='*.cls'
```

- `without sharing` in a non-test class → Critical if it is reachable from a controller, `@AuraEnabled` method, REST resource, or Flow invocable.
- Classes with **no** sharing keyword → High (they run in the sharing context of the caller, often unintentionally `without sharing` when entered from a trigger).
- `inherited sharing` on an entry point → verify it is intentional.

For each `without sharing` class, read it and document *why* the elevation exists and whether it can be narrowed to an inner class.

#### 1c. SOQL / SOSL / DML Injection

```bash
grep -rn 'Database\.query\|Database\.queryWithBinds\|Search\.query' <source-path>/classes/ --include='*.cls'
grep -rnE 'Database\.query\(.*\+' <source-path>/classes/ --include='*.cls'
grep -rn 'String\.escapeSingleQuotes' <source-path>/classes/ --include='*.cls'
```

Flag every dynamic query built by string concatenation that does **not** pass user input through `String.escapeSingleQuotes()` or bind variables. Severity: Critical when the concatenated value originates from a request parameter, `@AuraEnabled` argument, or REST body.

Also flag dynamic field/object names taken from input (used in `getSObjectType()`, `getGlobalDescribe()`, dynamic SObject construction) — these bypass compile-time checks.

#### 1d. Hard-coded Secrets & Credentials

Scan the whole repository, not just Apex:

```bash
grep -rnEi '(api[_-]?key|apikey|secret|client[_-]?secret|passwd|password|private[_-]?key|bearer|authorization)\s*[:=]' <source-path>/ | grep -v 'Test\.cls'
grep -rnE 'AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.' <source-path>/
grep -rn 'sf-[a-zA-Z0-9]\{20,\}\|xox[baprs]-' <source-path>/
```

Also check for secrets in metadata that ships to the org:

```bash
grep -rniE '(password|secret|token)' <source-path>/ --include='*.customMetadata-meta.xml' --include='*.labels-meta.xml' --include='*.settings-meta.xml' --include='*.flow-meta.xml'
```

Every hit is **Critical**. Recommend Named Credentials, Protected Custom Settings/Custom Metadata, or External Credentials — and note that any leaked secret must be rotated, not merely removed from source.

#### 1e. Insecure Patterns & Information Disclosure

```bash
grep -rn 'JSON\.deserializeUntyped\|JSON\.deserialize(' <source-path>/classes/ --include='*.cls'
grep -rn 'Crypto\.' <source-path>/classes/ --include='*.cls'
grep -rn 'catch\s*(\w*Exception\s*\w*)\s*{\s*}' <source-path>/classes/ --include='*.cls'
grep -rn 'getMessage()\|getStackTraceString()' <source-path>/classes/ --include='*.cls'
grep -rn 'System\.debug' <source-path>/classes/ --include='*.cls' | grep -iE 'password|token|secret|key|ssn|iban'
```

Flag:
- Weak crypto: MD5/SHA-1 usage, `Crypto.encrypt` with a static/hard-coded IV, ECB-mode analogues, `Math.random()` for tokens (use `Crypto.getRandomLong/getRandomInteger`).
- Empty catch blocks — swallow security failures silently (High).
- Exception messages or stack traces returned to the client or written to a user-visible field (Medium–High, information disclosure).
- Sensitive values written to debug logs (High).

#### 1f. Exposed Entry Points

Enumerate every surface an external or low-privileged actor can reach:

```bash
grep -rn '@AuraEnabled' <source-path>/classes/ --include='*.cls'
grep -rn '@RestResource\|@HttpGet\|@HttpPost\|@HttpPut\|@HttpDelete\|@HttpPatch' <source-path>/classes/ --include='*.cls'
grep -rn 'webservice ' <source-path>/classes/ --include='*.cls'
grep -rn '@InvocableMethod' <source-path>/classes/ --include='*.cls'
grep -rn 'global class' <source-path>/classes/ --include='*.cls'
```

Build an **attack surface inventory** table: entry point, class, sharing keyword, FLS enforcement (yes/no), input validation (yes/no), guest-accessible (yes/no). Any row with `without sharing` + no FLS is Critical.

#### 1g. Trigger & Async Context

```bash
grep -rn 'System\.runAs' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
grep -rn '@future\|System\.enqueueJob\|Database\.executeBatch' <source-path>/classes/ --include='*.cls'
```

Async contexts run in system mode by default. Flag async classes that perform DML on sensitive objects without re-applying FLS.

### Step 2: UI Layer Security (VF / Aura / LWC)

#### 2a. Visualforce

```bash
find <source-path>/pages/ -name '*.page' 2>/dev/null | wc -l
grep -rn '<form ' <source-path>/pages/ --include='*.page'
grep -rn '<script\|<style' <source-path>/pages/ --include='*.page'
grep -rn 'escape="false"' <source-path>/pages/ --include='*.page'
grep -rn 'showHeader="false"\|standardStylesheets="false"' <source-path>/pages/ --include='*.page'
```

- `{! }` merge fields without `HTMLENCODE`/`JSENCODE`/`URLENCODE` → **XSS** (Critical when the value is user-controlled).
- `escape="false"` on `<apex:outputText>` → XSS.
- Raw `<form>` instead of `<apex:form>` → **CSRF** (no view state token).
- Inline `<script>`/`<style>` → CSP violation, blocks LockerService hardening.
- Controllers behind pages: check the corresponding Apex controller for CRUD/FLS (VF standard controllers enforce it, custom controllers do not).

#### 2b. Aura

```bash
grep -rn 'navigateToURL\|window\.location\|window\.open' <source-path>/aura/ --include='*.js'
grep -rn 'aura:unescapedHtml' <source-path>/aura/ --include='*.cmp'
grep -rn 'localStorage\|sessionStorage\|document\.cookie' <source-path>/aura/ --include='*.js'
grep -rn 'access="global"' <source-path>/aura/ --include='*.cmp'
```

- `aura:unescapedHtml` with dynamic content → XSS (Critical).
- `navigateToURL` / `window.location` with a non-validated URL → open redirect.
- Secrets or PII in `localStorage`/`sessionStorage`/cookies → High.
- `access="global"` components broaden the attack surface — verify each is intentional.

#### 2c. LWC

```bash
grep -rn 'lwc:dom="manual"\|innerHTML\|outerHTML\|eval(\|new Function(' <source-path>/lwc/ --include='*.js' --include='*.html'
grep -rn '<script src=\|fetch(\|XMLHttpRequest' <source-path>/lwc/ --include='*.js' --include='*.html'
grep -rn 'localStorage\|sessionStorage\|document\.cookie' <source-path>/lwc/ --include='*.js'
grep -rn 'isExposed>true' <source-path>/lwc/ --include='*.js-meta.xml'
```

- Manual DOM + `innerHTML` → XSS bypass of LWC sanitization (Critical).
- `eval` / `new Function` → Critical.
- External script or `fetch` to a non-Salesforce host → CSP/exfiltration risk; must go through a Named Credential + Apex.
- `isExposed=true` components: list which surfaces they are exposed to; combined with a `without sharing` controller this is a data-exposure path.

#### 2d. Experience Cloud / Guest User Exposure

```bash
find <source-path> -name '*.site-meta.xml' -o -name '*.network-meta.xml' 2>/dev/null
find <source-path>/profiles/ -name '*Guest*' 2>/dev/null
```

For each Guest User profile found, read it and flag: object permissions beyond read on intended objects, any create/edit/delete, `ViewAllData`, Apex class access to classes lacking FLS, and VF page access. Guest user over-permissioning is one of the highest-impact real-world Salesforce breach vectors — treat findings as **Critical**.

Also verify the "Secure guest user record access" setting is enabled (org-level; add to the manual action plan).

### Step 3: Access & Permission Model

#### 3a. Elevated System Permissions

```bash
sf data query -q "SELECT Name, PermissionsViewAllData, PermissionsModifyAllData, PermissionsAuthorApex, PermissionsCustomizeApplication, PermissionsManageUsers, PermissionsApiEnabled FROM Profile WHERE PermissionsViewAllData = true OR PermissionsModifyAllData = true OR PermissionsAuthorApex = true OR PermissionsManageUsers = true" -o <org-alias> --json
sf data query -q "SELECT Name, Label, PermissionsViewAllData, PermissionsModifyAllData, PermissionsAuthorApex, PermissionsManageUsers, PermissionsApiEnabled FROM PermissionSet WHERE PermissionsViewAllData = true OR PermissionsModifyAllData = true OR PermissionsAuthorApex = true OR PermissionsManageUsers = true" -o <org-alias> --json
```

Also check the local metadata equivalent so the check still works without org access:

```bash
grep -rn 'ModifyAllData\|ViewAllData\|AuthorApex\|ManageUsers\|CustomizeApplication\|ViewSetup' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
```

Flag every profile/permission set granting `Modify All Data`, `View All Data`, `Author Apex`, `Manage Users`, `Customize Application`, `View Setup and Configuration`, or `Manage Session Permission Set Activations`.

#### 3b. Admin & Privileged User Count

```bash
sf data query -q "SELECT COUNT(Id) FROM User WHERE Profile.Name = 'System Administrator' AND IsActive = true" -o <org-alias> --json
sf data query -q "SELECT Username, Name, LastLoginDate, Profile.Name FROM User WHERE IsActive = true AND Profile.PermissionsModifyAllData = true ORDER BY LastLoginDate ASC" -o <org-alias> --json
```

Benchmark: no more than 1 admin per ~30 users, and every admin must be a named human (no shared accounts). Flag admins who have not logged in for 90+ days.

#### 3c. Dormant, Orphaned & Integration Users

```bash
sf data query -q "SELECT Username, Name, LastLoginDate, Profile.Name FROM User WHERE IsActive = true AND (LastLoginDate < LAST_N_DAYS:90 OR LastLoginDate = null)" -o <org-alias> --json
sf data query -q "SELECT Username, Profile.Name FROM User WHERE IsActive = true AND Profile.PermissionsApiEnabled = true" -o <org-alias> --json
```

Flag: active users dormant 90+ days, integration/service accounts with interactive login enabled, service accounts without IP restrictions, users whose manager or owner has left.

#### 3d. Permission Set vs. Profile Hygiene

```bash
sf data query -q "SELECT PermissionSet.Name, COUNT(Id) assignments FROM PermissionSetAssignment WHERE PermissionSet.IsOwnedByProfile = false GROUP BY PermissionSet.Name ORDER BY COUNT(Id) DESC" -o <org-alias> --json
```

Flag permission sets assigned to nearly everyone (they are de-facto profile permissions and defeat least privilege), and permission sets with zero assignments (dead grants that will be reused carelessly).

Target model: minimal base profile + Permission Set Groups with muting.

#### 3e. Sharing Model

```bash
grep -rn 'sharingModel' <source-path>/objects/ --include='*.object-meta.xml'
find <source-path> -name '*.sharingRules-meta.xml' 2>/dev/null
grep -rn 'externalSharingModel' <source-path>/objects/ --include='*.object-meta.xml'
```

Flag:
- OWD `ReadWrite` / `ControlledByParent` on objects holding sensitive data (cross-reference `customer.domain.md`).
- `externalSharingModel` more permissive than intended for community/portal users.
- Apex managed sharing (`Share` object DML, `RowCause`) — audit each for correctness:
  ```bash
  grep -rn '__Share\|ShareAccessLevel\|RowCause\|AccountShare\|OpportunityShare' <source-path>/classes/ --include='*.cls'
  ```
- Missing Restriction Rules / Scoping Rules on objects with broad OWD.

#### 3f. Field-Level Security Spot Check

For each sensitive field identified in Step 4a, verify FLS in the profile/permission set metadata:

```bash
grep -rn -A3 '<field>.*<SensitiveFieldApiName>' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
```

Flag any profile with `editable=true` or `readable=true` on a highly sensitive field where it is not required.

### Step 4: Data Protection & Privacy

#### 4a. PII Discovery

```bash
sf data query -q "SELECT QualifiedApiName, EntityDefinition.QualifiedApiName, DataType, SecurityClassification, ComplianceGroup FROM FieldDefinition WHERE IsCustom = true AND (QualifiedApiName LIKE '%Email%' OR QualifiedApiName LIKE '%Phone%' OR QualifiedApiName LIKE '%SSN%' OR QualifiedApiName LIKE '%Birth%' OR QualifiedApiName LIKE '%Address%' OR QualifiedApiName LIKE '%IBAN%' OR QualifiedApiName LIKE '%Tax%' OR QualifiedApiName LIKE '%Passport%' OR QualifiedApiName LIKE '%Salary%' OR QualifiedApiName LIKE '%Health%')" -o <org-alias> --json
```

Fallback without org access — scan local field metadata:

```bash
grep -rlEi 'email|phone|ssn|birth|iban|passport|salary|tax|geburt|adresse' <source-path>/objects/*/fields/ 2>/dev/null
```

Consult `customer.domain.md` for domain-specific sensitive fields that do not match these name patterns. Build a PII inventory table: object, field, data type, classification, compliance group, encrypted (yes/no), FLS-restricted (yes/no).

#### 4b. Data Classification Coverage

Any PII field with `SecurityClassification = null` or `ComplianceGroup = null` is untagged. Report coverage as a percentage. Untagged PII cannot be governed by masking, encryption policy, or DSAR tooling.

Manual action: "Setup > Data Classification — tag every custom field with Data Sensitivity (Public / Internal / Confidential / Restricted) and Compliance Categories (PII, GDPR, HIPAA, PCI as applicable)."

#### 4c. Encryption

```bash
find <source-path> -name '*.EncryptionKeySettings*' -o -name '*.platformEncryptionSettings*' 2>/dev/null
grep -rn 'EncryptedText' <source-path>/objects/ --include='*.field-meta.xml'
```

Flag PII fields that are neither Classic Encrypted Text nor covered by Shield Platform Encryption. Note that Classic Encrypted Text fields are not searchable/filterable — recommend Shield where the field must remain usable.

Manual action: "Setup > Platform Encryption — verify encryption policy covers all Restricted-classified fields; verify tenant secret rotation schedule (recommended: annually or per policy)."

#### 4d. Data Retention & Test Data in Production

```bash
sf data query -q "SELECT COUNT(Id) FROM Contact WHERE LastModifiedDate < LAST_N_YEARS:5" -o <org-alias> --json
sf data query -q "SELECT COUNT(Id) FROM Lead WHERE Email LIKE '%test%' OR Email LIKE '%example.com'" -o <org-alias> --json
```

Flag: personal data retained beyond the documented retention period (GDPR Art. 5(1)(e)), and obvious test/dummy records in production. Recommend a documented retention and deletion policy plus a scheduled purge job.

#### 4e. Data Export & Exfiltration Paths

```bash
grep -rn 'PermissionsDataExport\|PermissionsWeeklyDataExport\|PermissionsExportReport\|PermissionsRunReports' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
```

Flag broad grants of Export Reports / Weekly Data Export / Manage Reports in Public Folders. Recommend Transaction Security Policies to alert on large exports.

### Step 5: Integration & Credential Security

#### 5a. Named Credentials vs. Hard-coded Endpoints

```bash
find <source-path> -name '*.namedCredential-meta.xml' -o -name '*.externalCredential-meta.xml' 2>/dev/null
grep -rn 'callout:' <source-path>/classes/ --include='*.cls'
grep -rnE 'setEndpoint\(\s*['"'"'"]https?://' <source-path>/classes/ --include='*.cls'
grep -rn 'new HttpRequest\|new Http(' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
```

Every `setEndpoint` with a literal URL instead of `callout:` is a finding: the credential is either hard-coded or stored unsafely, and the endpoint cannot be rotated per environment. Severity High (Critical if a credential is embedded in the URL or a header).

Also check for TLS downgrade: any `http://` endpoint is Critical.

#### 5b. Named / External Credential Configuration

For each Named Credential found, read the metadata and check:
- Authentication protocol (prefer OAuth 2.0 / JWT over Password Authentication).
- `generateAuthorizationHeader` behavior and whether the callout class re-adds credentials manually.
- Whether `allowMergeFieldsInHeader` / `allowMergeFieldsInBody` is enabled — this permits `{!$Credential...}` leakage into logs; flag when combined with debug logging.
- Per-user vs. named principal — named principal with broad access is a shared-secret risk.

#### 5c. Connected Apps & OAuth

```bash
sf data query -q "SELECT Name, CreatedDate, LastModifiedDate FROM ConnectedApplication" -o <org-alias> --json
find <source-path> -name '*.connectedApp-meta.xml' 2>/dev/null
grep -rn 'scopes\|oauthConfig\|refreshTokenPolicy\|ipRanges' <source-path>/connectedApps/ 2>/dev/null
```

Flag:
- Connected Apps with `Full access (full)` or `refresh_token` where a narrower scope suffices.
- `refreshTokenPolicy` set to infinite validity.
- Missing IP relaxation restrictions ("Relax IP restrictions" enabled).
- Apps with permitted users = "All users may self-authorize" (should be "Admin approved users are pre-authorized").
- Apps not modified in 12+ months or with no known owner → decommission candidates.

#### 5d. Remote Sites, Trusted Sites & CORS

```bash
find <source-path> -name '*.remoteSiteSetting-meta.xml' 2>/dev/null
find <source-path> -name '*.cspTrustedSite-meta.xml' 2>/dev/null
find <source-path> -name '*.corsWhitelistOrigin-meta.xml' 2>/dev/null
```

Flag: `http://` remote sites, wildcard origins (`*`), CSP trusted sites permitting `unsafe-inline`/`unsafe-eval`, and any entry with no documented owner. Every allowed origin widens the exfiltration surface.

#### 5e. Inbound API Surface

Cross-reference the attack surface inventory from Step 1f. For each `@RestResource` and `webservice` method, verify:
- Authentication is enforced (no `Site` guest access unless intentional).
- Input is validated and bound, not concatenated.
- The response does not return more fields than required.
- Rate limiting / Transaction Security exists for bulk read endpoints.

### Step 6: Org & Session Configuration

Most items here require Setup access. Attempt where CLI is possible; otherwise emit precise manual instructions.

#### 6a. Health Check

Manual action: "Setup > Security > Health Check — record the score and export the list of High-Risk settings. Target: ≥ 90%, minimum acceptable 80%. Attach the export to this report."

#### 6b. Password & Session Policy

```bash
find <source-path> -name '*.securitySettings-meta.xml' -o -name 'Security.settings-meta.xml' 2>/dev/null
grep -rn 'sessionTimeout\|lockoutInterval\|minimumPasswordLength\|passwordExpiration\|forceLogoutOnSessionTimeout\|enableCSRFOnGet\|enableClickjackUserPageHeaderless' <source-path> --include='*.settings-meta.xml' 2>/dev/null
```

Baseline to check against:
- Minimum password length ≥ 10, complexity = letters/numbers/special, expiry ≤ 90 days, history ≥ 5.
- Session timeout ≤ 2 hours (≤ 30 min for privileged profiles), "Force logout on session timeout" enabled, "Lock sessions to IP" enabled where feasible.
- Clickjack protection enabled for all page types (Setup, non-Setup, VF with/without headers).
- CSRF protection enabled on GET and POST requests.
- "Require HttpOnly attribute" enabled.

#### 6c. MFA & Authentication

Manual action: "Verify MFA is enforced for all interactive logins (Salesforce MFA requirement) — check via Setup > Identity Verification and the MFA Assignment permission. Confirm no profile has 'Waive Multi-Factor Authentication for Exempt Users'."

```bash
grep -rn 'PermissionsMultiFactorAuthUiLogins\|MFA' <source-path>/profiles/ <source-path>/permissionsets/ 2>/dev/null
```

Also check SSO configuration:

```bash
find <source-path> -name '*.samlSsoConfig-meta.xml' -o -name '*.authProvider-meta.xml' 2>/dev/null
```

Flag SAML configs with signing disabled, or auth providers with overly broad scopes.

#### 6d. Login Restrictions

```bash
grep -rn 'loginIpRanges\|loginHours' <source-path>/profiles/ 2>/dev/null
```

Flag high-privilege profiles (admin, integration) without login IP ranges or login hour restrictions.

#### 6e. Certificates & My Domain

Manual actions:
- "Setup > Certificate and Key Management — list all certificates and their expiry dates; flag anything expiring within 90 days and any key < 2048 bit."
- "Setup > My Domain — confirm My Domain is deployed, that redirects for legacy `*.salesforce.com` URLs are disabled where possible, and that HSTS/HTTPS-only is enforced."

### Step 7: Monitoring, Audit & Response

#### 7a. Setup Audit Trail

Manual action: "Setup > Security > View Setup Audit Trail — export the last 6 months and review for unexpected permission changes, profile edits, new Connected Apps, and certificate changes made outside change windows. The trail retains only 180 days; recommend automated export."

#### 7b. Event Monitoring / Shield

Manual action: "Verify Shield Event Monitoring licensing and that these event types are streamed to the SIEM: Login, LoginAs, ApiEvent, ReportEvent, ListViewEvent, UriEvent, LightningPageView, BulkApiResultEvent, CredentialStuffingEvent, PermissionSetEvent, SessionHijackingEvent."

#### 7c. Transaction Security Policies

Manual action: "Setup > Transaction Security Policies — confirm policies exist for: large data export, login from anomalous IP, credential stuffing, session hijacking, permission set assignment of admin-level sets."

#### 7d. Field History & Audit Fields

```bash
grep -rn 'trackHistory>true' <source-path>/objects/ --include='*.field-meta.xml' | wc -l
grep -rn 'enableHistory' <source-path>/objects/ --include='*.object-meta.xml'
```

Flag sensitive fields (from the Step 4a inventory) without history tracking, and objects with history tracking disabled entirely.

#### 7e. Incident Response Readiness

Assess and report (qualitative — ask the user if unknown):
- Is there a documented incident response plan naming a Salesforce owner?
- Is there a tested procedure to revoke a compromised session/OAuth token org-wide?
- Are backups verified restorable (Salesforce's own recovery service is not a backup)?
- Is there an offboarding checklist that freezes users and revokes tokens?

### Step 8: PMD Security Ruleset

```bash
pmd check -d <source-path>/classes/ -R <pmd-rules-file> -f json --no-cache
```

Filter the JSON output to the security ruleset (`category/apex/security.xml`) — `ApexCRUDViolation`, `ApexSharingViolations`, `ApexSOQLInjection`, `ApexOpenRedirect`, `ApexInsecureEndpoint`, `ApexXSSFromURLParam`, `ApexXSSFromEscapeFalse`, `ApexBadCrypto`, `ApexCSRF`, `ApexDangerousMethods`, `ApexSuggestUsingNamedCred`.

Report every security-category violation individually with file, line, rule, and fix. Non-security PMD findings belong to `/code-review`, not this report.

If PMD is not installed, add "Install PMD and wire the Apex security ruleset into CI" to the action plan as a High item.

### Step 9: Delegate to Code Review

Invoke the `/code-review` skill. Reference its security-relevant findings in this report and cross-link; do not duplicate its general quality analysis.

### Step 10: Generate the Security Report

Save to `org_assessment/<YYYY-MM-DD>-security-orgreview.md`. Write the report in the **documentation language** from `customer.config.md`.

**Scoring model (100 points):**

| Domain | Weight | Deductions |
|--------|--------|-----------|
| Apex Security | 20 | CRUD/FLS gap on exposed entry point −5 each (max −10); `without sharing` on exposed class −4 each (max −8); SOQL injection −5 each; hard-coded secret −5 each; weak crypto −3; empty catch −1 each (max −3); info disclosure −2 each (max −4) |
| UI Layer | 15 | XSS −5 each (max −10); CSRF −3 each; open redirect −3 each; CSP violation −2 each (max −4); secrets in client storage −3; guest-accessible component with unenforced controller −5 |
| Access & Permissions | 20 | Profile/PS with Modify All Data −3 each (max −9); View All Data −2 each (max −6); excess admins −3; dormant privileged users −2 (max −4); over-assigned permission set −2 each (max −4); OWD ReadWrite on sensitive object −3 each (max −6); guest profile over-permissioned −8 |
| Data Protection | 15 | Untagged PII field −1 each (max −5); unencrypted Restricted field −3 each (max −6); no retention policy −3; test data in prod −2; broad export permissions −2 |
| Integration & Credentials | 15 | Hard-coded endpoint −2 each (max −6); `http://` endpoint −5 each; Connected App with full scope −3 each (max −6); self-authorizing Connected App −3; wildcard CORS origin −3 each; unauthenticated REST endpoint −5 each |
| Org & Session Config | 10 | Health Check < 80% −4; weak password policy −2; session timeout > 2h −2; clickjack/CSRF protection off −2 each; MFA not enforced −5; no IP restriction on privileged profiles −2 |
| Monitoring & Audit | 5 | No Event Monitoring −2; no transaction security policies −1; sensitive fields without history −1; no incident response plan −1 |

Never let a domain score drop below 0. Map score to a traffic light: ≥ 85 green, 60–84 yellow, < 60 red. Any single Critical finding forces the overall status to red regardless of score.

**Report structure:**

1. **Zusammenfassung (Executive Summary)** — overall score, traffic light, per-domain score table, count of findings by severity (Critical/High/Medium/Low), the top 5 findings a non-technical reader must understand, and a one-paragraph verdict.
2. **Kritische Befunde (Critical Findings)** — every Critical finding in full, each with: what it is, exact file:line or setup location, how it could be exploited (concrete, realistic), business impact, and the exact fix.
3. **Domain sections 3–9**, one per assessment domain. Each contains:
   - **Score & Status**
   - **Ergebnisse (Findings)** — table: ID, finding, location (file:line or Setup path), severity, evidence
   - **Empfehlungen (Recommendations)** — per finding: what to do, why it matters, effort (S/M/L/XL + hours), priority, owner role
   - **Verbesserungsvorschläge (Improvements)** — preventive measures: PMD/CI gates, code review checklists, policy changes, recurring audits
4. **Angriffsfläche (Attack Surface Inventory)** — the table from Step 1f, plus guest-accessible surfaces and inbound APIs.
5. **PII-Inventar** — the table from Step 4a with classification and encryption status.
6. **Security Technical Debt** — consolidated posture table:

   | Control | Current State | Target | Status |
   |---------|--------------|--------|--------|
   | CRUD/FLS enforcement | (n) unenforced entry points | 100% enforced (USER_MODE / stripInaccessible) | pass/fail |
   | Sharing enforcement | (n) `without sharing` exposed classes | Least privilege, documented exceptions only | pass/fail |
   | Injection defense | (n) unsafe dynamic queries | Bind variables everywhere | pass/fail |
   | Secrets management | (n) hard-coded secrets | Named/External Credentials only | pass/fail |
   | Permission model | (n) Modify All Data grants | Minimal profile + Permission Set Groups | pass/fail |
   | PII protection | (n) untagged / (n) unencrypted | Classified + Shield-encrypted | pass/fail |
   | Transport security | (n) `http://` endpoints | TLS 1.2+ everywhere | pass/fail |
   | Authentication | MFA status | MFA enforced, SSO with signed SAML | pass/fail |
   | Session hardening | Health Check score | ≥ 90% | pass/fail |
   | Monitoring | Event Monitoring status | Streamed to SIEM + Transaction Security | pass/fail |

7. **PMD Security Findings** — every security-category violation with file, line, rule, fix.
8. **Code Review Cross-Reference** — security-relevant findings from `/code-review`.
9. **Maßnahmenplan (Remediation Plan)** — exhaustive numbered table:

   | # | Finding | Domain | Severity | Fix | Owner | Effort | Automatable |
   |---|---------|--------|----------|-----|-------|--------|-------------|

   Grouped as: **P0 — fix now** (exploitable, data exposure), **P1 — fix this sprint**, **P2 — next quarter**, **P3 — backlog**. Per group: total effort, dependencies, and quick wins doable in under a day. Every manual task gets its exact Setup navigation path.
10. **Nächste Schritte (Next Steps)** — this week / next 2 sprints / this quarter / continuous (recurring Health Check, quarterly access review, PMD in CI, annual penetration test).
11. **Anhang: Nicht prüfbare Punkte** — every check that could not be automated (no org access, Setup-only), listed as explicit manual tasks so nothing is silently dropped.

### Step 11: Save & Compare

1. Save the report to `org_assessment/<YYYY-MM-DD>-security-orgreview.md` (create the directory if missing).
2. If a previous security review exists in that folder, add a **Delta** section: score change per domain, findings resolved, findings still open, new findings, and regression count.

### Step 12: Create Log File

Create `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-security-orgreview.json` under `.claude/skills/17-security-orgreview/logs/`, using the standard JSON schema from CLAUDE.md.

### Step 13: Summary to the User

Present:
- Overall security score and traffic light
- Per-domain scores
- Counts by severity (Critical / High / Medium / Low)
- The Critical findings, named
- Path to the saved report and to the `/code-review` output
- The top 3 P0 actions

## Important Rules

- **Read-only audit.** Never modify code, metadata, or org configuration during this review. Never "fix as you go".
- **Never write findings, secrets, or excerpts of sensitive data into the customer-accessible main repository** beyond the report itself — and never paste discovered secret values into the report; reference them by `file:line` only, with the value redacted.
- Any secret found in source must be reported as **compromised** — the remediation is rotation plus removal from git history, not deletion of the line.
- Read all source paths, org aliases, PMD rule files, and sensitive-field names from `stack.config.md` and `customer.domain.md`. Never hardcode.
- When an automated check cannot run (no org access, CLI error, missing tool), do **not** drop it — move it to the manual task appendix with exact Setup navigation and mark the affected domain score as "unverified" rather than assuming pass.
- Grep results are indicators, not verdicts. Read the surrounding code before assigning a severity, and drop false positives explicitly (note them in the report so the next review does not re-raise them).
- Severity must reflect exploitability, not pattern count: an unreachable `without sharing` utility is not equivalent to a guest-exposed one.
- Output text uses the **documentation language** from `customer.config.md`.

## Error Handling

- **No org access / auth failure:** run all file-based checks (grep, metadata, PMD) and route every org-dependent check to the manual appendix. Do not abort.
- **PMD missing:** note it, add installation to the action plan, continue.
- **`/code-review` fails:** note it in section 8 and continue.
- **`org_assessment/` missing:** create it.
- **Empty source path / metadata not retrieved locally:** tell the user to run a metadata retrieve first, and continue with org-based checks only.

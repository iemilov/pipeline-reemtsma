---
name: ai-readiness-assessment
description: Use when performing a Salesforce org AI-readiness assessment — scans Apex for time bombs, audits automations, evaluates data health and security posture, and generates a scored report with an executable action plan
argument-hint: [org-alias (optional, defaults to default org from stack.config.md)]
---

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. If the customer uses a different platform, inform the user and abort.

## Assessment Domains

This assessment evaluates AI-readiness across 7 domains, each scored independently:

| # | Domain | Weight | Focus |
|---|--------|--------|-------|
| 1 | **Code & Automation** (The Logic Layer) | 20 pts | SOQL in loops, hard-coded IDs, trigger framework, legacy automations (Workflow/Process Builder), test assertion quality, full code review via `/code-review` skill |
| 2 | **UI Components** (VF / Aura / LWC) | 15 pts | Visualforce migration candidates, Aura-to-LWC migration, XSS/CSRF/CSP vulnerabilities, performance hotspots, wire vs. imperative Apex |
| 3 | **Data Health** (The AI Grounding Layer) | 20 pts | Ghost fields, duplicate density, picklist vs. text standardization, metadata descriptions, semantic data mapping, data classification, relationship density, data freshness |
| 4 | **Security & Access** (The Safety Layer) | 20 pts | Health Check score, permission model (Profile vs. Perm Set), PII discovery, LLM data leakage, Shield Event Monitoring, sharing model robustness, prompt template guardrails, red team test |
| 5 | **Architecture & Integration** (The Integration Layer) | 15 pts | Connected Apps, REST vs. SOAP modernization, event-driven architecture, External Services actionability, Named Credentials, Data Cloud readiness, object model complexity |
| 6 | **Change Management** (The People & Process Layer) | 10 pts | Executive sponsorship, training roadmap, AI governance policies, feedback loops, KPIs, rollback plan |
| 7 | **Apex AI Red Flags** | — | Cross-cutting scan for code patterns that interfere with AI-triggered transactions (`without sharing`, dynamic SOQL, empty catch blocks, `getGlobalDescribe` in loops, etc.) |

Additionally, two cross-cutting activities are performed:
- **PMD Static Analysis** — full codebase scan using project PMD rules
- **Code Review** — delegated to the `/code-review` skill

The final report includes per-domain findings, recommendations, and improvement suggestions, plus a consolidated action plan and a phased next-steps roadmap.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` for customer identity, documentation language, Atlassian settings
- `pipeline/stack.config.md` for source path, naming prefixes, PMD rules, org aliases, trigger framework details
- `pipeline/customer.domain.md` for domain-specific business logic and field naming conventions
- `org_assessment/ai-readiness-checklist.md` for the full checklist structure

Resolve org alias: use `$ARGUMENTS` if provided, otherwise use the first org alias from `stack.config.md`.

## Workflow: Org → Assessment Report + Action Plan

### Step 1: Code & Automation Review (The Logic Layer)

#### 1a. SOQL in Loops

Scan all Apex classes under the source path for SOQL queries inside `for` loops:

```bash
grep -rn 'for\s*(.*' <source-path>/classes/ | grep -l '\.cls$'
```

Then for each file with a `for` loop, check if it contains a SOQL query (`[SELECT`, `Database.query`) inside the loop body. Record each violation with file path and line number.

#### 1b. Hard-coded IDs

Scan Apex classes and Flows for 15- or 18-character Salesforce IDs:

```bash
grep -rnE '[a-zA-Z0-9]{5}0{2}[a-zA-Z0-9]{8}([a-zA-Z0-9]{3})?' <source-path>/classes/ --include='*.cls'
grep -rnE '[a-zA-Z0-9]{5}0{2}[a-zA-Z0-9]{8}([a-zA-Z0-9]{3})?' <source-path>/flows/ --include='*.flow-meta.xml'
```

Filter out test classes (`*Test.cls`) and known false positives (string literals in comments). Record each violation.

#### 1c. Trigger Consolidation

List all trigger files and check for multiple triggers on the same sObject:

```bash
find <source-path>/triggers/ -name '*.trigger' -exec grep -l 'trigger ' {} \;
```

Parse each trigger file to extract the sObject name. Flag any sObject with more than one trigger.

#### 1d. Trigger Framework Evaluation

Check if the project uses a trigger framework by looking for:
- `MetadataTriggerHandler` references in trigger files
- `TriggerAction` interface implementations in classes
- `Trigger_Action__mdt` or `sObject_Trigger_Setting__mdt` custom metadata

If `stack.config.md` documents a trigger framework (check the Architecture section), note it as compliant. Otherwise flag as missing.

#### 1e. Automation Migration (Workflow & Process Builder)

Scan for legacy automation metadata:

```bash
find <source-path> -name '*.workflow-meta.xml' -o -name '*.process-meta.xml' | head -50
```

Count active Workflow Rules and Process Builder processes. Each one found is a migration candidate.

#### 1f. Visualforce Pages

Inventory all Visualforce pages:

```bash
find <source-path>/pages/ -name '*.page' 2>/dev/null | wc -l
```

For each page found, scan for security vulnerabilities:

- **XSS (unescaped output):** Search for `{!` expressions not wrapped in `HTMLENCODE`, `JSENCODE`, or `URLENCODE`:
  ```bash
  grep -rnE '\{![^}]*(HTMLENCODE|JSENCODE|URLENCODE)' <source-path>/pages/ --include='*.page' -L
  ```
  Files NOT in this list lack encoding — flag each unescaped `{! }` expression.

- **CSRF:** Check for raw HTML `<form>` tags instead of `<apex:form>`:
  ```bash
  grep -rn '<form ' <source-path>/pages/ --include='*.page'
  ```

- **Inline scripts:** Detect inline `<script>` or `<style>` blocks that violate CSP:
  ```bash
  grep -rn '<script\|<style' <source-path>/pages/ --include='*.page'
  ```

Every Visualforce page is a migration candidate — it cannot participate in Agentforce or Einstein AI surfaces.

#### 1g. Aura Components

Inventory all Aura components:

```bash
find <source-path>/aura/ -name '*.cmp' 2>/dev/null | wc -l
```

For each component, scan for:

- **Open redirect vulnerabilities:**
  ```bash
  grep -rn 'navigateToURL\|window\.location' <source-path>/aura/ --include='*.js'
  ```

- **Performance hotspots — server calls in loops:**
  ```bash
  grep -rn 'enqueueAction' <source-path>/aura/ --include='*.js'
  ```
  Cross-reference with loop patterns (`forEach`, `for (`) in the same file to flag server calls inside loops.

- **Missing storable actions:** Check controller JS files for `action.setStorable()` usage. Cacheable server calls without `setStorable` cause unnecessary round-trips.

All Aura components are LWC migration candidates — Aura is in maintenance mode.

#### 1h. Lightning Web Components (LWC)

Inventory all LWC components:

```bash
find <source-path>/lwc/ -name '*.js' -not -name '*.test.js' 2>/dev/null | wc -l
```

Scan for security and performance issues:

- **DOM manipulation bypass (XSS risk):**
  ```bash
  grep -rn 'lwc:dom="manual"\|innerHTML\|eval(' <source-path>/lwc/ --include='*.js' --include='*.html'
  ```

- **Imperative Apex without error handling:**
  ```bash
  grep -rn 'import.*from.*@salesforce/apex' <source-path>/lwc/ --include='*.js'
  ```
  For each imperative import, check if calls include `.catch()` or try/catch. Flag unhandled calls.

- **CSP violations — external script loading:**
  ```bash
  grep -rn '<script src=' <source-path>/lwc/ --include='*.html'
  ```

- **Performance — wire vs. imperative:** Count `@wire` usage vs. imperative Apex calls. A low wire-to-imperative ratio suggests missed caching opportunities.

#### 1i. Test Quality Check

Scan test classes for assertion usage:

```bash
grep -rn 'System\.assert\|Assert\.' <source-path>/classes/ --include='*Test.cls'
```

Count test methods (methods annotated with `@isTest` or `testMethod`) and compare against methods containing at least one `System.assert*` or `Assert.*` call. Calculate assertion coverage percentage.

#### 1j. Delegate to Code Review

Invoke the `/code-review` skill for the full code quality, security, and architecture review. Reference its output in the final report rather than duplicating the analysis.

### Step 2: Data Health Assessment (The AI Grounding Layer)

These checks require org access. For each, attempt the query. If no org connection is available, add to the action plan as a manual task.

#### 2a. Field Usage — Ghost Fields

Query custom fields with no data:

```bash
sf data query -q "SELECT QualifiedApiName, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName IN ('Account','Contact','Case','Opportunity','Lead') AND IsCustom = true" -o <org-alias> --json
```

For each custom field found, sample 100 records to estimate population rate. Fields with 0% population are Ghost Fields.

If the query fails or no org is connected, add to the action plan: "Run Salesforce Optimizer or Field Trip to identify Ghost Fields."

#### 2b. Duplicate Density

Add to the action plan: "Run Duplicate Jobs via Setup > Duplicate Management > Duplicate Jobs. Target: duplicate rate below 2%."

This cannot be automated via CLI — it requires Setup UI access.

#### 2c. Standardization — Picklist vs. Text

Query field types on key objects:

```bash
sf data query -q "SELECT QualifiedApiName, DataType FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = 'Account' AND IsCustom = true" -o <org-alias> --json
```

Identify text fields that could be picklists (fields with a small set of distinct values). If no org access, add to the action plan.

#### 2d. Metadata Description Audit

Query object and field descriptions on the top 10 objects:

```bash
sf data query -q "SELECT QualifiedApiName, Description, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName IN ('Account','Contact','Case','Opportunity','Lead') AND IsCustom = true AND Description = null" -o <org-alias> --json
```

Count fields with missing descriptions. Also check object-level descriptions:

```bash
sf data query -q "SELECT QualifiedApiName, Description FROM EntityDefinition WHERE QualifiedApiName IN ('Account','Contact','Case','Opportunity','Lead')" -o <org-alias> --json
```

Flag each object or field with a blank description. For the report, calculate the percentage of described vs. undescribed metadata. If no org access, add to the action plan.

#### 2e. Semantic Data Mapping

Identify long text fields that may contain buried business context:

```bash
sf data query -q "SELECT QualifiedApiName, DataType, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE DataType IN ('TextArea(Long)', 'TextArea(Rich)') AND EntityDefinition.QualifiedApiName IN ('Case','Task','Account','Contact','Opportunity')" -o <org-alias> --json
```

Flag each long text field as a candidate for AI summarization via Prompt Builder. If no org access, add to the action plan.

#### 2f. Data Classification & Sensitivity Tags

Add to the action plan: "Use Setup > Data Classification to tag all custom fields with Data Sensitivity (Public, Internal, Confidential, Highly Sensitive) and Compliance categories (GDPR, PII). Required for Einstein Trust Layer masking rules."

This requires Setup UI access and cannot be fully automated via CLI.

#### 2g. Relationship & Hierarchy Density

Scan local metadata for custom objects lacking Account or Contact lookups:

```bash
find <source-path>/objects/ -name '*.object-meta.xml' -exec grep -L 'referenceTo.*Account\|referenceTo.*Contact' {} \;
```

Cross-reference with actual Lookup/Master-Detail fields in each object's `fields/` directory. Flag custom objects that have no relationship to Account or Contact as potential data silos.

#### 2h. Frequency & Freshness Analysis (Data Velocity)

Query record freshness on core objects:

```bash
sf data query -q "SELECT COUNT(Id) total, COUNT_DISTINCT(CALENDAR_YEAR(LastModifiedDate)) years FROM Lead WHERE LastModifiedDate < LAST_N_YEARS:2" -o <org-alias> --json
sf data query -q "SELECT COUNT(Id) total FROM Lead" -o <org-alias> --json
```

Calculate the percentage of stale records (not modified in 2+ years) for Lead, Opportunity, Case, and Account. Flag if stale percentage exceeds 50%. If no org access, add to the action plan.

### Step 3: Security & Access Audit (The Safety Layer)

#### 3a. Health Check Score

Add to the action plan: "Run Security Health Check via Setup > Security > Health Check. Target score: 80% or higher."

This requires Setup UI access and cannot be automated via CLI.

#### 3b. Ghost Access Cleanup (Profile vs. Permission Set)

Query profiles and permission sets with elevated access:

```bash
sf data query -q "SELECT Name, PermissionsViewAllData, PermissionsModifyAllData FROM Profile WHERE PermissionsViewAllData = true OR PermissionsModifyAllData = true" -o <org-alias> --json
sf data query -q "SELECT Name, PermissionsViewAllData, PermissionsModifyAllData FROM PermissionSet WHERE PermissionsViewAllData = true OR PermissionsModifyAllData = true" -o <org-alias> --json
```

Flag each profile/permission set with `View All Data` or `Modify All Data`.

Also identify "kitchen-sink" profiles with excessive permissions:

```bash
sf data query -q "SELECT Profile.Name, COUNT(Id) permCount FROM PermissionSetAssignment WHERE PermissionSet.IsOwnedByProfile = false GROUP BY Profile.Name HAVING COUNT(Id) > 5 ORDER BY COUNT(Id) DESC" -o <org-alias> --json
```

If no org access, add to the action plan.

#### 3c. PII & Sensitive Data Discovery

Scan for fields likely containing PII (fields named `*Email*`, `*Phone*`, `*SSN*`, `*Birth*`, `*Address*`, `*PersonalId*`, `*CreditCard*`, `*IBAN*`):

```bash
sf data query -q "SELECT QualifiedApiName, EntityDefinition.QualifiedApiName, SecurityClassification, ComplianceGroup FROM FieldDefinition WHERE IsCustom = true AND (QualifiedApiName LIKE '%Email%' OR QualifiedApiName LIKE '%Phone%' OR QualifiedApiName LIKE '%SSN%' OR QualifiedApiName LIKE '%Birth%' OR QualifiedApiName LIKE '%Address%' OR QualifiedApiName LIKE '%IBAN%')" -o <org-alias> --json
```

Flag PII fields where `SecurityClassification` is null (not tagged) or where Shield Platform Encryption is not enabled. If no org access, add to the action plan.

Also scan for PII patterns buried in unstructured text fields (Description, Comments) — add to the action plan as a manual review item since this requires data sampling.

#### 3d. LLM Data Leakage Audit

Scan Apex for direct callouts to external LLM APIs:

```bash
grep -rnE 'api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.cohere\.ai' <source-path>/classes/ --include='*.cls'
grep -rn 'ChatCompletion\|completions\|claude\|gemini' <source-path>/classes/ --include='*.cls' | grep -i 'endpoint\|url\|callout'
```

Each direct LLM callout that does not route through the Einstein Trust Layer is a data leakage risk. Record file paths and flag as Critical.

#### 3e. Shield Event Monitoring & Prompt Injection Readiness

Add to the action plan: "Review Shield Event Monitoring configuration via Setup > Event Monitoring. Verify that AIGenerateTextEvent and AIPromptEvent log types are enabled. These provide an audit trail of all AI prompts and responses."

This requires Setup UI access and cannot be fully automated via CLI.

#### 3f. Sharing Model Robustness

Scan for sharing model configuration in local metadata:

```bash
find <source-path>/objects/ -name '*.sharingRules-meta.xml' 2>/dev/null
find <source-path>/objects/ -name '*.object-meta.xml' -exec grep -l 'sharingModel' {} \;
```

For each object, check the `sharingModel` value. Flag objects with `ReadWrite` (Public Read/Write) sharing that contain sensitive data. Also scan for Apex managed sharing:

```bash
grep -rn 'Share\b.*insert\|\.ShareAccessLevel\|\.RowCause' <source-path>/classes/ --include='*.cls'
```

Apex managed sharing is harder for AI to predict — flag for review and recommend migration to Criteria-Based Sharing Rules where possible.

#### 3g. Prompt Template Security Review

Scan for Prompt Builder templates in local metadata:

```bash
find <source-path> -name '*.genAiPromptTemplate-meta.xml' -o -name '*.promptTemplate-meta.xml' 2>/dev/null
```

For each template found, read its content and check:
- Does it contain explicit safety guardrail instructions (e.g., restrictions on data topics)?
- Does it reference fields that should be masked?

Flag templates without safety guardrails. If no templates exist locally, add to the action plan: "Audit all Prompt Builder templates in Setup > Einstein > Prompt Builder for safety instructions."

#### 3h. Red Team Test

Add to the action plan as a manual validation task:

"**Red Team Test:** Before enabling AI, have a power user search for sensitive data via Global Search. If Global Search returns confidential records (payroll, executive compensation, HR data), the AI will be able to access them too. Tighten sharing rules for any exposed data."

#### 3i. Security Technical Debt Summary

Compile findings from 3a–3h into a summary table in the report:

| Safety Check | Current State | AI-Ready Standard | Status |
|-------------|--------------|-------------------|--------|
| User Permissions | (count) profiles with Modify/View All Data | Permission Set Groups (Least Privilege) | pass/fail |
| Data Masking | (count) untagged PII fields | Shield Platform Encryption + Data Tags | pass/fail |
| LLM Data Flow | (count) direct external LLM callouts | Einstein Trust Layer / Secure Gateway | pass/fail |
| Audit Logs | Event Monitoring status | Shield Event Monitoring (AI Events) | pass/fail |
| Object Sharing | (count) objects with Public Read/Write | Scoped Sharing Rules & Restriction Rules | pass/fail |
| Prompt Safety | (count) templates without guardrails | Explicit safety instructions per template | pass/fail |

### Step 4: Architectural Readiness (The Integration Layer)

#### 4a. Connected Apps Inventory

```bash
sf data query -q "SELECT Name, CreatedDate, LastModifiedDate FROM ConnectedApplication" -o <org-alias> --json
```

List all Connected Apps. Flag any not modified in the last 12 months as candidates for removal. If no org access, add to the action plan.

#### 4b. REST over SOAP (Modernization Audit)

Scan Apex classes for SOAP-based integration patterns:

```bash
grep -rn 'WebServiceCallout\|HttpRequest.*SOAPAction\|Dom\.Document\|Dom\.XmlNode' <source-path>/classes/ --include='*.cls'
grep -rn 'wsdl2apex\|WebServiceMock' <source-path>/classes/ --include='*.cls'
```

Also scan for WSDL-generated classes (typically named `*Soap.cls`, `*Port.cls`, `*Service.cls`):

```bash
find <source-path>/classes/ -name '*Soap.cls' -o -name '*Port.cls' -o -name '*Service.cls' | head -20
```

Each SOAP integration found is a modernization candidate. Record file paths and add REST migration to the action plan.

#### 4c. Event-Driven Architecture (EDA) Check

Scan for batch-only sync patterns vs. event-driven patterns:

```bash
# Batch patterns (candidates for migration to real-time)
grep -rn 'implements Schedulable\|System\.schedule\|Database\.Batchable' <source-path>/classes/ --include='*.cls'

# Event-driven patterns already in use (positive signals)
find <source-path> -name '*.platformEvent-meta.xml' 2>/dev/null | wc -l
grep -rn 'EventBus\.publish\|ChangeEventHeader' <source-path>/classes/ --include='*.cls'
```

Count scheduled batch jobs vs. Platform Event / CDC usage. A high batch-to-event ratio indicates the org relies on stale data — flag for the action plan.

#### 4d. Actionability Audit (External Services)

Check for existing External Services and Named Credentials:

```bash
find <source-path> -name '*.externalServiceRegistration-meta.xml' 2>/dev/null | wc -l
find <source-path> -name '*.namedCredential-meta.xml' 2>/dev/null
```

Scan Apex for direct HTTP callouts that could be converted to External Services:

```bash
grep -rn 'new HttpRequest\|new Http(' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
```

Each direct callout without a corresponding External Service is a candidate for conversion. Record file paths.

#### 4e. Identity & Authentication Handshakes

Scan for hard-coded API keys and credentials in Apex (security red flag):

```bash
grep -rnE '(api[_-]?key|apikey|secret|token|password|authorization)\s*=' <source-path>/classes/ --include='*.cls' -i | grep -v 'Test\.cls'
```

Check Named Credential usage vs. hard-coded endpoints:

```bash
grep -rn 'callout:' <source-path>/classes/ --include='*.cls'
grep -rn 'Endpoint\s*=' <source-path>/classes/ --include='*.cls' | grep -v 'callout:'
```

Named Credentials use `callout:` prefix. Direct endpoint assignments without `callout:` indicate integrations not using Named Credentials — flag for OAuth migration.

#### 4f. Virtualization vs. Storage (Data Cloud Readiness)

Identify large custom objects that may be candidates for externalization:

```bash
sf data query -q "SELECT QualifiedApiName, RecordCount FROM EntityDefinition WHERE IsCustom = true AND RecordCount > 100000 ORDER BY RecordCount DESC" -o <org-alias> --json
```

Flag custom objects with 100k+ records that are primarily read-only reference data. If no org access, add to the action plan: "Review custom objects with high record counts for Data Cloud or External Object migration."

#### 4g. Object Model Complexity

Count custom fields per key object:

```bash
find <source-path>/objects/ -name '*.field-meta.xml' | sed 's|.*/objects/||;s|/fields/.*||' | sort | uniq -c | sort -rn | head -20
```

Flag objects with 200+ custom fields as exhibiting "Object Bloat."

#### 4h. Integration Technical Debt Summary

Compile findings from 4a–4g into a summary table in the report:

| Item | Current State | AI-Ready Target | Status |
|------|--------------|-----------------|--------|
| Protocol | (SOAP count) SOAP / (REST count) REST | REST / JSON | pass/fail |
| API Documentation | (External Services count) documented | OpenAPI (Swagger) 3.0 | pass/fail |
| Auth Strategy | (Named Cred count) Named / (hard-coded count) Hard-coded | Named Credentials + OAuth | pass/fail |
| Sync Pattern | (batch count) Batch / (event count) Event-driven | Real-time (Platform Events / CDC) | pass/fail |
| Data Residency | (large object count) objects >100k records | Data Cloud / Zero Copy | pass/fail |

### Step 5: Change Management (The People & Process Layer)

All items in this section are organizational — they cannot be automated. Add each unchecked item from the checklist directly to the action plan with clear instructions on what to do and who should own it.

### Step 6: Apex Red Flag Keyword Scan

Scan Apex classes for patterns that interfere with AI-triggered transactions. Run these in parallel:

```bash
grep -rn 'Database\.query' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
grep -rn 'System\.runAs' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
grep -rn '@future\|System\.enqueueJob' <source-path>/classes/ --include='*.cls'
grep -rn 'without sharing' <source-path>/classes/ --include='*.cls'
grep -rn 'new Http(' <source-path>/classes/ --include='*.cls'
grep -rn 'Trigger\.old\|Trigger\.new' <source-path>/classes/ --include='*.cls' | grep -v '\.trigger'
grep -rn 'getGlobalDescribe\|describeSObjects' <source-path>/classes/ --include='*.cls'
grep -rn 'UserInfo\.getUserId' <source-path>/classes/ --include='*.cls' | grep -v 'Test\.cls'
```

For each hit, categorize by risk:
- **Critical:** `without sharing` in non-test classes, dynamic SOQL with string concatenation, empty catch blocks
- **High:** `@future`/Queueable without limit checks, HTTP callouts without timeout, `getGlobalDescribe` in loops
- **Medium:** `Trigger.old`/`Trigger.new` in classes (should only be in trigger files), `UserInfo.getUserId` coupling

Include a dedicated "AI Red Flags" table in the report with file, line, pattern, and risk level.

### Step 7: Agent Simulation Test

Add to the action plan as a manual validation task:

"**Agent Simulation Test:** Select 5 random records from Account, Case, Opportunity, Lead, and Contact. Hand them to someone unfamiliar with the org. If they cannot explain the customer's status within 60 seconds, the data is too messy for AI. Document which records failed and why."

This is a qualitative exercise — it cannot be automated but should be performed before any AI rollout.

### Step 8: PMD Static Analysis

Run PMD against the full codebase using the rules from `stack.config.md`:

```bash
pmd check -d <source-path>/classes/ -R <pmd-rules-file> -f json
```

Parse the JSON output. Categorize findings by priority:
- Priority 1-2: Critical (security, governor limits)
- Priority 3: Important (code quality)
- Priority 4-5: Improvement (style)

### Step 9: Generate Assessment Report

Save the report to `org_assessment/<YYYY-MM-DD>-ai-readiness-assessment.md`. Use the **documentation language** from `customer.config.md`.

Structure:

#### 1. Zusammenfassung (Executive Summary)

- Overall AI-readiness score (0–100) calculated from findings
- Traffic light per section (green/yellow/red)
- Top 5 most critical findings
- High-level recommendation: what to prioritize first

**Scoring model** (100 points total):
| Section | Weight | Criteria |
|---------|--------|----------|
| Code & Automation (Apex) | 20 pts | Deduct per SOQL-in-loop (-3), hard-coded ID (-2), missing framework (-10), legacy automation (-2 each), low assertion coverage (-5 if <50%) |
| UI Components (VF/Aura/LWC) | 15 pts | Deduct per VF page (-1, max -5), per Aura component (-1, max -5), per XSS vulnerability (-3), per CSP violation (-2), per open redirect (-3), missing error handling on imperative Apex (-1, max -5) |
| Data Health | 20 pts | Deduct per ghost field (-1, max -5), missing duplicate check (-3), text-instead-of-picklist (-1, max -3), missing metadata descriptions (-1 per 10 undescribed fields, max -3), unstructured data without summarization plan (-2), missing data classification (-3), data silos (-2 each, max -4), stale data >50% (-3) |
| Security & Access | 20 pts | Deduct per View/Modify All Data profile (-2, max -6), untagged PII field (-1, max -3), direct LLM callout bypassing Trust Layer (-3 each), missing event monitoring (-3), Public Read/Write on sensitive objects (-2 each, max -4), prompt templates without guardrails (-2 each, max -4), missing health check (-3) |
| Architecture | 15 pts | Deduct per stale Connected App (-1), per SOAP integration (-2, max -4), high batch-to-event ratio (-2), per direct callout without External Service (-1, max -3), per hard-coded credential (-3), large objects without externalization plan (-2), per bloated object (-2, max -4) |
| Change Management | 10 pts | Deduct per missing governance item (-2) |

---

#### 2. Code & Automation (The Logic Layer)

**Score:** X/20 | **Status:** green/yellow/red

##### 2.1 Ergebnisse (Findings)

For each sub-check (SOQL in loops, hard-coded IDs, trigger consolidation, trigger framework, legacy automations, test quality), list:
- Status: pass / warning / fail
- Findings with file path, line number, and severity
- Evidence (grep output, counts)

##### 2.2 Empfehlungen (Recommendations)

Concrete, prioritized recommendations for this domain. For each:
- **What to do** — specific action (e.g., "Refactor SOQL out of the loop in `AccountService.cls:42` into a collection-based query before the loop")
- **Why it matters for AI** — the AI-specific impact (e.g., "AI-triggered bulk DML will hit governor limits and abort the transaction")
- **Effort estimate** — T-shirt size (S/M/L/XL) and approximate hours
- **Priority** — Critical / High / Medium / Low

##### 2.3 Verbesserungsvorschlage (Improvement Suggestions)

Broader improvements beyond immediate fixes:
- Architecture patterns to adopt (e.g., "Implement a centralized SOQL utility class to prevent future SOQL-in-loop regressions")
- Best practices to establish (e.g., "Add PMD rule enforcement as a pre-commit hook")
- Quick wins vs. longer-term initiatives

---

#### 3. UI Components (VF / Aura / LWC)

**Score:** X/15 | **Status:** green/yellow/red

##### 3.1 Ergebnisse (Findings)

For each sub-check (Visualforce inventory/XSS/CSRF/CSP, Aura migration/security/performance, LWC security/wire-vs-imperative/performance/CSP), list:
- Status: pass / warning / fail
- Findings with file path, line number, and severity
- Component inventory counts (VF pages, Aura bundles, LWC components)

##### 3.2 Empfehlungen (Recommendations)

- **Migration roadmap** — prioritized list of Visualforce pages and Aura components to migrate to LWC, ordered by AI interaction surface (record pages first, then app pages, then community pages)
- **Security fixes** — specific XSS, CSRF, CSP, and open redirect vulnerabilities with file:line and fix instructions
- **Performance improvements** — specific components with hotspots (server calls in loops, missing caching, excessive re-renders) with refactoring suggestions

##### 3.3 Verbesserungsvorschlage (Improvement Suggestions)

- LWC migration strategy (phased approach, which components to tackle first)
- Component library standardization (shared base components to reduce duplication)
- Performance monitoring setup (Lightning Usage App, Experience Cloud analytics)

---

#### 4. Data Health (The AI Grounding Layer)

**Score:** X/20 | **Status:** green/yellow/red

##### 4.1 Ergebnisse (Findings)

For each sub-check (ghost fields, duplicates, picklist vs. text, metadata descriptions, semantic mapping, data classification, relationship density, data velocity), list:
- Status: pass / warning / fail
- Evidence (query results, field counts, population percentages, stale record ratios)

##### 4.2 Empfehlungen (Recommendations)

- **Ghost field cleanup** — list of fields to delete or populate, grouped by object
- **Metadata description backfill** — prioritized list of objects/fields needing descriptions, with example AI-ready descriptions
- **Data classification rollout** — step-by-step plan for tagging fields with sensitivity and compliance categories
- **Relationship fixes** — specific custom objects that need Lookup fields to Account/Contact
- **Archive strategy** — which record sets to archive, recommended target (Big Objects vs. Data Cloud vs. external lake)

##### 4.3 Verbesserungsvorschlage (Improvement Suggestions)

- Data governance framework (ownership, quality standards, regular audits)
- Prompt Builder summarization candidates (which long text fields to distill)
- Data Cloud evaluation (Zero Copy vs. ingestion for reference datasets)
- Ongoing data quality monitoring (dashboards, scheduled reports, duplicate rules)

---

#### 5. Security & Access (The Safety Layer)

**Score:** X/20 | **Status:** green/yellow/red

##### 5.1 Ergebnisse (Findings)

For each sub-check (health check, ghost access/profiles, PII discovery, LLM data leakage, event monitoring, sharing model, prompt template security, red team), list:
- Status: pass / warning / fail
- Evidence (profiles/perm sets with elevated access, untagged PII fields, direct LLM callouts, sharing model settings)
- Security Technical Debt table (from step 3i)

##### 5.2 Empfehlungen (Recommendations)

- **Permission model overhaul** — specific profiles to convert to "Zero-Permission" base + Permission Set Groups, with migration steps
- **PII remediation** — fields to encrypt with Shield, fields to tag with Data Classification, FLS changes per profile
- **LLM callout remediation** — specific classes to refactor to route through Einstein Trust Layer
- **Sharing model tightening** — objects to change from Public Read/Write, manual shares to convert to Criteria-Based Rules
- **Prompt template hardening** — specific guardrail instructions to add to each template

##### 5.3 Verbesserungsvorschlage (Improvement Suggestions)

- Security posture monitoring (scheduled Health Check reviews, event monitoring dashboards)
- AI-specific security policies (what AI agents can/cannot do, data exposure boundaries)
- Incident response plan for AI misuse (prompt injection detection, response procedures)
- Regular red team exercises (quarterly Global Search audits)

---

#### 6. Architecture & Integration (The Integration Layer)

**Score:** X/15 | **Status:** green/yellow/red

##### 6.1 Ergebnisse (Findings)

For each sub-check (Connected Apps, REST vs. SOAP, event-driven architecture, External Services, Named Credentials, Data Cloud readiness, object complexity), list:
- Status: pass / warning / fail
- Evidence (integration counts, protocol types, auth methods)
- Integration Technical Debt table (from step 4h)

##### 6.2 Empfehlungen (Recommendations)

- **SOAP-to-REST migration plan** — prioritized list of SOAP integrations to modernize, with OpenAPI spec requirements
- **Event-driven migration** — specific batch jobs to convert to Platform Events or CDC, with middleware compatibility notes
- **External Services conversion** — specific HTTP callouts to wrap as External Services so AI agents can invoke them
- **Credential migration** — specific hard-coded credentials to move to Named Credentials with OAuth
- **Data externalization** — specific large objects to move to External Objects or Data Cloud

##### 6.3 Verbesserungsvorschlage (Improvement Suggestions)

- API documentation standards (OpenAPI 3.0 for all new integrations)
- Integration monitoring (callout limits, error rates, latency dashboards)
- Data Cloud roadmap (Zero Copy evaluation, Data Spaces for AI segmentation)
- Integration pattern library (reusable Named Credential + External Service templates)

---

#### 7. Change Management (The People & Process Layer)

**Score:** X/10 | **Status:** green/yellow/red

##### 7.1 Ergebnisse (Findings)

For each sub-check (executive sponsorship, champion network, training plan, admin upskilling, AI use policy, data governance, change approval, feedback loop, KPIs, rollback plan), list:
- Status: pass / warning / fail
- Evidence or current state description

##### 7.2 Empfehlungen (Recommendations)

- **Organizational readiness** — specific stakeholders to engage, champion network structure, communication plan
- **Training roadmap** — phased training plan by role (admins, developers, end users, executives) with suggested topics and timelines
- **Policy creation** — AI acceptable use policy template, data governance framework outline, change approval workflow design
- **Measurement framework** — specific KPIs to track per AI feature, baseline metrics to capture before rollout

##### 7.3 Verbesserungsvorschlage (Improvement Suggestions)

- Change management cadence (monthly reviews, quarterly maturity assessments)
- Center of Excellence model (dedicated AI CoE or embedded AI champions)
- User adoption strategy (gamification, internal showcases, success story sharing)
- Continuous improvement process (feedback-driven prompt tuning, model performance reviews)

---

#### 8. AI Red Flags (Apex-Muster die AI-Transaktionen beeintrachtigen)

Table of all red flag keyword hits with file, line number, pattern, and risk level (Critical/High/Medium).

For each category of red flags, include:
- **Impact explanation** — why this pattern is dangerous for AI-triggered transactions
- **Remediation guidance** — how to fix each specific occurrence
- **Prevention** — how to prevent this pattern from reoccurring (PMD rules, code review gates)

---

#### 9. Code Review Ergebnisse (Code Review Results)

Reference and summarize the output from the `/code-review` skill execution. Cross-reference code review findings with domain-specific findings above to avoid duplication.

---

#### 10. PMD Analyse (PMD Analysis)

Summary table of PMD findings by priority, plus the top 10 individual violations. For each top violation:
- File path and line number
- Rule violated and why it matters
- Suggested fix

---

#### 11. Aktionsplan (Action Plan)

A prioritized, numbered task list consolidating ALL recommendations and improvements from every domain. For each task:

| # | Task | Domain | Priority | Owner | Effort | Automated? |
|---|------|--------|----------|-------|--------|------------|
| 1 | Fix SOQL in loops in XYZ.cls:42 | Code | Critical | Developer | S (1h) | No |
| 2 | Encrypt PII field Account.SSN__c | Security | Critical | Admin | S (30min) | Manual — Setup > Shield > Encryption |
| 3 | Migrate SOAP integration to REST | Architecture | High | Developer | L (2w) | No |
| 4 | Run Security Health Check | Security | High | Admin | S (30min) | Manual — Setup > Security > Health Check |
| 5 | Backfill metadata descriptions for Account fields | Data | High | Admin | M (4h) | Partially automated |
| ... | ... | ... | ... | ... | ... | ... |

Group tasks by priority:
1. **Critical — Fix immediately** (security vulnerabilities, governor limit risks, data leakage)
2. **High — Fix before AI rollout** (framework gaps, legacy automations, data quality, permission model)
3. **Medium — Plan for next sprint** (code quality, architecture modernization, migration planning)
4. **Low — Backlog** (nice-to-have improvements, long-term initiatives)

For each priority group, include:
- Estimated total effort
- Suggested timeline
- Dependencies between tasks
- Quick wins that can be completed within a day

For manual tasks that require Setup UI access, provide exact navigation paths (e.g., "Setup > Security > Health Check").

---

#### 12. Nachste Schritte (Next Steps)

- **Immediate actions** (this week) — top 3 tasks that deliver the highest AI-readiness impact with the least effort
- **Short-term plan** (next 2 sprints) — critical and high priority items grouped into a suggested sprint plan
- **Medium-term roadmap** (next quarter) — architecture modernization, migration projects, training rollout
- **Long-term vision** — Data Cloud adoption, full Permission Set model, AI Center of Excellence

### Step 10: Save Report

1. Save the report to `org_assessment/<YYYY-MM-DD>-ai-readiness-assessment.md`
2. If a previous assessment exists in the folder, include a delta section comparing scores

### Step 11: Create Log File

Create a structured JSON log file named `<YYYY-MM-DD>-<customer-short-name>-org-assessment.json` in the active customer's log directory (`pipeline/customers/<customer>/logs/`). Use the standard JSON schema from CLAUDE.md.

### Step 12: Summary

Present to the user:
- Overall AI-readiness score with traffic light
- Section-by-section scores
- Count of action items by priority
- Path to the saved report
- Path to the code review report (from `/code-review`)
- Top 3 immediate actions

## Important Rules

- Follow all conventions from CLAUDE.md
- Output text in the assessment report uses the **documentation language** from config
- Read all naming prefixes, source paths, and org aliases from `stack.config.md` — never hardcode
- When an automated check fails (no org access, CLI error), do NOT skip the item — add it to the action plan as a manual task with clear instructions
- The action plan must be exhaustive: every checklist item that is not green must appear as a task
- Do not modify any code during the assessment — this is a read-only audit
- Always run `/code-review` as part of the assessment — do not duplicate its analysis

## Error Handling

- If no org alias is available or org authentication fails, run all file-based checks (PMD, grep scans, metadata analysis) and add all org-dependent checks to the action plan as manual tasks. Do not abort.
- If PMD is not installed, note it in the report and add "Install PMD" to the action plan
- If `/code-review` fails, note it in the report and continue with the remaining sections
- If the `org_assessment/` directory does not exist, create it

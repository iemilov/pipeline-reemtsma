---
name: trace-field
description: Use when you need to know who writes a field or what fires on an object — enumerates every writer (Apex, triggers, flows, workflow field updates, process builders, validation rules, custom metadata that steers them, integrations) with trigger, condition and value written, and reconciles the repository against the versions actually active in the org
argument-hint: <Object.Field | Object> [org-alias] [--include-reads] [--diff-org]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Read-only.** Source reads, metadata retrieves and tooling-API queries only. Nothing is deployed, activated or changed.

## Purpose

Answer two questions completely and without gaps, because doing it by hand across Apex, flows, trigger actions and custom metadata is where mistakes happen:

1. **Field mode** (`Object.Field`): who writes this field, under which condition, with which value, in which order, running as whom.
2. **Object mode** (`Object`): what fires on this object — triggers, flows, workflow rules, process builders, validation rules, duplicate rules, platform event subscribers — in execution order, and what each one changes.

The result is a **writer table** and, with `--diff-org`, a **reconciliation** of the repository against the versions the org actually runs — because the branch and the org drift, and a trace of the wrong version is worse than no trace.

## When to Use / When NOT to Use

- Use before changing a field, before designing a story that touches an object with heavy automation, and as Step 3 of `/investigate-data-issue`.
- Use when a stakeholder asks "what happens when status X is set" and the answer has to be complete.
- Do NOT use to explain a specific incident end to end — `/investigate-data-issue` does that and calls this trace.
- Do NOT use for a general code review — `/code-review`.

## Configuration

Read `pipeline/customer.config.md` (Platform, Short Name, documentation language), `pipeline/stack.config.md` (source path, org aliases, API version, naming prefixes), `pipeline/customer.domain.md` (field semantics, status codes, pitfalls — e.g. person-account `__pc` fields that live on Contact but are written via Account).

Inputs from `$ARGUMENTS`: the target (`Object.Field` or `Object`), an optional org alias (default: first alias in `stack.config.md`), `--include-reads` (also list where the field is read or used in conditions), `--diff-org` (retrieve the active versions and diff them against source; default **on** when an org alias is given).

> **Platform Adaptation:** commands below are Salesforce. On other platforms, trace the column or attribute through the ORM/repository layer, event handlers, scheduled jobs and migrations named in `stack.config.md`; the writer table and the reconciliation are the same.

## Workflow

### Step 1: Normalise the target

Resolve the API name and the object it lives on. For person accounts, `Account.<Field>__pc` is stored on `Contact.<Field>__c`; search both spellings. For relationship fields, note that writers may address them via the related object. Print the list of name variants that will be searched.

### Step 2: Source search — writers

```bash
# Apex assignments, dynamic put(), SObject field tokens
grep -rnE "\b<Field>\b\s*=[^=]|put\(\s*'<Field>'|\.<Field>\s*=[^=]" <source-path>/classes/ <source-path>/triggers/ --include='*.cls' --include='*.trigger' | grep -v 'Test\.cls'
# Flows — every flow that mentions the field; then the element that assigns it
grep -rln "<Field>" <source-path>/flows/ --include='*.flow-meta.xml'
# Workflow field updates, process builders (legacy), validation rules, duplicate rules
grep -rln "<Field>" <source-path>/workflows/ <source-path>/objects/<Object>/validationRules/ <source-path>/duplicateRules/ 2>/dev/null
# Custom metadata / custom settings / labels that hold the values written
grep -rln "<Field>" <source-path>/customMetadata/ <source-path>/objects/*__mdt/ <source-path>/labels/ 2>/dev/null
# Integration surfaces that accept the field from outside
grep -rln "<Field>" <source-path>/classes/*Rest* <source-path>/classes/*Api* <source-path>/classes/*Service* 2>/dev/null
```

For each flow hit, extract the assigning element and its path:

```bash
python3 - <<'PY'
import re,sys,xml.etree.ElementTree as ET
ns={'s':'http://soap.sforce.com/2006/04/metadata'}
t=ET.parse('<source-path>/flows/<Flow>.flow-meta.xml'); r=t.getroot()
for tag in ('assignments','recordUpdates','recordCreates'):
    for el in r.findall(f's:{tag}',ns):
        txt=ET.tostring(el,encoding='unicode')
        if '<Field>' in txt:
            print(tag, el.find('s:name',ns).text)
            for f in el.iter():
                if f.tag.endswith('}field') and f.text=='<Field>':
                    v=f.getparent() if hasattr(f,'getparent') else None
            print(re.findall(r'<(?:field|value|elementReference|stringValue|booleanValue|numberValue|operator)>[^<]*',txt))
PY
```

Read every flow path from its start element to the assignment: trigger type (before/after save, scheduled, record-triggered condition, entry criteria), decision outcomes on the path, the assignment value (literal, formula, variable), and the **other fields assigned in the same element** — that combination is what identifies a writer later in history.

For each Apex hit, read the method: entry point (trigger handler phase, batch `execute`, REST method, invocable, queueable), the condition guarding the assignment, the value or its source, DML statement and context (`with/without sharing`, user vs. system mode).

### Step 3: Object mode — everything that fires

```bash
ls <source-path>/triggers/ | grep -i "^<Object>"
grep -rl "<start>" <source-path>/flows/ --include='*.flow-meta.xml' | xargs grep -l "<object><Object></object>" | while read f; do
  printf "%-60s %s %s\n" "$(basename $f)" "$(grep -oE '<triggerType>[^<]+' $f | head -1)" "$(grep -oE '<recordTriggerType>[^<]+' $f | head -1)"; done
grep -rl "<Object>" <source-path>/workflows/<Object>.workflow-meta.xml 2>/dev/null
ls <source-path>/objects/<Object>/validationRules/ 2>/dev/null
grep -rn "TriggerAction\|<Object>" <source-path>/customMetadata/*Trigger*  2>/dev/null   # trigger-action frameworks (CMT-driven handlers)
```

If the project uses a trigger-action or handler framework, read its configuration (custom metadata or a handler registry class) — the execution order is defined there, not in the trigger file. Order the result by the platform execution order: before-save flows → before triggers → validation → after triggers → after-save flows → workflow/process builder → escalation → async.

### Step 4: Org reconciliation (`--diff-org`)

```bash
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Definition.DeveloperName, VersionNumber, Status, ProcessType, LastModifiedDate, LastModifiedBy.Name FROM Flow WHERE Definition.DeveloperName IN (<flows>) ORDER BY Definition.DeveloperName, VersionNumber DESC"
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Name, LengthWithoutComments, LastModifiedDate, LastModifiedBy.Name FROM ApexClass WHERE Name IN (<classes>)"
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Name, Status, LastModifiedDate FROM ApexTrigger WHERE TableEnumOrId = '<Object>'"
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT ValidationName, Active, LastModifiedDate FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = '<Object>'"
sf project retrieve start -o <org-alias> -m "Flow:<Flow>" -m "ApexClass:<Class>" -m "ApexTrigger:<Trigger>" -m "CustomMetadata:<Type>.<Record>" --output-dir <scratch>/org-state
diff -u <source-path>/flows/<Flow>.flow-meta.xml <scratch>/org-state/**/flows/<Flow>.flow-meta.xml
```

For each artefact classify: **identical** / **org newer** (org has changes not in source — who, when) / **source newer** (not yet deployed) / **inactive in org** (e.g. a flow at Obsolete/Draft, a validation rule switched off, a trigger inactive) / **missing on one side**. Custom metadata records that steer the writers are compared by value, not only by existence.

Any difference on the path to the assignment changes the writer table — mark the affected row with the version that was traced.

### Step 5: Writer table and report

Write `architecture/traces/<Object>.<Field>-<YYYY-MM-DD>.md` (object mode: `<Object>-<YYYY-MM-DD>.md`), in the documentation language, containing:

1. **Target** — object, field, storage location, name variants searched, org and date of reconciliation.
2. **Writer table**

   | # | Source (file · element/method) | Type | Trigger / entry | Condition (path) | Value written | Written together with | Runs as | Order | Source vs org |
   |---|---|---|---|---|---|---|---|---|---|

3. **Object mode: firing order** — the ordered list from Step 3 with phase, condition, what each changes.
4. **Reads** (with `--include-reads`) — where the field is read or used in conditions, so a changed meaning is not missed.
5. **Reconciliation** — per artefact the classification from Step 4 with the diff summary; a short "the org runs …, the branch has …" sentence per difference.
6. **Observations** — writers that overwrite each other, unconditional assignments, values not defined in `customer.domain.md`, writers with no test class, integration surfaces that accept the field unchecked. Observations, not fixes.
7. **Gaps** — what could not be traced (managed packages, org access, external systems).

Create `<YYYY-MM-DD>-<customer-short-name>-<Object>.<Field>-trace-field.json` in `.claude/skills/31-trace-field/logs/` per the CLAUDE.md schema; summary starts with `[writers=<n>] [org-diffs=<n>]`.

Present: writer count, the table condensed to source / trigger / condition / value, the org differences, and the report path.

## Important Rules

- **Read-only.** No deployment, activation, or data change.
- **Complete before precise.** Search every artefact family before reading any one deeply; a missed workflow field update invalidates the whole table.
- **Trace the org version when the org differs.** State per row which version was traced.
- **Search the storage name and the exposed name** (person-account fields, relationship fields).
- **Managed-package writers** are listed by namespace as opaque entries; do not guess what they do.
- Read paths, aliases, object and field names from config. Never hardcode.
- Output in the documentation language from `customer.config.md`. No AI attribution.

## Error Handling

- **No org access:** source-only trace, reconciliation section marked "not performed", status `partial`.
- **Field not found in source:** check the org via `FieldDefinition`; if it exists only in the org, report that as the first observation.
- **Trigger framework without readable configuration:** list the handlers found and mark order as "framework-defined, not verified".
- **Retrieve fails for a component type:** compare via the tooling-API metadata fields only and say so.

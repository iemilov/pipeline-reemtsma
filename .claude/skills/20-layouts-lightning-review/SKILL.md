---
name: layouts-lightning-review
description: Use when auditing Salesforce page layouts and Lightning record pages — inventories every layout, FlexiPage and assignment, finds unassigned and duplicate layouts, measures Lightning adoption and Dynamic Forms usage, assesses page complexity and performance risk, and produces a consolidation and modernisation plan with a governance model
argument-hint: [org-alias (optional, defaults to first org alias from stack.config.md)] [--object <ApiName> (optional, restrict to one object)]
---

> **Platform Guard:** This skill requires `Platform = salesforce` in `customer.config.md`. If the customer uses a different platform, inform the user and abort with a clear message.

## Purpose

Answer four questions about the UI layer:

1. **How many layouts and Lightning pages exist, and which are actually assigned to anyone?**
2. **Where is the org still on Classic-era page layouts** rather than Lightning record pages with Dynamic Forms?
3. **Which pages are heavy enough to hurt load time**, and why?
4. **What can be consolidated**, and what governance stops the sprawl returning?

Read-only audit. It never modifies layouts, FlexiPages, assignments, or profiles.

## Configuration

Before executing, read:
- `pipeline/customer.config.md` — customer identity, **Platform**, Short Name, documentation language
- `pipeline/stack.config.md` — source path, org aliases, API version, key objects
- `pipeline/customer.domain.md` — which objects matter to the business, so consolidation proposals are prioritised where users actually work

Resolve the org alias from `$ARGUMENTS`, otherwise the first alias in `stack.config.md`. If `--object` is given, restrict every step to that object and say so in the report.

## Concept Reference

| Artefact | Metadata | Purpose |
|----------|----------|---------|
| **Page Layout** | `layouts/<Object>-<Name>.layout-meta.xml` | Field arrangement, related lists, buttons. Still required even in Lightning — it drives related lists, actions, and mobile |
| **Lightning Record Page** | `flexipages/<Name>.flexipage-meta.xml`, `<type>RecordPage</type>` | Lightning UI: regions, components, tabs |
| **Dynamic Forms** | `<type>Field</type>` items inside a FlexiPage `fieldInstance` | Places layout fields directly on the Lightning page with conditional visibility |
| **Assignment** | `layoutAssignments` in Profile; FlexiPage app/record-type/profile assignment | Determines who sees what |
| **Record Type** | `objects/<Object>/recordTypes/` | Multiplies the layout matrix |

> A page layout that is not assigned to any profile/record-type combination is dead weight — but **never assume**: assignments may live in profiles not present in source control. Always confirm against the org before proposing deletion.

## Workflow

### Step 1: Inventory

#### 1a. Page layouts from source

```bash
ls <source-path>/layouts/*.layout-meta.xml 2>/dev/null | wc -l
ls <source-path>/layouts/ | sed 's/-.*//' | sort | uniq -c | sort -rn | head -30
```

The filename convention is `<Object>-<Layout Name>.layout-meta.xml`, so the prefix gives layouts per object. Objects with many layouts are the consolidation targets.

#### 1b. Lightning pages from source

```bash
ls <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | wc -l
grep -l '<type>RecordPage</type>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | wc -l
for f in <source-path>/flexipages/*.flexipage-meta.xml; do
  printf "%-55s %s\n" "$(basename $f .flexipage-meta.xml)" "$(grep -oE '<type>(RecordPage|HomePage|AppPage|UtilityBar|CommAppPage|CommObjectPage|MailAppAppPage)</type>' $f | head -1 | tr -d '<>type/')"
done | sort -k2
```

Classify by type: RecordPage, HomePage, AppPage, UtilityBar, Community pages.

#### 1c. Record types

```bash
find <source-path>/objects -name '*.recordType-meta.xml' 2>/dev/null | sed 's|.*/objects/||;s|/recordTypes/.*||' | sort | uniq -c | sort -rn
```

Record types multiply the layout matrix: assignments are per profile × record type.

#### 1d. Org-side cross-check (source control may be incomplete)

```bash
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Id, Name, TableEnumOrId FROM Layout ORDER BY TableEnumOrId" 2>&1 | head -50
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Id, DeveloperName, Type, EntityDefinitionId FROM FlexiPage ORDER BY Type, DeveloperName" 2>&1 | head -50
```

Compare org counts against source counts. A gap means UI metadata is being changed directly in production — a governance finding in its own right.

### Step 2: Assignment Analysis

This is the core of the audit: an unassigned layout costs nothing at runtime but confuses every future change.

```bash
sf data query -o <org-alias> --use-tooling-api -r csv -q "SELECT Layout.Name, Layout.TableEnumOrId, Profile.Name, RecordType.Name FROM ProfileLayout ORDER BY Layout.TableEnumOrId, Layout.Name" 2>&1
```

Also read assignments from local profile metadata where available:

```bash
grep -A3 '<layoutAssignments>' <source-path>/profiles/*.profile-meta.xml 2>/dev/null | grep -oE '<layout>[^<]+' | sed 's/<layout>//' | sort | uniq -c | sort -rn
```

Build the assignment picture:

| Class | Meaning |
|-------|---------|
| **Assigned** | Referenced by at least one profile × record-type combination |
| **Unassigned** | Exists but no profile assignment — dead weight |
| **Single-assignment** | Used by exactly one profile — candidate for merging |
| **Universally assigned** | Used by every profile — the de-facto default; check whether variants are needed at all |

> If `ProfileLayout` is not queryable or the profiles directory is empty, mark assignment analysis as **unverified** and route it to the manual appendix. Do **not** infer "unassigned" from missing source metadata.

### Step 3: Lightning Adoption

For each object with page layouts, determine whether a Lightning record page exists:

```bash
grep -l '<type>RecordPage</type>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | while read f; do
  obj=$(grep -oE '<sobjectType>[^<]+' "$f" | sed 's/<sobjectType>//' | head -1)
  echo "$obj  $(basename $f .flexipage-meta.xml)"
done | sort
```

Cross-reference with the object list from Step 1a. Objects with layouts but **no** record page still render the Classic-derived layout in Lightning — functional, but with none of the Lightning capabilities (tabs, conditional visibility, component-level access).

Report **Lightning coverage** as: objects with a record page ÷ objects with layouts.

#### 3a. Dynamic Forms adoption

```bash
grep -c '<fieldInstance>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | grep -v ':0'
grep -l 'fieldInstance' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | wc -l
```

A record page using `fieldInstance` items has migrated to Dynamic Forms; one relying on the `force:detailPanel` / Record Detail component has not:

```bash
grep -l 'force:detailPanel\|runtime_sales_activities\|force:highlightsPanel' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null
```

Dynamic Forms matter because they replace the "one layout per audience" pattern with **conditional visibility on a single page** — which is usually the real fix for layout sprawl.

#### 3b. Conditional visibility usage

```bash
grep -c '<visibilityRule>' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | grep -v ':0' | sort -t: -k2 -rn
```

Pages with visibility rules are doing work that would otherwise need duplicate layouts. Pages with none, on objects that have many layouts, are the prime consolidation candidates.

### Step 4: Complexity and Performance

#### 4a. Components per Lightning page

```bash
for f in <source-path>/flexipages/*.flexipage-meta.xml; do
  printf "%-55s components:%3s regions:%2s fields:%3s visibility:%3s\n" \
    "$(basename $f .flexipage-meta.xml)" \
    "$(grep -c '<componentName>' $f)" \
    "$(grep -c '<itemInstances>' $f)" \
    "$(grep -c '<fieldInstance>' $f)" \
    "$(grep -c '<visibilityRule>' $f)"
done | sort -t: -k2 -rn | head -25
```

Guidance thresholds (state them in the report, they are judgement not law):

| Signal | Threshold | Why |
|--------|-----------|-----|
| Components on a record page | > 25 | Each component is a server round-trip risk; EPT degrades |
| Custom LWC/Aura components on one page | > 5 | Custom components dominate load time |
| Tabs/accordions | — | **Good** — deferred rendering, components load on demand |
| Related lists rendered eagerly | > 10 | Move to a tab or use the Related List Single component |

#### 4b. Fields and related lists per layout

```bash
for f in <source-path>/layouts/*.layout-meta.xml; do
  printf "%-70s fields:%3s relLists:%3s actions:%3s\n" \
    "$(basename $f .layout-meta.xml)" \
    "$(grep -c '<field>' $f)" \
    "$(grep -c '<relatedLists>' $f)" \
    "$(grep -c '<quickActionListItems>' $f)"
done | sort -t: -k2 -rn | head -25
```

Flag layouts with more than ~60 fields (users cannot scan them; a candidate for Dynamic Forms with sections and visibility rules) and layouts with more than ~10 related lists.

#### 4c. Custom components in use

```bash
grep -hoE '<componentName>[^<]+' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | sed 's/<componentName>//' | sort | uniq -c | sort -rn | head -30
```

Separate standard (`force:`, `flexipage:`, `runtime_`) from custom (`c:`). Custom components on many pages are both a reuse success and a blast-radius risk — a defect in one affects every page.

Cross-reference custom components against the LWC/Aura inventory to find **components that exist but are on no page** (dead UI code):

```bash
ls -d <source-path>/lwc/*/ 2>/dev/null | xargs -n1 basename | sort > /tmp/lwc_all.txt
grep -hoE '<componentName>c:[^<]+' <source-path>/flexipages/*.flexipage-meta.xml 2>/dev/null | sed 's/<componentName>c://' | sort -u > /tmp/lwc_used.txt
comm -23 /tmp/lwc_all.txt /tmp/lwc_used.txt
```

> Components not on a FlexiPage may still be used in Flows, Quick Actions, Communities, or other components. **Verify before calling anything dead** — check `flows/`, `quickActions/`, and other LWC templates.

### Step 5: Duplication and Consolidation Candidates

#### 5a. Near-duplicate layouts on the same object

```bash
ls <source-path>/layouts/ | sed 's/\.layout-meta\.xml//' | awk -F'-' '{print $1}' | sort | uniq -c | sort -rn | head -20
```

For objects with 3+ layouts, compare the field sets:

```bash
for f in <source-path>/layouts/<Object>-*.layout-meta.xml; do
  echo "== $(basename $f)"; grep -oE '<field>[^<]+' $f | sed 's/<field>//' | sort | md5
done
```

Identical hashes are exact duplicates. For near-duplicates, diff the field lists and report the delta — often two layouts differ by one or two fields, which conditional visibility handles on a single page.

#### 5b. Naming and lifecycle artefacts

Flag layouts and FlexiPages whose names contain `Copy`, `Kopie`, `Test`, `Old`, `Alt`, `New`, `Neu`, `v2`, `Backup`, `DRAFT`, `tmp`, or a trailing date. These signal clone-and-tweak and are usually unassigned.

### Step 6: Score

**UI layer health (100 points):**

| Dimension | Weight | Scoring |
|-----------|--------|---------|
| Assignment hygiene | 25 | % of layouts assigned. 100% = full marks; deduct 2.5 per 10 points below |
| Lightning adoption | 20 | % of layout-bearing objects with a record page. Deduct 2 per 10 points below 100% |
| Dynamic Forms adoption | 15 | % of record pages using `fieldInstance`. Deduct 1.5 per 10 points below |
| Layout consolidation | 15 | Deduct 2 per object with >3 layouts (max −10); 5 if exact duplicates exist |
| Page complexity | 15 | Deduct 3 per record page with >25 components (max −9); 3 per layout with >60 fields (max −6) |
| Source control & naming | 10 | Deduct proportionally for org/source gap; 3 for lifecycle artefacts in names |

Traffic light: ≥80 green, 55–79 yellow, <55 red.

### Step 7: Generate the Report

Save to `org_assessment/<YYYY-MM-DD>-layouts-lightning-review.md`, in the **documentation language** from `customer.config.md`. Create the directory if missing.

Structure:

1. **Executive summary** — score, totals (layouts, FlexiPages by type, record types), Lightning coverage %, Dynamic Forms %, unassigned count, and a one-paragraph verdict.
2. **Inventory** — layouts per object, FlexiPages by type, record types, org-vs-source gap.
3. **Assignment analysis** — the four classes from Step 2, with the unassigned list in full.
4. **Lightning adoption** — objects with/without a record page, ranked by business importance from `customer.domain.md`; Dynamic Forms and conditional visibility usage.
5. **Complexity and performance** — heaviest pages and layouts with the specific reason each is flagged.
6. **Components** — usage frequency, custom vs standard, candidates for dead UI code (with the verification caveat).
7. **Duplication** — objects with multiple layouts, field-set deltas, consolidation proposals.
8. **Consolidation & modernisation plan** — see Step 8.
9. **Governance** — see Step 9.
10. **Appendix: verification gaps** — anything Setup-only or unverifiable.

### Step 8: Consolidation & Modernisation Plan

Phased, each item with the object, measure, benefit and risk:

| Phase | Focus | Typical content |
|-------|-------|-----------------|
| **1 — Safe removals** | No user impact | Delete unassigned layouts and FlexiPages (after org confirmation), remove lifecycle-artefact copies |
| **2 — Consolidation** | Fewer artefacts, same behaviour | Merge near-duplicate layouts using Dynamic Forms conditional visibility; reduce related lists to tabs |
| **3 — Lightning modernisation** | Capability gain | Create record pages for objects that lack them; migrate record pages from Record Detail to Dynamic Forms |
| **4 — Performance** | Load time | Split heavy pages into tabs, defer non-critical components, review custom components on high-traffic pages |

Order by **user impact per unit of effort**: start with the objects the business actually uses daily (from `customer.domain.md`), not with the object that happens to have the most layouts.

**Safety rules to include:**

- Never delete a layout without confirming in the **org** that it has no assignment — source control may be incomplete.
- Retrieve layouts and FlexiPages into source control before any deletion.
- Layout changes are visible to users immediately; schedule them and communicate ahead.
- A page layout is still required in Lightning for related lists, actions and mobile — **do not delete a layout because a Lightning page exists**.
- Test Dynamic Forms migrations against every record type and profile combination that the original layouts served.

### Step 9: Governance

Ground each rule in a finding. Cover:

- **One page per object as the default**, with conditional visibility instead of per-audience layout variants. A new layout requires justification.
- **Naming convention** for layouts and FlexiPages, banning `Copy`/`Test`/`v2` in production.
- **Assignment is mandatory at creation** — an unassigned layout is deleted at the next review.
- **Complexity budget** — a documented maximum for components per record page and fields per layout, checked at review.
- **New objects ship with a Lightning record page**, not a bare layout.
- **UI metadata belongs in source control** and is deployed through the pipeline, not edited in production.
- **Quarterly review** rerunning this skill; track the score over time.

### Step 10: Save & Compare

If a previous review exists in `org_assessment/`, add a **Delta**: score change, layouts removed, Lightning coverage change, new unassigned artefacts. Growth in unassigned layouts despite a previous cleanup means the governance rules are not being applied.

### Step 11: Create Log File

Create `<YYYY-MM-DD>-<customer-short-name>-<org-alias>-layouts-lightning-review.json` in `.claude/skills/20-layouts-lightning-review/logs/`, using the standard JSON schema from CLAUDE.md. Include counts, coverage percentages and the score.

### Step 12: Summary to the User

Present:
- Score and traffic light
- Layouts, FlexiPages by type, record types
- Lightning coverage % and Dynamic Forms adoption %
- Unassigned count and consolidation potential
- The 3 heaviest pages with their component counts
- Top 3 recommended actions
- Path to the report

## Important Rules

- **Read-only.** Never modify a layout, FlexiPage, assignment, or profile.
- **Never call a layout unassigned from source metadata alone.** Confirm against the org; if that is not possible, mark it unverified rather than proposing deletion.
- **A Lightning record page does not replace the page layout** — layouts still drive related lists, actions and mobile. Never recommend deleting a layout on the grounds that a record page exists.
- **Verify "dead" components** against Flows, Quick Actions and Communities before reporting them as unused.
- Prioritise by business usage from `customer.domain.md`, not by artefact count. The object with 12 layouts nobody opens matters less than the object with 3 that everyone uses.
- Complexity thresholds are judgement, not policy — state them as guidance and explain the reasoning per finding.
- Read all source paths, org aliases and object names from config. Never hardcode.
- Output text uses the **documentation language** from `customer.config.md`.

## Error Handling

- **No org access:** run all source-based checks and route assignment analysis and the org/source comparison to the verification-gaps appendix. State clearly that unassigned status could not be confirmed.
- **`ProfileLayout` or Tooling API unavailable:** mark assignment analysis unverified; do not propose deletions.
- **`profiles/` directory empty in source** (common when profiles are not tracked): rely on the org query; if both are unavailable, the assignment dimension scores as unverified rather than zero.
- **Managed-package layouts and FlexiPages** (namespace prefix in the name): report separately and exclude from consolidation proposals — they cannot be modified.
- **`org_assessment/` missing:** create it.

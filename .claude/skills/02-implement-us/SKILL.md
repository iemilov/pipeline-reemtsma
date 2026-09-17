---
name: implement-us
description: Generate a first draft of implementation for a user story using the appropriate tools for the project's tech stack. Supports Jira or local Markdown stories (see config)
argument-hint: [story-key]
preferred-runtime: openai-codex
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> **Runtime hint:** This skill prefers `openai-codex` (mechanical code edits). If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed. Record `active_runtime`, `preferred_runtime`, and `runtime_match` in the execution log.

## Configuration

Before executing, read `pipeline/customer.config.md` for customer-specific values (Atlassian Deployment Type, locale settings — including **UI Language** (the language the end-user-facing UI is built in; all generated UI strings, labels, button text, page titles, and error messages shown to end users must use this language), CI skip pattern, folder paths, **Platform**, **Story Backend**, **Stories Path**), `pipeline/stack.config.md` for stack-specific values (naming prefixes, API version, org aliases, test data factory class, functional domains, source path), and `pipeline/customer.domain.md` for domain-specific business logic and field name pitfalls. Also read `pipeline/platforms/<Platform>/best-practices.md` (resolve `<Platform>` via `pipeline/bin/config "Platform"`) for platform-wide coding best practices, and `pipeline/coding-conventions.md` for customer-specific coding conventions. For Jira calls (when `Story Backend` is `jira`), consult the **Atlassian adapter** at `pipeline/atlassian-access.md`.

## Platform Adaptation

This skill contains Salesforce-specific references (sf CLI, Apex, Flows, LWC, `force-app/`, PMD). Read `Platform` from `customer.config.md` (`pipeline/bin/config "Platform"`):
- **If `salesforce`:** Follow all steps as written.
- **If not `salesforce`:** Adapt all steps to the project's tech stack as described in `stack.config.md`. Replace Salesforce-specific tools, commands, paths, and metadata types with their equivalents from the stack configuration. Skip steps that have no equivalent (e.g., PMD for Apex, `sf` CLI commands, Composite Tree API, `force-app/` paths). Use the deployment, testing, and linting commands from `stack.config.md` instead.

## Story Backend Adaptation

Read `Story Backend` from `customer.config.md`:
- **If `jira` (default):** Stories are fetched from Jira and status transitions are performed via the Atlassian adapter.
- **If `markdown`:** Stories are read from local Markdown files at `<Stories Path>/<story-key>.md`. Status transitions update the `status` field in the YAML frontmatter (e.g., `Open` → `In Progress` → `Done`). All Jira API calls (fetch, transition, issuelinks) are replaced with file operations.

## Workflow: User Story → Implementation Draft

Generate an implementation for Jira story **$ARGUMENTS**:

### Step 1: Read User Story

#### If `Story Backend` is `jira`:
1. Fetch the story details from Jira via the Atlassian adapter's `getJiraIssue` operation (see `pipeline/atlassian-access.md` §3 — branch on `Deployment Type` from `customer.config.md`) with key `$ARGUMENTS`
2. **Transition the story to "In Progress"** — update the Jira status via the adapter's `getTransitionsForJiraIssue` + `transitionJiraIssue` operations (find the appropriate transition ID for the "In Progress" status)
3. Extract all requirements, acceptance criteria, and technical details from the description
4. **Check story dependencies** — read the `issuelinks` field from the Jira response. If the story has "is blocked by" links to stories that are not in status "Done"/"Closed", warn the user that blockers exist and list them. Ask whether to proceed anyway or abort

#### If `Story Backend` is `markdown`:
1. **Read the story file** at `<Stories Path>/$ARGUMENTS.md` (e.g., `stories/RH-1.md`)
   - If the file does not exist, list available stories in the Stories Path and ask the user which one to use
2. **Update story status** — change `status: Open` to `status: In Progress` in the YAML frontmatter
3. Parse the frontmatter for `key`, `title`, `status`, `component`, `epic`, `priority`, `dependencies`
4. Extract all requirements, acceptance criteria, and technical details from the body
5. **Check story dependencies** — if the `dependencies` list references stories with `status: Open`, warn the user that blockers exist. Ask whether to proceed anyway or abort

#### Both backends:
4. **Check for implementation notes** — resolve the notes folder from the **Implementation Design** config path (`pipeline/bin/config "Implementation Design"`, substituting `<story-key>` with `$ARGUMENTS`; this lives in the customer **config** repo, e.g. `pipeline/customers/<customer>/implementation-design/$ARGUMENTS/`, NOT the repo-root `implementation-design/`). Fall back to `implementation-design/$ARGUMENTS/` only if the config key is empty. Then check if `<notes-dir>/implementation-notes.md` exists:
   - **If it exists**: run the story gate — the DRAFT/open-question/placeholder detection is mechanical; never re-derive it by reading the file yourself:
     ```bash
     pipeline/bin/story-gate --notes <notes-dir>/implementation-notes.md --phase implement
     ```
     - **`decision=pass`**: use the notes as the primary guide for implementation decisions (proposed approach, affected objects, acceptance criteria mapping, and technical hints). The notes contain pre-analyzed codebase patterns, domain knowledge, and a recommended implementation approach — follow them closely.
     - **`decision=block` with `finding=draft-marker`**: **STOP.** These notes are only a placeholder from story creation and have not been through codebase analysis or design review. Inform the user: *"Die Implementation Notes für $ARGUMENTS sind noch im DRAFT-Status (Platzhalter aus der Story-Erstellung). Vor der Implementierung muss ein vollständiges Design erstellt werden."* Then ask whether to:
       - **Option 1 (recommended)**: Abort and run the design step first to generate full implementation notes
       - **Option 2**: Proceed anyway (the skill will perform its own analysis in Step 2-3, ignoring the DRAFT notes)
     - **`decision=block` with `finding=open-question` and/or `finding=placeholder` lines** (no draft-marker): **STOP.** Present the `finding=` lines verbatim — which open questions remain, which template residue the notes still carry. Then ask whether to:
       - **Option 1 (recommended)**: Abort and resolve them first (run the design step again or clarify manually)
       - **Option 2**: Proceed anyway — the user explicitly confirms that implementation should continue despite the open findings
     - Whichever branch: a user "proceed anyway" is an explicit **override of a closed gate**. Record it in Step 11 as `--check "story-gate:fail:<the overridden findings, briefly>"` — an overridden gate stays `fail`, never `pass` (CLAUDE.md > Quality Gate rule 2a: only the user may waive, and the waiver is named). A clean gate logs `--check "story-gate:pass"`.
   - **If it does NOT exist**: inform the user and ask whether to:
     - **Option 1 (recommended)**: Abort and run the design step first to generate implementation notes
     - **Option 2**: Proceed without implementation notes (the skill will perform its own analysis in Step 2-3)
5. **Check for the testdata impact declaration** — skip this check if the active customer has no `pipeline/customers/<customer>/testdata.catalog.json` (no catalog, no impact contract). Otherwise check whether `<notes-dir>/testdata-impact.json` exists:
   - **If it exists**: proceed. Step 8a validates and cross-checks it later.
   - **If it does NOT exist**: tell the user *"Für $ARGUMENTS liegt noch keine `testdata-impact.json` vor — `/story-testdata` wurde nicht ausgeführt."* Then ask whether to:
     - **Option 1 (recommended)**: run `/story-testdata $ARGUMENTS` now — it costs minutes here, whereas the same gap discovered in Step 8a lands after implementation, review, deploy, and test data are already done and ends the run as `partial`
     - **Option 2**: proceed and carry the gap as an open item into Step 8a and Step 10
6. **Verify the deploy target is reachable** — resolve the DEV org alias / deploy target from `stack.config.md` and confirm it is authorized *before* writing code, using the platform's own check (for `salesforce`: `sf org display --target-org <alias>`; for other platforms the equivalent credential check from `stack.config.md`). If the target is unauthorized, expired, or inactive, say so now and ask whether to re-authorize, switch target, or proceed implementation-only with deploy and test data deferred. Discovering this in Step 7 means the whole implementation is already done before the blocker surfaces.
7. **Verify the gate tools are on PATH** — `pmd` for `salesforce`, plus every lint and test runner `stack.config.md` names for the platform. A missing tool is reported now with its install hint, and the user decides whether to install it or to proceed with that gate recorded as `unchecked` in Step 11 — a gate discovered missing in Step 7 has already cost the implementation, and per `CLAUDE.md > Quality Gate & Loop Engineering` rule 2a an `unchecked` mandatory gate blocks unless the user waives it by name.

### Step 2: Explore Codebase Patterns
Before implementing, explore the existing codebase to understand:
1. Naming conventions (check **naming prefixes** from config)
2. Existing similar implementations for the same type of solution
3. Relevant existing fields, objects, and metadata on affected sObjects
4. Test patterns (use the **test data factory** class from config) if Apex is involved
5. **Check for conflicting automations** — for each sObject affected by the implementation:
   - Search for existing **Trigger Actions** on that object (check `Trigger_Action__mdt` custom metadata and any trigger handler classes)
   - Search for existing **Flows** on that object (Record-Triggered Flows in `force-app/main/default/flows/`)
   - Search for existing **Validation Rules** on that object
   - If conflicts or order-of-execution concerns are found, document them and factor them into the implementation approach (e.g., adjust trigger action order, avoid duplicate logic, account for field value changes by other automations)

### Step 3: Choose Implementation Approach
Analyze the requirements and determine which Salesforce tools are most appropriate. Use declarative tools where possible, code where necessary:

#### Declarative (no-code / low-code)
- **Flows** (Record-Triggered, Screen, Scheduled, Autolaunched) — for automation, screen wizards, scheduled processes
- **Validation Rules** — for field-level data integrity and business rule enforcement
- **Formula Fields** — for computed/derived values
- **Roll-Up Summary Fields** — for aggregate calculations on master-detail
- **Approval Processes** — for multi-step approval workflows
- **Assignment Rules / Escalation Rules** — for case or lead routing
- **Sharing Rules** — for record access control
- **Permission Sets / Permission Set Groups** — for feature access
- **Page Layouts / Record Types** — for UI and process variations
- **Custom Metadata Types / Custom Settings** — for configuration data
- **Reports & Dashboards** — for analytics requirements
- **Email Templates / Email Alerts** — for notification requirements

#### Programmatic (code)
- **Apex Trigger Actions** — for complex before/after DML logic (use Trigger Action Framework)
- **Batch Apex + Schedulable** — for large data volume processing on a schedule
- **Apex REST/SOAP Services** — for custom API endpoints
- **Invocable Apex** — for reusable logic callable from Flows
- **Lightning Web Components** — for custom UI
- **Aura Components** — only if extending existing Aura components

### Step 4: Generate feature branch
- **Determine the base branch:**
  1. If **Azure DevOps** is configured in `customer.config.md`: Query via `az repos show`:
     ```bash
     az repos show --repository "<Repository>" --org "<Organization>" --project "<Project>" --query defaultBranch -o tsv
     ```
     Strip the `refs/heads/` prefix to get the branch name.
  2. **Fallback:** Query via git:
     ```bash
     git remote show origin | grep 'HEAD branch' | awk '{print $NF}'
     ```
- Fetch and create a feature branch: `git fetch origin <base-branch> && git checkout -b feature/$ARGUMENTS origin/<base-branch>`

### Step 5: Generate Implementation
Based on the chosen approach, create the appropriate metadata files.

> **Generated code must satisfy the platform's acceptance standard.** Before writing the first file, (re-)read `pipeline/platforms/<Platform>/best-practices.md` (resolve `<Platform>` via `pipeline/bin/config "Platform"`). For `salesforce` that document defines a **Compliance Gate**, **canonical scaffolds** to emit, an **anti-pattern table**, and a **common deployment errors** table — generate from those shapes rather than from memory. Customer conventions in `pipeline/coding-conventions.md` win on style and naming; the platform document wins on correctness, security, governor limits, and deployability. Run the Compliance Gate self-check over your own diff at the end of this step and report the result (pass, or the fixes you applied) — do not hand a known violation to the reviewer in Step 6.
>
> Include in that self-check every German string the diff introduces — comments, `<description>` elements, field and button labels, validation-rule messages, LWC text: proper `ä ö ü ß`, never the `ae/oe/ue/ss` substitution (`CLAUDE.md > Global Rules`). Read the German lines you added rather than trusting a grep — over German words a substring search for `ae/oe/ue/ss` is too noisy to be a gate. The same applies to everything you write **about** the run: the Step 10 summary, `deployment/*.md` manual steps, and the execution-log `--summary` / `--output`.

#### For Flows
- Create `.flow-meta.xml` files in `force-app/main/default/flows/`
- Follow naming using the **naming prefixes** from config
- Use subflows for reusable logic
- Add fault paths for error handling — every `recordCreates` / `recordUpdates` / `recordDeletes` / `recordLookups` / `actionCalls` element needs a `<faultConnector>`
- Put rationale in `<description>` (on the flow and on non-obvious elements) — **never** in an XML comment; the Metadata API strips those on the next retrieve
- `<apiVersion>` on a Flow uses the same **`NN.0`** form as every other metadata type (`62.0`, not `62`) — that is what the Metadata API emits on retrieve; there is no Flow-specific integer convention
- Format and lint the generated XML before moving on (see the gate in Step 7); do not hand-tune `<locationX>`/`<locationY>`
- Full rules: `pipeline/platforms/salesforce/best-practices.md > Metadata XML Formatting & Flow Linting`

#### For Validation Rules
- Create files in `force-app/main/default/objects/<Object>/validationRules/`
- Include clear `errorMessage` in the **validation rule message language** from config
- Use `errorDisplayField` to show errors on the relevant field

#### For Formula Fields
- Create `.field-meta.xml` in `force-app/main/default/objects/<Object>/fields/`

#### For Custom Fields
- Create `.field-meta.xml` with proper type, label, description
- Add to relevant Page Layouts, Permission Sets, and FLS as needed

#### For Sharing Rules
- Create in `force-app/main/default/sharingRules/`

#### For Permission Sets
- Create or update in `force-app/main/default/permissionsets/`

#### For Apex Classes
- Follow project conventions:
  - Explicit sharing on **every** class, inner classes included — `with sharing` unless system context is genuinely required and documented
  - `WITH USER_MODE` on SOQL and `as user` on DML (`WITH SECURITY_ENFORCED` is removed in API v67.0 and must not be generated — see the platform best-practices *Compliance Gate*)
  - No SOQL/DML/callouts in loops
  - Max cyclomatic complexity of 10 per method
  - Class names max 40 characters
- Emit the trigger/handler, service, selector, queueable, and test-class shapes from `pipeline/platforms/salesforce/best-practices.md > Canonical Scaffolds for Generated Code`
- Create a **Scheduled wrapper** if the class is a Batch
- Create a **Test class** with:
  - Use the **test data factory** class from config where possible
  - Wrap User DML before Account/Case DML or use `System.runAs()` to avoid MIXED_DML_OPERATION errors
  - One test method per **decision point this story adds or changes** — every guard, validation branch, fault/error path, bypass or permission exception — written so it would fail if that branch were removed: assert the behaviour (record state, thrown message, log entry), never "any exception" or "no exception". Keep a branch → test-method list for the Step 10 summary; a new branch without a named test is a **Major** finding in Step 6, not a coverage statistic
  - This applies to declarative logic too: a new Flow decision, Validation Rule or Custom Permission check gets an Apex test that reaches it through DML
  - Target 80%+ code coverage — coverage is the floor, the branch list above is the gate

#### For Lightning Web Components
- Create in `force-app/main/default/lwc/`
- Follow naming using the **LWC prefixes** from config
- Include `.js`, `.html`, `.css` (if needed), `.js-meta.xml`
- Import Apex via `@salesforce/apex/ClassName.methodName`

#### For all metadata
- Create all `-meta.xml` files with the **API version** from config
- **Bump the API version of every *modified* artifact too** — not just newly created ones. When you change an existing Flow or Apex class/trigger (especially one freshly retrieved from the org as source-of-truth), its declared API version is often **stale** (an org-retrieved Flow can come back several releases behind). Before deploying, bring every **changed** artifact up to the **API version from config**:
  - **Flows**: the `<apiVersion>NN.0</apiVersion>` element lives *inside the flow definition file* itself.
  - **Apex classes / triggers**: the `<apiVersion>` lives in the sibling `*.cls-meta.xml` / `*.trigger-meta.xml`.
  - Only bump artifacts you are **already modifying** for this story — never touch the API version of files you aren't otherwise changing (avoids noisy, ownership-unclear diffs).
  - After bumping, confirm the file is still well-formed XML before staging.
  > **Platform note:** This applies to platforms whose metadata carries a per-artifact API/schema version (e.g., Salesforce). For other stacks, skip — there is no equivalent.

### Step 6: Review the Implementation (dedicated subagent)

Before any static analysis (PMD / lint), test gate, or commit, review the **entire** implementation while it is still uncommitted and easy to revise. The goal is to catch convention violations, bugs, and design issues now — fixing them in the working tree is far cheaper than after PMD, after tests, or after the change has been committed or handed off to `/commit`.

By default this review runs under the **same** runtime that wrote the code. A customer can optionally opt into an **independent cross-runtime** review (Claude's code reviewed by Codex, Codex's code reviewed by Claude) so the implementer never grades its own homework — see the `Review Runtime` field below.

> **Runtime note:** Dispatching the reviewer is runtime-divergent. Resolve the reviewer runtime and its dispatch command via `pipeline/agent-runtime-access.md` §2a (review dispatch). **Default:** review under the active `Agent Runtime` using the host's native subagent primitive (§2) — under `claude-code` a native subagent (Agent/Task tool, general-purpose); under `openai-codex` / `local-llm` / `gemini-cli` the documented subprocess fallback (`codex exec` / `ollama run` / `gemini -p`). **Optional cross-runtime:** if `customer.config.md > ## Agent Runtime` sets a `Review Runtime` override (a concrete runtime, or the literal `complement`), dispatch the reviewer under that runtime instead — concretely, the complement of `claude-code` is `codex exec --sandbox read-only -c model_reasoning_summary=detailed -- "$(cat review-prompt.txt)" < /dev/null`, and of `openai-codex` is `claude -p` (headless). Cross-runtime reviewer subprocesses MUST follow the §2a **Background dispatch contract**: prompt file → detached launch with output to a log file (under Claude Code: Bash `run_in_background: true`) → progress feed armed (`pipeline/bin/review-progress <log>`, under Claude Code as a Monitor, so the reviewer's thinking is visible in the session while it runs) → wait for the exit marker, checking liveness (log growth) instead of a fixed deadline — never foreground with a timeout, since thorough reviews legitimately exceed the host's 10-minute foreground cap. The reviewer is always **read-only**. If a non-default reviewer CLI is unavailable, degrade gracefully per §2a: warn the user, then fall back to the same-runtime native subagent so the review still runs. Describe the review at the logical level and let the adapter pick the primitive — never hardcode a single-runtime call.

1. **Resolve & verify the reviewer runtime** — determine who reviews and whether that reviewer is usable, before doing the work:
   ```bash
   pipeline/bin/review-runtime --check    # prints the resolved reviewer + availability
   ```
   - Exit `0` → the reviewer is usable (same-runtime by default, or the configured cross-runtime reviewer's CLI is present). Proceed with that runtime.
   - Exit `1` → a cross-runtime `Review Runtime` is configured but its CLI is missing. Surface the printed warning to the user, then **fall back to a same-runtime review** (per `pipeline/agent-runtime-access.md` §2a) so the review still runs. Record the fallback for the log.

2. **Collect the change set** — determine every file created or modified during this implementation run, so the review covers the whole implementation rather than a single file:
   ```bash
   git status --porcelain
   git diff
   git diff --name-only
   git ls-files --others --exclude-standard
   ```
   The full diff plus the list of new (untracked) files is the review scope. Capture it so it can be handed to the subagent verbatim.

3. **Dispatch the dedicated review subagent** — spawn the reviewer under the resolved reviewer runtime (from sub-step 1, per the runtime note above and `pipeline/agent-runtime-access.md` §2a — same runtime by default, or the configured cross-runtime reviewer). A cross-runtime subprocess reviewer runs **in the background** per the §2a Background dispatch contract (never foreground with a fixed timeout), with the §2a progress feed armed (`pipeline/bin/review-progress`) so its reasoning is shown live rather than after the fact; a same-runtime native subagent needs no special handling. Give the reviewer everything it needs to review against the project's standards:
   - **The user story** — key, summary, and acceptance criteria (from Step 1).
   - **The implementation design notes** — `<notes-dir>/implementation-notes.md` (the resolved **Implementation Design** config path from Step 1, sub-step 4) if it exists (so the reviewer can check the implementation against the agreed design).
   - **The change set** — the full diff and changed-file list from sub-step 2.
   - **The review criteria** — the customer's `pipeline/coding-conventions.md`, the platform's `pipeline/platforms/<Platform>/best-practices.md` (resolve `<Platform>` from `pipeline/customer.config.md`), and the tech-stack rules in `pipeline/stack.config.md`. Mirror the review focus of `/code-review`: prioritize security issues, bugs, and architectural/convention concerns over stylistic preferences; verify the implementation meets the acceptance criteria and follows the design notes.
   - **Instructions** — compose the reviewer prompt from the versioned brief `pipeline/briefs/code-review-brief.md`: fill its placeholders (`{story_key}`, `{story_summary}`, `{notes_path}`, `{platform}`, `{round}`, `{mode}` = `story`) and append the change set; do not re-author the reviewer instructions ad hoc. The brief carries the read-only rule, the honesty rules, the `Status:` return contract, and the structured return format: findings with **severity** (Blocker / Major / Minor / Nit), **file:line**, rule violated, concrete fix, and rubric **category**, plus a fenced JSON block valid against `pipeline/schemas/review-findings.schema.json` (findings + per-category `coverage`). Save that JSON block, updated with this round's dispositions from sub-step 4, as `<notes-dir>/code-review-round-<n>.findings.json` — the last round's file is the canonical artifact the logged score is reproducible from. The review subagent MUST NOT modify code — it reviews only and reports back; the **host** computes the score, **after** sub-step 4's triage has written the dispositions into the findings file — exactly one scorer run per round, always over the post-triage file (scoring the pre-disposition file would make the logged score irreproducible from the published artifact):
     ```bash
     pipeline/bin/score-rubric --rubric code-review --findings <notes-dir>/code-review-round-<n>.findings.json \
       --out <notes-dir>/code-review-round-<n>.score.txt
     ```
     The canonical rubric is `pipeline/rubrics/code-review.rubric.json` (compact table in `06-code-review` Step 7; the JSON wins on divergence). The scorer emits `score=`, `band=`, per-axis lines, and the gate counts `blockers=`/`majors=`; a category the reviewer's coverage array did not mark reviewed comes back `null` and makes the total `unknown` (`verdict=incomplete`).

4. **Triage & fix** — act on the findings in the working tree:
   - Fix **every Blocker and Major** before proceeding.
   - Apply **Minor / Nit** findings when the fix is cheap; otherwise note them for the summary.
   - If your fixes changed the diff, re-run the review subagent on the **updated** change set.

5. **Evaluate the quality gate** — after **every** review round, let the gate decide whether the loop may exit. Do not re-derive the exit condition and do not judge "good enough" yourself — that decision has to be identical under Claude, Codex, and a small local model:
   ```bash
   pipeline/bin/quality-gate --round <n> --blockers <b> --majors <m> \
     [--score <rubric total>] [--prev-score <previous round's total>]
   ```
   - Pass the counts and rubric total from **this** round's `bin/score-rubric` output (`blockers=` / `majors=` / `score=` — the counts are the scorer's open-or-deferred findings, never an estimate); from round 2 on, pass the previous round's total as `--prev-score` so the helper can stop a loop that has stopped converging.
   - **If the scorer answered `verdict=incomplete`** (`score=unknown`): **omit `--score`** — an unmeasured total is not a number. Under a configured threshold the gate answers `score-unmeasured`; under the threshold-off default it answers `clean`, and the skill **logs `--exit-reason score-unmeasured` regardless** — the gate's decision stands, the logged reason stops overclaiming (`loop.unscored_axes` names what was missing). Without numeric scores on both rounds the no-progress brake cannot fire; an incomplete-verdict loop stops only on the round cap.
   - Branch on the `decision=` line:
     - **`pass`** — the gate is satisfied. Record the printed `exit_reason` (`clean`, `score-threshold`, or `score-unmeasured` — the last one is a pass whose configured score gate could not be applied) and proceed.
     - **`continue`** — go back to sub-step 3 and re-review the updated change set as round `n+1`.
     - **`stop`** — the loop ends with the gate still **open** (`exit_reason` = `budget-exhausted` or `no-progress`). **Do not proceed as if the review were clean.** Surface the remaining findings to the user, state plainly that the gate did not pass and why, and ask whether to keep iterating anyway or continue with the gap documented.
   - The gate reads `Quality Gate Score` and `Review Max Rounds` from `customer.config.md > ## Quality Gate` (defaults: no score threshold, 3 rounds). Run `pipeline/bin/quality-gate --check` once up front if you want to tell the user what the gate is before the first round.
   - **The severity gate is not negotiable and not configurable:** open Blocker/Major findings always block. A configured score threshold only ever makes the gate stricter.

6. **Record the outcome** — note the **reviewer runtime** used (same-runtime by default, or the configured cross-runtime reviewer / same-runtime fallback), how many review rounds ran, the findings counted by severity, the final **rubric score (/100) and band**, the gate's `exit_reason`, and what was fixed, for inclusion in the final summary (Step 10) and the JSON execution log. Even when the gate passed, if the final score lands in the 🔴 red band (<70), surface it prominently to the user.

Only proceed to static analysis (PMD / lint) and commit once the gate returned `decision=pass` — or once the user has explicitly accepted a `stop` outcome with the remaining findings documented.

### Step 7: Deploy & Validate

#### For `salesforce` platform:
Deploy all created/modified metadata to the **DEV org** (alias from config):

1. **Generate `package.xml`** covering all metadata created or modified in Step 5:
   - Collect all files by metadata type (ApexClass, LightningComponentBundle, Flow, CustomField, ValidationRule, CustomObject, PermissionSet, etc.)
   - Write a `package.xml` with the **API version** from config to a temporary location (e.g., `/tmp/<story-key>/package.xml`)
   - **apiVersion pre-deploy gate** — verify every changed Flow / Apex artifact is at the **API version from config**, bumping any stale ones (see Step 5 "For all metadata"). Quick scan:
     ```bash
     for f in $(git diff --name-only --diff-filter=d) $(git ls-files --others --exclude-standard); do
       case "$f" in
         *.flow|*.flow-meta.xml|*.cls-meta.xml|*.trigger-meta.xml)
           printf '%-70s %s\n' "$f" "$(grep -m1 -o '<apiVersion>[0-9.]*</apiVersion>' "$f")";;
       esac
     done
     ```

2. **Run the metadata format & Flow lint gate** on every XML file created or modified in Step 5 — mandatory before the deploy, since malformed or unformatted XML either fails the deploy outright or lands a whole-file diff:
   ```bash
   # Resolve the helper: read `Metadata Format Command` from pipeline/stack.config.md;
   # if absent, use the pipeline default below.
   pipeline/platforms/salesforce/scripts/check-metadata-format.sh --changed          # check
   pipeline/platforms/salesforce/scripts/check-metadata-format.sh --changed --fix    # auto-format, then re-check
   ```
   - Exit `0` → clean, proceed. Exit `2` → findings; fix and re-run until clean. Exit `1` → usage error.
   - The helper runs three layers: XML well-formedness, Prettier (`@prettier/plugin-xml`), and — for `*.flow-meta.xml` — the Flow Scanner. It skips any layer whose tool is absent and says so; a skipped layer is **not** a pass, so report which layers actually ran
   - **A Prettier "all files use Prettier code style" result is meaningless if `@prettier/plugin-xml` is not loaded** — without it Prettier parses no XML at all. The helper probes this with `prettier --file-info` and fails the gate rather than reporting a false green
   - Treat Flow Scanner findings with the severity mapping in `pipeline/platforms/salesforce/best-practices.md > Flow Scanner rules and their severity`: `DMLStatementInLoop`, `SOQLQueryInLoop`, `HardcodedId`, `HardcodedUrl`, `UnsafeRunningContext` are **Blockers**; missing fault paths and null handlers are **Major**. Fix those before deploying
   - Scope is **flows this story created or modified**. Findings in pre-existing flows are backlog to report in the summary, not scope to fix silently — same rule as PMD Priority 3 below

3. **Run PMD check** on every Apex class created or modified in Step 5 — this is a **mandatory gate before Apex tests run**:
   ```bash
   pmd check -d <apex-files> -R apex-rules.xml -f text --minimum-priority 2
   ```
   - List **every** new/modified `.cls` file from this story (production AND test classes) on the same `pmd check` invocation
   - **Block on Priority 1 AND Priority 2 violations** on the changed files. Fix them by editing the code (refactor for cyclomatic complexity, add `WITH USER_MODE` / `as user` for CRUD/FLS, replace SOQL/DML in loops, etc. — PMD's CRUD/FLS rule may still suggest the removed `WITH SECURITY_ENFORCED`; satisfy it with `WITH USER_MODE`, never by reintroducing the deprecated clause) and re-run PMD until it reports no P1/P2 findings on the changed files. Do not proceed to deploy/tests with open P1/P2 violations
   - Priority 3+ findings (style, ApexDoc, debug logging level) on **pre-existing** code are out of scope — do not refactor untouched code. If a P3 finding lives entirely inside a method/block you newly wrote in Step 5, fix it; otherwise leave it
   - Suppress with `@SuppressWarnings(...)` only when the violation is a deliberate, justified exception — never to silence noise

4. **Deploy to DEV org**:
   ```bash
   sf project deploy start --source-dir <all-source-dirs> -o <DEV-alias-from-config> --wait 10
   ```
   - If deployment fails, analyze the error, fix the issue, re-run PMD on the corrected files, and retry the deploy

5. **Run Apex tests** (if Apex classes were created):
   ```bash
   sf apex run test --class-names <TestClassName> --result-format human --code-coverage --synchronous --wait 10 \
     --output-dir /tmp/$ARGUMENTS/test-results -o <DEV-alias-from-config>
   ```
   - Present code coverage results in a table
   - If tests fail, fix the issue, re-run PMD on the corrected files, redeploy, and re-run tests
   - **Keep the machine-readable result.** `--output-dir` persists the run's JSON/JUnit artifact; note its path — that is the evidence for the `apex-tests` check in Step 11. **Green is an artifact, not a claim:** if no result file exists on disk, the check is `unchecked`, never `pass`, and `unchecked` blocks via `CLAUDE.md > Quality Gate & Loop Engineering` rule 2a

6. **Flow-activation check** — an org with `enableFlowDeployAsActiveEnabled = false` (the Salesforce default; often deliberately versioned that way) lands every deployed flow as an *inactive* latest version, so a UI test right after the deploy would silently exercise the **old** flow logic. Run this check before any UI test:
   - **Cost guard:** run this check **only** if the deploy in sub-step 3 contained at least one `*.flow-meta.xml` (a local string check on the already-known file list — no org call). If no flow was deployed, skip silently.
   - Resolve the activation helper: read the key **`Flow Activation Script`** from `pipeline/stack.config.md`; if absent, use the pipeline default `pipeline/platforms/salesforce/scripts/activate-latest-flows.sh`.
   - Run the helper in **check mode** (read-only, one Tooling query) against the deploy org, passing the DeveloperNames of the deployed flows (basename without `.flow-meta.xml`):
     ```bash
     <flow-activation-script> <DEV-alias-from-config> <Flow1> <Flow2> ...
     ```
   - **Exit 0** (all active — deploy-as-active org): print the script's one-line confirmation and continue.
   - **Exit 2** (inactive/outdated versions found): print the script's table plus a warning that a UI test now would run the old version, and the ready-to-run activation call: `<flow-activation-script> <DEV-alias> <flows> --activate`. **Hint only — never activate automatically** (keeping the old version active can be deliberate).
   - **Exit 1** (query error **or a flow not found in the org**): if the script output reports a flow as not found, treat it as a name-resolution failure — the basename→DeveloperName derivation was wrong for that flow; verify the names and re-run the check before trusting it. Only for genuine query errors (org unreachable), surface the output as a warning and continue — the deploy itself already succeeded.

7. **Run UI tests** — check `stack.config.md` for a `## Testing` section:
   - **If no `## Testing` section exists**, skip UI testing and proceed to Step 8
   - If `E2E Framework` is `none`, skip UI testing and proceed to Step 8
   - If `E2E Framework` is set (e.g., Playwright):
     1. Ensure the test org is available — retrieve the org URL via `sf org open -o <Test Org Alias from config> --url-only`
     2. Run the E2E tests using the configured command (e.g., `npx playwright test`)
     3. If tests fail because the implementation changed UI labels, page structure, or component behavior, update the affected spec files in the `E2E Test Directory`
     4. If new UI functionality was added (new LWC, Screen Flow, custom page), create corresponding E2E spec files following the existing test patterns
     5. If visual regression snapshots fail due to intentional UI changes, update baselines using the snapshot update command from `stack.config.md`
   - Present a summary of test results (passed/failed/skipped)
   - **All tests must pass before proceeding to Step 8**
   - Keep the framework's machine-readable report (JUnit XML, Playwright report directory) and note its path — that is the evidence for the `e2e-tests` check in Step 11. No report on disk → `unchecked`, never `pass`

#### For non-`salesforce` platforms:
Validate the implementation locally using the commands from `stack.config.md`:

1. **Run linting** using the lint command from `stack.config.md` (e.g., `npm run lint`)
   - Fix any lint errors before proceeding

2. **Run the build** using the build command from `stack.config.md` (e.g., `npm run build`)
   - If the build fails, fix the issue and retry

3. **Run UI tests** — check `stack.config.md` for a `## Testing` section:
   - **If no `## Testing` section exists**, skip UI testing entirely and proceed to Step 8
   - If `E2E Framework` and `Component Test Framework` are both `none`, skip testing and proceed to Step 8
   - If `Component Test Framework` is set (e.g., Vitest, Jest): run the component test command (e.g., `npm run test`)
     - If tests fail, analyze the failure. If the implementation caused a regression, fix the code. If an existing test needs updating due to intentional changes, update the test.
   - If `E2E Framework` is set (e.g., Playwright, Cypress): run the E2E test command (e.g., `npm run test:e2e`)
     - If E2E tests fail due to a change in UI labels, form fields, or page structure introduced by the implementation, update the affected E2E spec files
     - If visual regression snapshots fail due to intentional UI changes, update the baselines using the snapshot update command from `stack.config.md`
   - Present a summary of test results (passed/failed/skipped)
   - **All tests must pass before proceeding to Step 8**
   - Keep the framework's machine-readable report (JUnit XML, Playwright report directory) and note its path — that is the evidence for the `e2e-tests` check in Step 11. No report on disk → `unchecked`, never `pass`

### Step 8: Create Test Data in DEV Org
Create test data in the **DEV org** so the implementation can be manually verified. **Always create test data** — even for bug fixes where existing records are mentioned in the story. The goal is to have dedicated, reproducible test records that match the exact conditions needed to verify the implementation.

This step follows the workflow defined in `skills/14-create-testdata/SKILL.md`:

1. **Analyze test data requirements** — based on the implementation AND acceptance criteria, determine what records are needed to verify each scenario (happy path, edge cases, error conditions). If the story mentions specific existing records (e.g., "Account 210460 Banzhaf"), create similar test records that reproduce the same conditions — do not rely on existing data alone.
2. **Read the test data configuration** from `pipeline/customers/<customer>/testdata.config.md`
3. **Query existing metadata** — resolve Record Type IDs, Profile IDs, and Queue IDs as needed by the test data config
4. **Create records in dependency order** (parents before children) using the **Composite Tree API**, replacing placeholder tokens (`{{RecordTypeId:...}}`, `{{Ref:...}}`, `{{Today}}`, `{{Year}}`, `{{OrgAlias}}`)
5. **Add a 2-second pause** between API batches to respect rate limits
6. **Check for duplicates** — before creating, query for existing records with the same name pattern and warn the user if found
7. **Verify created records** — query the org to confirm all records were created successfully
8. **Present a summary** table of created test data (sObject, Name, Record Type, Id, total count)

> **Rules:** Prefer Composite Tree API over individual record creation. Avoid `sf data import bulk` (macOS line ending issues). If a required parent record fails, skip dependent children and inform the user. See `skills/14-create-testdata/SKILL.md` for full error handling details.

### Step 8a: Testdata Impact Gate (conditional)

> Skip this entire step if the active customer has no `testdata.catalog.json` (check `pipeline/customers/<customer>/testdata.catalog.json`, auto-resolved via the active customer symlink — same file `/story-testdata` and `/create-testdata` use). Customers without a testdata catalog have no impact contract to enforce.

The testdata-impact contract (`pipeline/schemas/testdata-impact.schema.json`, VP-09) makes the story's effect on the testdata catalog explicit and machine-checkable. This step enforces that the contract was actually declared and honored before the story is reported as done.

1. **Resolve the impact artifact path** — the same **Implementation Design** notes directory resolved in Step 1, sub-step 4 (e.g. `implementation-design/$ARGUMENTS/testdata-impact.json` in the customer config repo).

2. **If the artifact is missing:** do not silently skip it. Tell the user: *"Die Story-Testdatenanalyse (`/story-testdata`) wurde für $ARGUMENTS noch nicht ausgeführt — es liegt keine `testdata-impact.json` vor."* Ask whether to run `/story-testdata $ARGUMENTS` now, or proceed and carry the gap as an open item into Step 10. **Never report the story as "vollständig implementiert" while this gap is open.**

3. **If the artifact exists, validate it against the schema** using the canonical Node.js/Ajv entry point (`bin/validate-testdata-impact`, backed by `cli/lib/testdata/impact-validator.js` and `pipeline/schemas/testdata-impact.schema.json` — the single source of truth, no separate hand-written check):
   ```bash
   pipeline/bin/validate-testdata-impact implementation-design/$ARGUMENTS/testdata-impact.json
   ```
   A non-zero exit means the artifact itself is malformed — report the validator's errors verbatim and treat this exactly like "missing" (sub-step 2): the declaration cannot be trusted until it is schema-valid.

4. **If `decision: "change"`:** cross-check every declared-as-active axis (A-11 — ten equally-ranked axes; only the ones the story actually marked active need checking, none is pauschal mandatory) against what this implementation run (Steps 5–8) actually delivered:
   - `requiredChanges.catalog: true` → was `testdata.catalog.json` (recordGroups/presets) actually touched?
   - `requiredChanges.presets[]` → were exactly those presets added/changed in the catalog?
   - `requiredChanges.executors[]` → were exactly those executor script paths created/modified?
   - `requiredChanges.validatorModules[]` → were those validator module IDs actually added/changed under the catalog's `validator.modules`?
   - `requiredChanges.validatorProfiles[]` → were those validator profile IDs actually added/changed under the catalog's `validator.profiles`?
   - `requiredChanges.capabilities[]` → were those capabilities (objects/fields/Record Types) actually checked/added before DML?
   - `requiredChanges.cleanup: true` → was the cleanup config (deletionOrder / crossReferenceFields) updated?
   - `requiredChanges.storyTagMapping: true` → was `storyTagMapping` extended with the declared keywords/tags?
   - `requiredChanges.documentation[]` → were those documents actually updated?
   - `requiredChanges.tests[]` → were those test cases actually added/changed?
   - Any declared-but-not-delivered item is a **gap**: either finish the change now, or explain to the user why it is deliberately deferred. List every remaining gap in Step 10; do not report the story as fully implemented while gaps are open.

5. **If `decision: "none"`:** sanity-check the `noImpactReason` against what actually changed in Step 5 — did the implementation add/rename a field, object, Record Type, or business/validation rule that a test data consumer would need? If so, the "none" declaration is stale. Flag it to the user and recommend re-running `/story-testdata $ARGUMENTS` before treating testdata as unaffected. Never silently accept a "none" that contradicts the actual metadata diff.

6. **Record the outcome** — gate result (clean / gaps found / artifact missing / artifact invalid) — for the Step 10 summary and the execution log.

### Step 8b: Acceptance Verification Record

Write `<notes-dir>/acceptance-verification.md` — the per-criterion record that `pipeline/bin/story-gate --phase close` reads before `/promote-us` promotes the story or `/release-pr` transitions it. One row per acceptance criterion from the story (and the notes' `## Acceptance Criteria Mapping`):

```markdown
# Acceptance Verification: $ARGUMENTS

**Story:** $ARGUMENTS
**Verified:** <YYYY-MM-DD>

| # | Acceptance Criterion | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | <criterion> | verified | deployment/$ARGUMENTS/test-results (TestClass.testMethod) |
| 2 | <criterion> | unchecked | <why it could not be verified> |
```

- `Status` is exactly `verified`, `failed` or `unchecked` — the closed vocabulary the close gate validates. **Write the truth:** a criterion you could not verify is `unchecked`, never `verified`; the gate blocking later is the system working, not a problem to word around.
- `Evidence` is mandatory for `verified` rows: the test-result artifact from Step 7 (`/tmp/$ARGUMENTS/test-results`, the E2E report path), a test method name, or a concrete manual-verification note. A verified row without evidence blocks the close gate by design.
- **Criteria only a person can verify** (UI layout, Login-As behaviour, a manual report run): do not leave them as a bare `unchecked`. Write `<notes-dir>/manual-verification.md` with one numbered protocol per such criterion — user or role to log in as, preparation (test-data preset or record), click path, expected result, what to attach as evidence — and set the row's Evidence to `manual-verification.md#<n> — ausstehend`. Whoever executes it flips the row to `verified` with `manual: <name>, <date>, <screenshot or record id>`; that is the evidence form the close gate accepts. List the protocol with `--artifact` in Step 11.
- Cover **every** acceptance criterion — the close gate cross-checks the row count against the notes' `## Acceptance Criteria Mapping` and blocks on a subset.
- List the file with `--artifact` in Step 11.

### Step 8c: Knowledge Impact Check

Detect which knowledge-base documents mention the components this run touched — silently outdated topic docs poison every downstream answer the knowledge base gives.

1. Run the canonical mapper (single source of truth — never re-derive a grep strategy in the skill):
   ```bash
   mkdir -p /tmp/$ARGUMENTS
   pipeline/bin/knowledge-impact <every file created or modified in Step 5> \
     | tee /tmp/$ARGUMENTS/knowledge-impact.txt
   ```
   Paths are fine as input — the tool reduces them to API names. Customers without a knowledge base yield `impact=0`; the step no-ops without a Platform Guard.
2. **If `impact=0`:** nothing is affected — record the check as green and move on.
3. **If `impact>0`:** each `IMPACT` line names a knowledge doc that describes a component this run changed. Do **not** edit those docs here — detection belongs to this skill, maintenance to the knowledge workflow. List the affected docs (with the tokens that hit) in the Step 10 summary and recommend a `/build-knowledge <topic>` run per doc, passing the hit list as input. Cross-check against the *expected documentation impact* the design notes declared (design skill, Step 2.8) and call out any doc affected now that the design did not anticipate.
4. **Enqueue the hits into the knowledge-debt queue — mechanically, never by hand:**
   ```bash
   set -o pipefail   # tee must not mask an enqueue failure as green
   pipeline/bin/knowledge-debt add --story $ARGUMENTS --source implement \
     --from-report /tmp/$ARGUMENTS/knowledge-impact.txt \
     | tee /tmp/$ARGUMENTS/knowledge-debt.txt
   ```
   The tool parses the report's `IMPACT` lines itself (one open entry per affected doc, deduplicated per story+doc across re-runs) — never retype docs or tokens as arguments. Run it in every case: a report with `impact=0` enqueues nothing and exits 0, so the call is uniform. The one environment where it cannot run is an installation without an active customer (the harness development repo itself): there is no queue to resolve, the tool exits 1, and the check is recorded `unchecked` — every customer installation resolves a queue. If the design-phase impact report was preserved (e.g. copied into the notes directory), pass it as `--expected-file <design-report>` so docs the design did not declare are marked `unanticipated` — input for `/improve-skills`; omit the flag otherwise, the marker stays null rather than guessed. The queue lives in the active customer's config repo (`knowledge-debt.jsonl`) and is drained by `/build-knowledge`, which resolves entries once the covering topic doc is updated.
5. **Offer the follow-up now (interactive runs only):** when `impact>0`, ask via `AskUserQuestion` whether to run `/build-knowledge` for the affected topics immediately or leave the entries queued for a later run — an offered next step, never a silent jump (*Workflow Discipline*). Unattended runs (dispatch workers, CI) enqueue silently; the post-dispatch `/build-knowledge` run drains the queue.
6. This check is **informational, never a gate**: hits are follow-up work, not a failure — now durably queued instead of only recommended. In Step 11 record `--check "knowledge-impact:pass:/tmp/$ARGUMENTS/knowledge-impact.txt"` when the mapper ran (with or without hits), and `--check "knowledge-debt:pass:/tmp/$ARGUMENTS/knowledge-debt.txt"` when the enqueue ran — the tee'd tool output is the evidence, because on `impact=0` the queue file itself is deliberately never created; either check is `unchecked` only when its tool could not run.
7. Hand the same report to the log with `--knowledge-impact-file` (Step 11). The check records *that* the mapping ran; the report's `docs=` / `tokens=` / `impact=` counters record **how much documented knowledge this implementation actually had to work with** — the dose behind every quality number in the same log. Let `bin/log-skill` parse the file; never retype the counters as values from memory.

### Step 9: Commit & Create a pull request
- **Diff hygiene — before staging anything:** the commit may contain only files this story created or modified. Compare `git diff --stat` with `git diff --ignore-all-space --stat`; every file whose change disappears under `--ignore-all-space`, or that is not on the Step 5 change list, is churn (a formatter run, an org retrieve, a merge that re-formatted untouched files) — restore it with `git checkout -- <file>` and, if a formatter caused it, narrow the formatter's scope instead of committing its output. Merge the base branch with a plain `git merge`; never format after merging. A deliberately included out-of-story file needs one line of reason in the PR description.
- **Split deployable and non-deployable files into separate commits (CRITICAL):**
  - **Commit 1 — deployable platform source** (files under the **Source Path** from `stack.config.md`, e.g. `force-app/`): message `$ARGUMENTS <summary>`, **without** the CI skip pattern — this commit must trigger the CI pipeline (e.g. feature/* → INT deployment).
  - **Commit 2 — non-deployable artifacts** (scripts, docs, `deployment/*.md`, configs), if any: separate commit whose message **ends with the CI skip pattern** from `customer.config.md` (e.g. `[skip ci]`) — a CI run over a non-deployable tip commit produces an empty delta and fails the deploy stage (`NothingToDeploy`).
  - Follow the **co-author policy** from config
- **Push** the feature branch to the remote — with both commit kinds present, push the deployable commit **on its own first** (the CI evaluates the skip pattern and builds its delta from the push tip), then push the skip-pattern commit in a second push
- **Create a pull request** from the feature branch into the base branch
- Include a reference to the story in the PR description:
  - If `Story Backend` is `jira`: reference the Jira story (e.g., `Implements $ARGUMENTS`)
  - If `Story Backend` is `markdown`: reference the story file (e.g., `Implements $ARGUMENTS — see stories/$ARGUMENTS.md`)
- If `Story Backend` is `markdown`: update the story file — change `status: In Progress` to `status: Done` in the YAML frontmatter

### Step 10: Summary
Present a summary of:
- Implementation approach chosen and rationale (why declarative vs code)
- All files created (grouped by type)
- **Code review outcome** — reviewer runtime used (the cross-runtime complement, or same-runtime fallback), rounds run, findings by severity (Blocker / Major / Minor / Nit), the **rubric score (/100) and band**, the **quality-gate outcome** (`pass` / `stop`, with the `exit_reason`), and what was fixed (from Step 6). **A gate that ended in `budget-exhausted` or `no-progress` MUST be stated here explicitly — the story is not "vollständig implementiert" while the gate is open**
- **Testdata impact gate outcome** (if applicable, from Step 8a) — clean / gaps found / artifact missing / artifact invalid, and any remaining gaps. **If this gate is open (missing, invalid, or gaps remain), the story MUST NOT be reported as "vollständig implementiert" — state explicitly what is still outstanding.**
- **Knowledge impact** (from Step 8c) — the affected knowledge docs with the tokens that hit, the queue state (entries enqueued this run, total open debt for the customer), the recommended follow-up (`/build-knowledge <topic>` per doc, or the immediate run the user chose in Step 8c), any impact the design notes did not anticipate, or "no knowledge docs affected"
- How to deploy the solution
- Any open questions or assumptions made

If there are **manual configuration steps** needed post-deployment (e.g., activating Flows, scheduling Batch jobs, assigning Permission Sets, enabling Custom Metadata, configuring Named Credentials):
1. **Present the steps to the user** and ask for confirmation using `AskUserQuestion`:
   - Show the full list of manual steps as a numbered list
   - Ask: "Should these manual steps be saved to the release deployment file?"
   - Option 1: "Yes, save as shown"
   - Option 2: "Edit steps first" — if selected, ask the user to provide the corrected steps via free text, then present the updated list for final confirmation
   - Option 3: "No, display here only"
2. If confirmed (after any edits), save them to a **manual deployment steps file**:
   - Fetch the story via the Atlassian adapter's `getJiraIssue` operation (see `pipeline/atlassian-access.md` §3) and read the `fixVersions` field to get the release name (e.g., `1.10.3`)
   - If no Fix Version is set, **fallback**: derive the version from the current branch name (`git branch --show-current`) — extract the version from a `release/<version>` pattern
   - If neither Fix Version nor a release branch is available, inform the user and skip
   - Create or update the file `deployment/<fix-version>/Release-<fix-version>-Manual-Deployment-Steps.md`
   - If the file **already exists**, append the new story's steps below the existing content
   - If the file **does not exist**, create it with the following structure:
     ```markdown
     # Manual Deployment Steps — Release <fix-version>

     ## $ARGUMENTS
     1. <step 1>
     2. <step 2>
     ...
     ```
   - When appending to an existing file, add a new section:
     ```markdown

     ## $ARGUMENTS
     1. <step 1>
     2. <step 2>
     ...
     ```
   - Confirm to the user that the steps were saved to `deployment/<fix-version>/Release-<fix-version>-Manual-Deployment-Steps.md`
   - When committing this file, append the **CI skip pattern** from `customer.config.md` to the commit message (it is not deployable metadata — see the Step 9 split rule)

### Step 11: Log Execution

Always the last step — including when the run aborted early in Step 1, was deferred by the user, or produced no reviewable change. A run that is not logged did not happen as far as `/pipeline-stats` and `/improve-skills` are concerned.

Write the log with `pipeline/bin/log-skill` — never hand-author the JSON:

```bash
pipeline/bin/log-skill --skill implement-us --identifier $ARGUMENTS \
  --status <success|partial|failed> \
  --preferred-runtime openai-codex \
  --summary "<1–2 sentence result>" \
  --artifact <path> \
  --iterations <review rounds run> --verifier "bin/quality-gate" \
  --score-report-file <notes-dir>/code-review-round-<n>.score.txt \
  --exit-reason <clean|score-threshold|score-unmeasured|budget-exhausted|no-progress> \
  --check "story-gate:<pass|fail>:<gate reason or override note>" \
  --check "pmd:<pass|fail|unchecked>:<report path>" \
  --check "metadata-format:<pass|fail|unchecked>:<report path>" \
  --check "flow-scanner:<pass|fail|unchecked>:<report path>" \
  --check "apex-tests:<pass|fail|unchecked>:<result path>" \
  --check "deploy:<pass|fail|unchecked>:<deploy output path>" \
  --check "knowledge-impact:<pass|unchecked>:/tmp/$ARGUMENTS/knowledge-impact.txt" \
  --check "knowledge-debt:<pass|unchecked>:/tmp/$ARGUMENTS/knowledge-debt.txt" \
  --knowledge-impact-file /tmp/$ARGUMENTS/knowledge-impact.txt \
  --output "<full run text>"
```

- Pass `--artifact` once per created or modified file.
- Take `--iterations` and `--exit-reason` verbatim from the **last** `pipeline/bin/quality-gate` call in Step 6 (with the `score-unmeasured` override for incomplete verdicts, sub-step 5). The score is never typed: `--score-report-file` points at the last round's `bin/score-rubric` report, from which `bin/log-skill` parses `final_score`, the per-axis `loop.axes`, and `loop.unscored_axes` — a conflicting `--final-score` is a usage error. If Step 6 never ran — early abort, user deferral, or no reviewable change — the loop flags are still mandatory: pass `--iterations 1 --exit-reason not-applicable` and omit the score report. A `budget-exhausted` or `no-progress` exit caps the status at `partial`.
- Record one `--check` per deterministic gate this run actually reached, with the path of the artifact the verdict came from — the story gate (Step 1.4; its `reason=` line, plus the user's override note when the gate was overridden), the PMD report (Step 7.3), the metadata-format / Flow-Scanner report (Step 7.2), the Apex test result directory (Step 7.5), the E2E report (Step 7.7), the deploy output (Step 7.4).
- Pass `--knowledge-impact-file` whenever Step 8c produced a report. It is parsed, not typed: `bin/log-skill` reads `docs=`/`tokens=`/`impact=` straight out of the file into the log's `knowledge_impact` object, so the run's rubric score can later be read against the size of the knowledge base that produced it. A path that is not on disk is a usage error, never a logged zero.
- **Green is an artifact, not a claim.** `unchecked` is **not** a pass: a gate whose evidence is not on disk — tool missing, step skipped, deploy target unreachable — is recorded as `unchecked`, and per `CLAUDE.md > Quality Gate & Loop Engineering` rule 2a every `fail` **and** every `unchecked` on a mandatory check counts as at least one `--majors` in the Step 6 gate call. Omit a `--check` only for a gate that does not apply to this platform at all.

## Important Rules
- Follow all conventions from CLAUDE.md
- Prefer declarative solutions over code when both can meet the requirement
- Bump the **API version** (from config) on every Flow / Apex artifact you modify — not only new files — since org-retrieved metadata often carries a stale version.
- **Bump scope is strictly the metadata changed by THIS implementation.** Only artifacts you create or modify as part of the current story may have their API version bumped. Never bump the API version of any other file — not files retrieved purely for reference, not adjacent metadata in the same folder, not unrelated artifacts in the deploy package. A bumped API version on a file you didn't otherwise change is an out-of-scope modification ("don't touch what you don't own").
- If `Story Backend` is `jira`: Use the Atlassian adapter (`pipeline/atlassian-access.md`) for all Jira operations — branch on `Deployment Type` from `customer.config.md`; never hardcode URLs, Cloud IDs, or PAT env var names
- If `Story Backend` is `markdown`: Use local file I/O only — no Atlassian calls needed
- Add always the epic id in the header with @see, so the code can be tracked back and linked to a user story in Jira
- Run the **code-review pass** (Step 6) on the whole implementation — via a dedicated reviewer (same runtime by default, or an optional cross-runtime reviewer when `Review Runtime` is configured; see `pipeline/agent-runtime-access.md` §2a) — before static analysis and commit; fix all Blocker/Major findings first
- Let `pipeline/bin/quality-gate` decide when the review loop exits (Step 6, sub-step 5) — never judge "good enough" ad hoc, and never report a `stop` outcome as a clean review. A gate that did not pass is a result to surface, not a step to skip
- Run the **Testdata Impact Gate** (Step 8a) whenever the active customer has a `testdata.catalog.json` — a missing, invalid, or contradicted impact declaration is a gap that must be surfaced, never silently dropped from the final summary
- ALWAYS write the execution log with `pipeline/bin/log-skill` — never hand-author the JSON. Run:
  ```bash
  pipeline/bin/log-skill --skill implement-us --identifier $ARGUMENTS --status <success|partial|failed> \
    --preferred-runtime openai-codex \
    --summary "<1–2 sentence result>" \
    --artifact <path> \
    --iterations <review rounds run> --verifier "bin/quality-gate" \
    --score-report-file <notes-dir>/code-review-round-<n>.score.txt \
    --exit-reason <clean|score-threshold|score-unmeasured|budget-exhausted|no-progress> \
    --output "<full run text>"
  ```
  It guarantees a schema-valid document and writes it to `pipeline/customers/<customer>/logs/<YYYY-MM-DD>-<customer-short-name>-$ARGUMENTS-implement-us.json` (customer, active runtime, and timestamp resolve from config automatically; pass `--artifact` once per created/modified file; the directory is created if needed). Include the code-review outcome from Step 6 — reviewer runtime, rounds run, findings by severity, and the rubric score/band — in `--summary` and `--output`.
- **Always record the review loop** with the four loop flags above, taking `--iterations` and `--exit-reason` from the last `pipeline/bin/quality-gate` call in Step 6. This is what makes the loop measurable: `/pipeline-stats` reports rounds-to-green per skill and flags loops that habitually exhaust their budget, and `/improve-skills` mines exactly that history. If Step 6 was skipped entirely (no reviewable change), pass `--iterations 1 --exit-reason not-applicable`. A `budget-exhausted` or `no-progress` exit means the story status is at best `partial` — never `success`.

## Error Handling
- If `Story Backend` is `jira` and the Jira issue cannot be fetched, inform the user with the error details and abort
- If `Story Backend` is `markdown` and the story file does not exist, list available stories and ask the user
- If branch creation fails (e.g., branch already exists), ask the user whether to reuse the existing branch or choose a different name
- If PMD check finds Priority 1 OR Priority 2 violations on the new/modified Apex classes, fix them before deploying — the gate runs at Step 7 with `--minimum-priority 2` and blocks the Apex test run
- If PR creation fails (e.g., Azure DevOps CLI not available), ensure the branch is pushed and provide the manual PR creation URL

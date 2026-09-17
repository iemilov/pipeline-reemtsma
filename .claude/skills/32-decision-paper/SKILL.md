---
name: decision-paper
description: Use when the business has to choose between solution options before a story is designed — produces a short decision paper with options, benefits, drawbacks, effort including the test impact, risks, recommendation and the decisions that remain open; the business-facing step before /design-us
argument-hint: <story-key | topic-slug> [--options "A;B;C"] [--audience business|management|technical] [--lang <code>] [--to-jira]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Purpose

Every solution decision has the same shape: options, benefits, drawbacks, effort, risks, a recommendation, open decisions. `/design-us` writes implementation notes for developers once the option is chosen; this skill writes the page the business reads to choose. It is deliberately short, non-technical unless asked, and honest about effort — including the **test impact**, which is where estimates usually move.

## When to Use / When NOT to Use

- Use when a ticket, a transcript or a chat contains at least two viable ways to solve a requirement, or when the customer has asked "what are the options and what do they cost".
- Use for build-vs-configure, switch-vs-delete, event-vs-export-vs-middleware type questions.
- Do NOT use for implementation detail — `/design-us`.
- Do NOT use to split scope into stories — `/analyze`.

## Configuration

Read `pipeline/customer.config.md` (Short Name, documentation language, Platform, Atlassian settings, effort unit — person-days unless the config says otherwise), `pipeline/stack.config.md` (stack, test frameworks, deployment path — they drive the effort model), `pipeline/customer.domain.md` (terminology; the paper uses business terms, not API names).

Inputs: a story key (read the ticket via the Atlassian tools, plus any linked implementation notes under the Implementation Design path) or a topic slug (use the current chat and any file the user names); `--options` to fix the option list; `--audience` (default `business`); `--lang` overrides the documentation language; `--to-jira` posts the paper as a comment on the story after the user has seen it.

## Workflow

### Step 1: Frame the decision

Write, in three sentences, what has to be decided, by whom, by when, and what happens if nothing is decided. If the ticket or chat does not say who decides, ask that one question — everything else has a default.

State the **fixed constraints** every option must satisfy (regulatory, contractual, technical, already-decided points) so options that violate them are not carried along.

### Step 2: Enumerate options

Take the options from `--options`, the ticket, or the chat. Always add **Option 0 — do nothing / minimal change** unless it is explicitly excluded; it is the baseline effort and risk are measured against. Discard options that violate a fixed constraint, but list them in one line under *Not considered* with the reason.

For each option, verify against the codebase that it is actually possible as described — read the affected components (a quick `grep`/read, not a design). An option that would require a change the platform does not allow is not an option.

### Step 3: Effort with test impact

Estimate per option in the configured unit, as a **range**, split into:

| Part | What it covers |
|---|---|
| Build | code, configuration, metadata |
| Test | unit/Apex tests, **regression on everything the change touches**, UAT support, test data |
| Deployment & data | migration, backfill, activation steps, manual steps in production |
| Communication & documentation | user information, manuals, runbooks |

Rules that keep the estimate honest:

- Test effort is never below 30 % of build unless the option changes nothing that existing tests cover — say which tests are affected.
- A change to a shared component (a service class used by several processes, a trigger handler, a central flow) adds regression effort for **every** consumer; name them.
- Deleting data or configuration adds effort for reversibility (export, rollback plan) even when the deletion itself is trivial.
- State the assumptions each range depends on. An estimate without its assumptions is a guess.

### Step 4: Benefits, drawbacks, risks

Per option, three to five bullets each, in business language:

- **Benefits** — what improves for whom.
- **Drawbacks** — what gets worse, what is lost, what stays manual.
- **Risks** — what could go wrong, how likely, how reversible. Include the consequences that are easy to miss: automatic processes that stop (scheduled point reductions, anniversaries, syncs), reports that change, integrations that receive different values.

### Step 5: Recommendation and open decisions

One recommended option with the reasons in three bullets, and the condition under which a different option would be better. Then the **open decisions** — every question the business must answer before `/design-us` can start, each with the default that applies if nobody answers.

### Step 6: Write and deliver

Write `decisions/<story-key or slug>-<YYYY-MM-DD>.md` in the documentation language:

1. Decision to make (Step 1) · 2. Constraints · 3. Options table — one row per option: option, in one sentence, effort range (with test part shown), key benefit, key drawback, risk · 4. Option details (Steps 3–4) · 5. Recommendation · 6. Open decisions with defaults · 7. Not considered · 8. Assumptions.

Length: one to two pages for `business` and `management`; the technical appendix (affected components, estimate breakdown) only with `--audience technical`. Show the paper in the chat; with `--to-jira`, post it as a Jira comment **after** the user has confirmed the text.

Create `<YYYY-MM-DD>-<customer-short-name>-<identifier>-decision-paper.json` in `.claude/skills/32-decision-paper/logs/` per the CLAUDE.md schema.

## Important Rules

- **Business language.** No API names, class names, story keys inside the option text unless `--audience technical`; put them in the appendix.
- **Ranges, with assumptions and test impact.** Never a single number; never a range without the assumptions it rests on.
- **Option 0 is always there** unless excluded, so the reader sees what "not deciding" costs.
- **Verify feasibility in the code** before listing an option; do not present options that cannot be built as described.
- **Name the processes that stop or change** under each option; those are the drawbacks the business does not see.
- **Recommend one option.** A paper without a recommendation is a list.
- Read effort units, language and terminology from config and the domain file. No AI attribution.

## Error Handling

- **Ticket not readable:** work from the chat and say the ticket was not read; status `partial`.
- **Only one viable option:** say so, still produce the paper with Option 0 as the comparison, and mark the recommendation as "no real alternative".
- **Effort cannot be estimated for an option** (external dependency, unknown volume): give the range for the known parts and list the unknown as an open decision with what is needed to close it.

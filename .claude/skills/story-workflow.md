# Story Workflow: From Transcript to Implementation

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`


> Binding process for everyone involved. Goal: every story has complete, reviewed implementation notes before implementation starts.

## Roles

| Role | Responsibility |
|------|----------------|
| **PO** | Business requirements, story split, refinement |
| **DEV** | Design deepening, implementation, PR |

## Process

### Phase 1: Story creation (PO)

**Skill:** `/create-us <epic-id>`

1. PO places meeting transcripts / requirement documents in the input folder
2. PO runs `/create-us`:
   - Transcripts are read, requirements are synthesised
   - Optional question: how many developers? (affects parallelisability)
   - An MVP split is proposed (every story = vertical slice, usable in the UI after deployment)
   - PO confirms or adjusts the split
3. Result:
   - **Jira tickets** — concise: user story, background, value list / field changes, acceptance criteria, dependencies. No technical scope.
   - **DRAFT implementation notes** — first orientation per story (`Status: DRAFT`). Based on transcript information only, no codebase analysis.

**Outcome:** Stories exist in the story backend + DRAFT notes are stored under the **Implementation Design** path from the config (`pipeline/customers/<customer>/implementation-design/<story-key>/`)

### Phase 2: Refinement (team)

**No skill — meeting**

1. PO presents stories + DRAFT implementation notes to the team
2. Team discusses:
   - Are the stories split correctly?
   - Are there open business questions?
   - Which technical decisions are pending? (e.g. dedicated FlexiPage vs. visibility rules, new record type vs. existing one)
3. Decisions are noted (keywords are enough)
4. Stories are assigned to tracks / developers

**Outcome:** Every DEV knows which stories they own and which decisions were made in refinement.

### Phase 3: Design deepening (DEV)

**Skill:** `/design-us <story-key>`

1. DEV runs `/design-us` for their assigned stories
2. The skill does what was still missing in Phase 1:
   - Codebase analysis (existing patterns, naming conventions, affected objects)
   - Check the test data config (which presets fit, what needs to be added)
   - Reconcile with domain knowledge
   - Clarify open questions interactively (DEV answers based on the refinement decisions)
3. DRAFT notes are overwritten with complete FINAL notes (`Status: FINAL`)
4. Alternatively without the skill: prompt the refinement decisions directly and have the open questions answered — notes are updated and questions marked as resolved

**Outcome:** FINAL implementation notes with resolved questions, affected objects, test plan, and a clear implementation strategy.

### Phase 4: Implementation (DEV)

**Skill:** `/implement-us <story-key>`

1. DEV runs `/implement-us`
2. The notes status is checked:
   - **FINAL** → notes are used as the basis for implementation
   - **DRAFT** → stop. Run Phase 3 first.
   - **Missing** → stop. Run Phase 3 first.
3. Implementation based on the FINAL notes
4. On deviations during implementation: **keep the implementation notes up to date** (do not only change the code)

### Phase 5: Review (cross-team)

**Skill:** `/code-review` + pull request

1. DEV creates the PR with `/commit`
2. Another DEV reviews (cross-review: track A reviews track B and vice versa)
3. PR description + implementation notes serve as context for the reviewer
4. Reviewer questions are discussed in the PR; findings flow back into the implementation notes

**Why cross-review:** every developer works on their own track. Through the review, the other track gets to know the implementation — knowledge transfer without an extra meeting.

## Summary

```
PO: /create-us         →  Story tickets + DRAFT notes
         ↓
Team: Refinement        →  Decisions + track assignment
         ↓
DEV: /design-us         →  FINAL notes (overwrites DRAFT)
         ↓
DEV: /implement-us      →  Code (only with FINAL notes)
         ↓
DEV: /commit + PR       →  Cross-review
```

## Important Rules

- **Implementation notes are the single source of truth** for the business process per story — not the ticket system, not the code alone
- **Always keep the notes up to date** on changes — even for "small" adjustments (new field, changed validation rule). Otherwise downstream skills (documentation, test data, business manuals) produce faulty results.
- **Story tickets stay lean** — only for the reference number, status tracking and a rough overview. The real content lives in the notes.
- **DRAFT notes are not implementation input** — they are a first orientation for refinement. `/design-us` must have run before implementation.

# Skill Improvements — status and next steps

Written 2026-09-17 after the full rewrite of the pipeline for the Reemtsma installation. Use this file as the entry point next time: it lists what works, what is a stub, and what to do in which order.

## 1. Where things stand

| Repository | Remote | State |
|---|---|---|
| Pipeline | github.com/iemilov/pipeline-reemtsma (`main`) | all 37 skills rewritten to run without helper scripts; last commit `4ba8696` |
| Customer config | github.com/iemilov/pipeline-reemtsma-config (`main`) | new repository, config, stack, domain, test data and communication files; `logs/` ignored |
| Main project | dev.azure.com/lanespot/reemtsma (`feature/AP2-design`) | documentation, review report, project update committed with this report |

Every skill now follows the same conventions: Atlassian MCP tools with the Cloud ID from config, Azure DevOps through `az` with an explicit `--org`, implementation notes at the repo-root `implementation-design/<key>/`, reviews as one read-only agent with mandatory triage and a three-round severity gate, logs hand-written per the CLAUDE.md JSON schema into `.claude/skills/<skill>/logs/`, English everywhere, no references to other customers.

## 2. Removed on 2026-09-18

All skeleton helper scripts (`bin/`), adapters (`atlassian-access.md`, `agent-runtime-access.md`, `git-access.md`), `briefs/`, `schemas/`, `rubrics/`, `platforms/`, `coding-conventions.md`, the `.claude/plans` folder, the `architecture-overview` templates and the logs of other customers were removed from the pipeline. Every skill works from `customer.config.md`, `stack.config.md`, `customer.domain.md` and `testdata.config.md` alone. If a shared convention layer is wanted later, add a short `coding-conventions.md` with real rules and re-reference it from the review skills.

## 3. Missing inputs that block specific skills

| Missing | Blocks | Action |
|---|---|---|
| `pmd` binary and `platforms/salesforce/apex-rules.xml` | PMD gate in implement-us, promote-us, code-review (currently `unchecked`) | `brew install pmd`; copy the PMD Apex quickstart ruleset, tune priorities |
| `npm install` in the main repo | Prettier and ESLint gates | run once per checkout |
| `sfdx-git-delta` plugin | package generation in promote-us | `sf plugins install sfdx-git-delta`, or accept the manual package.xml fallback |
| `customers/reemtsma/init-sandbox.config.md` | init-sandbox | run the skill once, it writes the skeleton; fill it |
| `## Knowledge Articles` in `stack.config.md` | knowledge-article upload in document | add object, details field, record type, style article numbers |
| `business/input/<epic-id>/` folder | create-us transcript mode | create when the first transcript arrives |
| `Components`, `Confluence Space Key`, `Confluence Parent Page`, `Architecture Page Title`, `Release Notes Language`, `Date Format` in `config.md` | create-us component, Confluence publishing, release notes | fill the placeholders |
| `Review Runtime`, `Quality Gate Score` in `config.md` | nothing today | leave empty or remove the rows |
| API Reference base URLs and endpoint lists in `config.md` | document-api | fill before the first regeneration |
| Azure DevOps authentication | every Azure skill | `az login` per session, or `az devops login --organization https://dev.azure.com/lanespot` once with a PAT (stored per organisation, does not collide with other clients) |

## 4. Content debt in the configuration

- `customer.domain.md` describes a four-tier Bronze/Silver/Gold/Platinum loyalty model with different thresholds and login points. The org has Fan/Newcomer/Rockstar and Connaisseur/Expert/Virtuose at 750/1,500. Run `/build-knowledge loyalty --update-domain` with `documentation/loyalty-programme.html` as input to correct it.
- `testdata.config.md` presets reference API v59; classes are on 64. Harmless, but align when presets are next touched.
- `stack.config.md` still says API version 59.0 in the header while touched classes are 64.0; decide the target version once and put it in one place.

## 5. Skills that have not been exercised yet

Rewritten from text, not from a run. Run each once on a small case and fix what breaks:

| Skill | Suggested first run |
|---|---|
| `/design-us` | an existing small story, e.g. the NPS repeat-interval idea as a new story |
| `/implement-us` | the story designed above, with `--skip-deploy` first |
| `/promote-us` | AP2-1583 to UAT once PR 124 is merged |
| `/create-testdata` + `/cleanup-testdata` | `minimal-setup` preset on `reemUAT`, then clean by manifest |
| `/story-testdata` | AP2-1583 |
| `/build-knowledge` | `loyalty` — also fixes the domain file |
| `/document --type process --format html` | reproduce the loyalty page to validate the new type |
| `/code-review --scope story AP2-1583` | compare with the manual review of PR 124 |
| `/investigate-data-issue`, `/trace-field`, `/verify-deployed-state` | `Account.LatestInteraction__pc` on `reemProd`, read-only |
| `/org-review --modules licenses` | smallest module first |
| `/analyze`, `/create-us` | the webhook service (AP2-1572) as a fresh concept |
| `/init-sandbox` | writes the config skeleton only |
| `/improve-skills` | after five or more logs exist |

Skills exercised today and known to work: `/project-update`, `/review-pr` (with comment posting), `/document` for the loyalty page (run manually along the skill), `/commit` mechanics by hand.

## 6. Structural improvements worth doing

1. **One log writer.** Implement `bin/log-skill` and switch all skills back to it; the hand-written JSON blocks are the most repetitive part of every skill now.
2. **Shared review section.** review-pr, code-review, design-us, implement-us and analyze each carry a near-identical "dispatch one agent, triage, three rounds, verify against the branch" block. Move it into `briefs/review-loop.md` and reference it, so a change to the review rules happens once.
3. **Config placeholders as a check.** Add a step to `/help` (or a small script) that lists every `<...>` placeholder left in `customer.config.md` and `stack.config.md`, so missing inputs surface before a skill fails on them.
4. **Skill folder numbering.** Numbers no longer reflect the lifecycle (00, 01, 02, 03, 11, 22, 23, 26, 29–36). Either renumber once by lifecycle or drop the prefixes; `/help` already groups by lifecycle from a mapping.
5. **Deprecated forwarders.** `04-document-us` and `05-architecture-overview` can be deleted after one sprint; CLAUDE.md already points to `/document`.
6. **German vs English.** Documentation Language is English, UI Language German. The CLAUDE.md natural-language shortcuts and the `testdata.config.md` presets are still LottoBW-style German (Antrag Neueröffnung and so on). Replace the shortcut table with Reemtsma presets or remove it.
7. **Skill logs in the customer config repo.** Logs currently go to `.claude/skills/<skill>/logs/` inside the pipeline repo and are committed there. Moving them to `customers/reemtsma/logs/` (already gitignored) keeps the pipeline repo customer-neutral; CLAUDE.md and every skill's log path would change together.
8. **Test the commit skill** once with all three repositories dirty; it was rewritten but not run.

## 7. Open decisions from this week's work (not skill related)

- AP2-1584: batching versus bypass flag for mass loyalty changes; whether enjoyable must react to `BulkChangeCompleted` or a daily reconciliation suffices.
- AP2-1583: go-live date for the JPS switch; the PR review findings M1–M4 on PR 124.
- Group-3 (17,184) and 979-account restore lists exist as CSVs only; loading was never performed.
- Gauloises legacy tier records Bonvivant and Artiste: delete or align.

---
name: architecture-overview
description: "Deprecated — forwards to /08-document --type architecture. Generates a technical architecture and functionality overview as versioned Markdown"
argument-hint: "[confluence-space-key (optional)] (all /08-document arguments are accepted and passed through)"
preferred-runtime: claude-code
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

> **Runtime hint:** This skill prefers `claude-code`. If the active `Agent Runtime` (from `customer.config.md`) differs after applying any `## Skill Runtime Overrides`, print the standardized warning from `pipeline/agent-runtime-access.md` §1a and proceed.

## Deprecated — use `/08-document`

The architecture overview is one of four document types the merged documentation skill produces. This command still works and is scheduled for removal in the next major release.

**Two behaviour changes to be aware of when forwarding:**

- The overview now has a **version history** under the customer config repo instead of one dated file per run, so successive overviews form a single history rather than a pile of copies.
- Placing a copy in the customer-visible main repo is now an **explicit decision per run**, not automatic. The `Architecture` row under `## Folder Paths` in `customer.config.md` is the mirror target.

**Print this notice, then forward:**

```
⚠️  /11-architecture-overview is deprecated and will be removed in 3.0.0.
    Use: /08-document --type architecture
    Forwarding now — the overview is versioned, and the customer-visible copy is asked for.
```

Then run `/08-document` with `--type architecture` pre-set, passing every argument through unchanged (a positional space key becomes `--space-key`). Platform, template selection, documentation language, and the Confluence connection are resolved there from `customer.config.md` and `stack.config.md` exactly as before.

**Do not write an execution log here.** The forwarded run logs once, as `08-document` with `document_kind: architecture`. A second log entry would make the statistics skill count every run twice.

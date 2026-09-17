---
name: architecture-overview
description: "Deprecated — forwards to /document --type architecture. Generates a technical architecture and functionality overview of the repository"
argument-hint: "[confluence-space-key (optional)] (all /document arguments are passed through)"
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

## Deprecated — use `/document --type architecture`

The architecture overview is one of the four document types the documentation skill (`23-document`) produces. This command still works and only forwards.

Print this notice, then forward:

```
/architecture-overview is deprecated. Use: /document --type architecture
Forwarding now.
```

Then run the `23-document` skill with `--type architecture` and `--audience "developers & architects"` pre-set, passing every other argument through unchanged; a positional space key becomes `--space-key`. Platform, template, documentation language and the Confluence connection are resolved there from `customer.config.md` and `stack.config.md`.

Do not write a separate execution log here; the forwarded run logs once as `document` with `document_kind: architecture`.

---
name: document-us
description: Deprecated — forwards to /document --type epic. Documents an epic and all its linked user stories for a mixed business and technical readership
argument-hint: [epic-id]
---

> **On start, before any other output, print this line verbatim:**
> `🌐 Skill scope: Generic — pipeline skill, applies to all customers.`

This skill has been merged into `/document`. Run the document skill with type `epic`:

```
/document <epic-id> --type epic --audience "business and technical"
```

Steps: print the note *"`/document-us` is deprecated, running `/document --type epic`"*, then execute `.claude/skills/23-document/SKILL.md` with the epic key from `$ARGUMENTS`, type `epic`, and the audience above unless the user passes `--audience`. All storage, mirroring, Confluence publication and logging rules of the document skill apply; no separate log is written by this forwarder.

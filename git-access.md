# Git Strategy Adapter

> Resolves branch roles, PR gates and promotion mechanics for the customer's `Git Strategy` preset (`feature-branch` default, `gitflow`, `trunk-based`). Skills reference the sections below by number.

## §1 Strategy resolution
<!-- TODO: Git Strategy key in customer.config.md > ## Repository & CI/CD; VCS provider -->

## §2 Branch roles
<!-- TODO: roles feature / integration / release / trunk / hotfix and their meaning per preset -->

## §3 Fetch, pull and push commands
<!-- TODO: pull command per provider, CI skip pattern handling -->

## §4 Pull requests
### §4A PR-required gates
<!-- TODO: which role transitions require a completed PR per preset -->
### §4B PR status check
<!-- TODO: how to check completion per provider (az repos, gh, bitbucket API) -->
### §4C Open-PR command
<!-- TODO: command template per provider -->

## §5 Environment flow per preset
<!-- TODO: tables INT / UAT / PROD → source role → target role → pipeline stage; §5C gitflow back-merges -->

## §6 Tags and promotion (trunk-based)
<!-- TODO -->

## §7 resolve-branch-role(role, story-key, version)
<!-- TODO: branch name patterns from customer.config.md (Branch Pattern: Feature/Release/Production) -->

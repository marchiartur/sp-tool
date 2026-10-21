# Working on SP Tool 27

## Privacy: no personal contact details in the repo

Never commit a personal email address, phone number or other private contact detail, in any file, commit message or pull request. Git history is permanent once pushed, and this repository is public.

When something needs a way to reach the maintainer, link to GitHub instead:
- Security reports: the private advisory form, `https://github.com/marchiartur/sp-tool/security/advisories/new`
- Everything else: issues, or the maintainer's profile, `https://github.com/marchiartur`

Commits use the GitHub noreply address (`46831047+marchiartur@users.noreply.github.com`); keep it that way.

Before committing, check the staged changes: `git diff --cached | grep -iE "[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}"`. The only expected matches are noreply addresses and `noreply@anthropic.com` in co-author lines.

## When fut.gg changes

`src/futgg/page.ts` is the only file that knows how fut.gg builds a page. A redesign there
breaks the extension silently — nothing throws and no unit test fails, because the unit
tests run against fixtures we wrote.

`pnpm canary` renders real fut.gg pages with headless Chrome and runs those real selectors
over them. `.github/workflows/futgg-canary.yml` does the same once a day and opens an issue
labelled `futgg` when it stops passing. To fix one of those issues, start from the pages
that run actually saw rather than from a fresh render:

```sh
gh run download <run id> -n futgg-snapshots -D futgg-snapshots
pnpm test futgg/live
```

Then change `page.ts` until it passes, and add the new shape to `src/futgg/page.test.ts` so
the fixtures cover it too.

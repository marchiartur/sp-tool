# Contributing to SP Tool 27

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Ground rule: read-only

SP Tool 27 never buys, bids, lists or automates trading. Pull requests that add any of that won't be merged, even behind a setting. Automated trading breaks EA's terms and gets accounts banned.

## Reporting a bug

[Open a bug report](https://github.com/marchiartur/sp-tool/issues/new?template=bug_report.yml). EA and fut.gg change their sites often, so the most useful thing you can attach is a debugger report: run `pnpm dev:ext`, reproduce the bug, click **Copy bug report** in the debugger tab and paste it into the issue.

Report security problems through the [security policy](SECURITY.md), not a public issue.

## Making a change

```bash
git clone https://github.com/marchiartur/sp-tool.git
cd sp-tool
pnpm install
pnpm dev:ext   # dev browser with live reload and the debugger
```

The [README's Development section](../README.md#development) lists every command and explains the debugger.

Before opening a pull request:

1. `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm build:ext` all pass. CI runs them on every pull request.
2. Add tests for logic you change, next to the code in `src/`.
3. Add a line under an `## [Unreleased]` section at the top of `CHANGELOG.md` for anything a user would notice.
4. Keep each pull request to one change. Screenshots help for anything visual.

## Releasing (maintainers)

1. Bump `version` in `extension-static/manifest.json`.
2. Rename `## [Unreleased]` in `CHANGELOG.md` to `## [x.y.z] - YYYY-MM-DD`.
3. Commit, then push a tag: `git tag vx.y.z && git push origin vx.y.z`. The Release workflow builds the zip and publishes the release with that changelog section as its notes.

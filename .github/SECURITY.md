# Security Policy

## Supported versions

Only the [latest release](https://github.com/marchiartur/sp-tool/releases/latest) gets security fixes. Update to it before reporting.

## What counts as a security issue

SP Tool 27 asks only for the `storage` permission and runs only on `www.fut.gg` and the EA FC Web App on `www.ea.com`. It never buys, bids or lists, and it sends no data anywhere. Please report anything that breaks those promises, for example:

- A way for a web page to make the extension buy, bid, list or take any other action on your EA account
- A way for a page to read or change the extension's queue or settings, or run code with its permissions
- The extension sending data to any server, or loading code from one
- A release zip whose contents don't match what this repository builds

Bugs that don't affect security, such as a wrong price or a broken button after an EA update, belong in a normal [bug report](https://github.com/marchiartur/sp-tool/issues/new/choose).

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately with **[Report a vulnerability](https://github.com/marchiartur/sp-tool/security/advisories/new)** on the repository's Security tab. Only you and the maintainer can see the report.

Include the extension version (shown at `chrome://extensions`), your browser, and steps to reproduce.

You'll get a reply within 7 days. Once the issue is confirmed, a fix ships in a new release and the advisory is published with credit to you, unless you'd rather stay anonymous.

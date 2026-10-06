# Changelog

All notable changes to SP Tool 27 (Scouty Player 27). The newest release is at the top.
Each release's section here becomes its GitHub release notes and its entry on the site's changelog page.

## [1.0.0] - 2026-10-07

### Added
- **Open** button on every fut.gg player card: opens that player in the FC 27 Web App Transfer Market with Max Buy Now set from the fut.gg price.
- Shift+click **Open** to add a player to the queue without leaving fut.gg.
- **Queue team** button on fut.gg gallery pages: queues every player on the page.
- Queue panel in the Web App: Next / Prev, jump to any player, remove players, and adjust Max Buy Now with −/+ or by typing `2.6k` or `1.5m`.
- Connection banner that says when the Web App is loading, logged out, offline or changed by an EA update.
- One queue shared across tabs; only one Web App tab runs each search.

### Fixed
- Max Buy Now of 1,000,000 or more no longer silently skips the search.
- Shift+clicking several cards quickly no longer drops players from the queue.
- Only fut.gg's own player links get an Open button, and player links open without a referrer.

### Security
- Player data from fut.gg is checked and cleaned before it's saved to the queue, and queue changes are only accepted from fut.gg pages.
- The Web App side ignores malformed search requests from other scripts on the page.
- At most one Transfer Market search every 3 seconds, however fast you click Next.
- The extension only asks for access to the Web App's pages on www.ea.com, not the whole site.

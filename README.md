# SP Tool 27

**Scouty Player 27**: scout players on fut.gg, open them in the FC 27 Web App Transfer Market in one click, with Max Buy Now already set.

A free, open-source Chrome extension. Read-only: it never buys, bids or lists.

**Website:** [marchiartur.github.io/sp-tool](https://marchiartur.github.io/sp-tool/) · **What's new:** [CHANGELOG.md](CHANGELOG.md)

## What it does
- Adds an **Open** button to every player card on fut.gg. It opens that player in the Web App Transfer Market.
- Sets the **Max Buy Now** filter from the card's fut.gg price.
- **Queue team**: one click on a fut.gg gallery page queues every player in it. A panel in the Web App lets you step through them (Next / Prev, jump to any player, adjust Max Buy Now).

### Great for the FUT Gallery
FC 27's FUT Gallery records every player that passes through your club, and completing sets earns Gallery Tokens for Hall of FUT players. Open any Gallery set on fut.gg (club, league or rarity), click **Queue team**, and price-check every player in the Transfer Market one after another. Buying and selling stay manual.

## Install
1. Download **sp-tool-27-vX.Y.Z.zip** from the [latest release](https://github.com/marchiartur/sp-tool/releases/latest) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

Works in Chrome, Edge, Brave and other Chromium browsers. A Chrome Web Store listing is coming soon. To update, replace the folder with the new release and click the reload icon on the extension's card.

### Install from source
```bash
git clone https://github.com/marchiartur/sp-tool.git
cd sp-tool
pnpm install
pnpm build:ext
```
Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select the `extension/` folder in the project root.

## How to use
1. Open the [EA FC Web App](https://www.ea.com/ea-sports-fc/ultimate-team/web-app/) and log in.
2. On fut.gg, click **Open** on a player card (Shift+click adds it to the queue), or **Queue team** on a gallery page.
3. In the Web App, use the panel to search each player, adjust Max Buy Now, and move to the next one.

## Read-only by design
SP Tool 27 never buys, bids, lists or automates trading of any kind. It only fills in EA's own Transfer Market search screen. Every purchase is a manual click you make yourself.

## Disclaimer
This project is not affiliated with, endorsed by, or connected to Electronic Arts (EA), EA SPORTS FC, or fut.gg. All trademarks belong to their respective owners. Use at your own risk.

## Development
| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server for the website; the panel's states with sample data are at `/preview.html` |
| `pnpm build:ext` | Builds the extension into `extension/` |
| `pnpm build` | Type-checks and builds the website into `dist/` |
| `pnpm lint` | Runs oxlint |
| `pnpm test` | Runs the unit tests |

### Releasing
1. Bump `version` in `extension-static/manifest.json` and add a matching `## [1.0.1] - YYYY-MM-DD` section to `CHANGELOG.md`.
2. Commit, tag and push both together: `git tag v1.0.1 && git push origin main v1.0.1`.

The release workflow checks the tag, manifest and changelog agree, then attaches `sp-tool-27-v1.0.1.zip` to a GitHub Release with that changelog section as its notes. The site workflow redeploys the website, whose download buttons and changelog page follow the manifest version and `CHANGELOG.md`.

## License
[MIT](LICENSE)

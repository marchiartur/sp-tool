# SP Tool 27

Chrome extension that opens players from fut.gg galleries in the EA FC Web App Transfer Market, with Max Buy Now already set.

## What it does
- Adds an **Open** button to every player card on fut.gg. It opens that player in the Web App Transfer Market.
- Sets the **Max Buy Now** filter from the card's fut.gg price.
- **Queue team**: one click on a fut.gg gallery page queues every player in it. A panel in the Web App lets you step through them (Next / Prev, jump to any player, adjust Max Buy Now).

![demo](docs/demo.gif)

## Install from source
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
| `pnpm dev` | Dev server with the panel UI and sample data (no extension needed) |
| `pnpm build:ext` | Builds the extension into `extension/` |
| `pnpm build` | Type-checks and builds the UI preview |
| `pnpm lint` | Runs oxlint |

## License
[MIT](LICENSE)

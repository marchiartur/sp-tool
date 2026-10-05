# Player Finder

Queue players from a fut.gg gallery and open each one in the EA FC Web App
Transfer Market, with Max Buy Now already set from the card price.

**Read-only by design.** It never buys, bids or lists, and makes no network
requests. It opens EA's own search screen; anything you buy, you buy yourself.

## Features
- **Queue team**: one click on a fut.gg gallery page queues every player.
- **Open** on any card (Shift+click adds it to the queue).
- Web App panel: adjust Max Buy Now, Next / Prev, jump to any player.
- Handles Web App loading, logged out, offline and EA updates gracefully.

## Install (from source)
```bash
npm install
npm run build:ext
```
Then open `chrome://extensions`, turn on **Developer mode**, click
**Load unpacked** and pick the `extension/` folder.

## Develop
- `npm run preview:ui`: the panel in a browser with sample data (no extension needed).
- `npm run build:ext`: builds the extension into `extension/`.

| Path | What it is |
| --- | --- |
| `src/panel/` | The panel UI (React + shadcn/ui), shared by preview and extension |
| `src/extension/` | Mounts the panel in a Shadow DOM inside the Web App |
| `extension-static/futgg.js` | fut.gg buttons (Open, Queue team) |
| `extension-static/background.js` | Queue storage, picks one Web App tab |
| `extension-static/ea-main.js` | Opens EA's results screen, reports Web App health |

## Disclaimer
Not affiliated with, endorsed by or sponsored by Electronic Arts or fut.gg.
EA SPORTS FC and Ultimate Team are trademarks of Electronic Arts Inc.
EA's rules discourage third-party extensions on the Web App; use at your own risk.

## License
MIT

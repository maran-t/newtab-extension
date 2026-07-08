# New Tab

A minimal, chronograph-inspired new-tab page for Chrome. Helps you focus on your productivity without distraction.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/new-tab/bmheicpcdmfddlhkfdjapkhnlnhopfle)

## Features

- **Live clock** — large thin-weight time display with a running millisecond counter, plus the date and a time-of-day greeting.
- **Year progress** — 52 hairline week ticks under the clock: past weeks in ink, the current week pulsing in red, with a live percentage of the year elapsed.
- **Dynamic shortcuts** — the dock on the right seeds itself from your most-visited sites (the same shortcuts Chrome's default new tab shows). Add more from your bookmarks and history, or paste any URL; remove any shortcut on hover. Your dock is saved locally.
- **Light & dark themes** — follows your system preference, with a manual toggle (bottom-left) that persists.
- **Motion** — staggered entrance choreography, a trailing two-part custom cursor, slide-out labels on the dock, and an on-theme launch transition when opening a shortcut. All animation respects `prefers-reduced-motion`.

## Permissions

| Permission | Why |
|---|---|
| `topSites` | Seed the default shortcuts from your most-visited sites |
| `bookmarks` | Search your bookmarks in the add-shortcut panel |
| `history` | Search your browsing history in the add-shortcut panel |
| `favicon` | Show real site icons via Chrome's built-in favicon service |
| `storage` | Save your customized shortcut dock |

Everything stays on your machine — the extension has no backend and sends no data anywhere. If Chrome's favicon cache has no icon for a site, the icon is fetched from Google's public favicon service as a fallback.

## Install from source

1. Clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Open a new tab.

## Development

Plain HTML/CSS/JS — no build step. `index.html` is the new-tab page, `theme.js` applies the saved theme before first paint, `index.js` drives the clock, dock, and animations, and `style.css` holds the token-based light/dark design system.

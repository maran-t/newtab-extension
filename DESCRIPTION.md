# Chrome Web Store Listing

## Summary (132 characters max)

A minimal new tab with a live clock, focus timer, year progress, and your most-visited shortcuts. No clutter, no tracking.

## Description

New Tab replaces Chrome's start page with a calm, watchface-inspired dashboard that helps you focus.

A large, precise clock with a live millisecond counter sits at the center, with today's date and a time-of-day greeting. Beneath it, 52 hairline ticks map the year's progress — and you can pin one date that matters ("Launch in 127 days") as a countdown and a marker on the timeline.

Press the stopwatch beside the clock to start a focus session: 15, 25, 45, or 60 minutes. The countdown takes over the display, the tab title shows time remaining, and a quiet "Time." screen marks the end — a running session even survives closing the tab.

A tidy dock on the right seeds itself from your most-visited sites; add more from bookmarks, history, or any URL, capped at eight so it stays a launcher.

Light and dark themes follow your system, animations are smooth and respect reduced-motion, and everything runs locally — no accounts, no analytics, no tracking. Permissions only surface your own data on your own new tab.

Open source: https://github.com/maran-t/newtab-extension

## Permission justifications

| Permission | Justification |
|---|---|
| `topSites` | Populate default dock shortcuts from the user's most-visited sites |
| `bookmarks` | Let the user search their bookmarks when adding a shortcut |
| `history` | Let the user search their history when adding a shortcut |
| `favicon` | Display site icons for shortcuts via Chrome's favicon service |
| `storage` | Persist the user's shortcuts, target date, and running focus session |

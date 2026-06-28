# Assets

## Hero portraits (`heroes/`)

Drop square PNG or WebP files here, named `{hero-id}.png`, e.g. `reinhardt.png`,
`junker-queen.png`, `soldier-76.png`. Hero IDs are listed in
`src/data/heroes.json` under the `id` field.

When a portrait file is missing, the app falls back to (in order):
1. A user-uploaded portrait stored in IndexedDB (use the in-app **Admin** tab)
2. A placeholder showing the hero's initials

## App icons

Place the following icon files here so the PWA can install:

- `icon-192.png` — 192×192 PNG
- `icon-512.png` — 512×512 PNG (also used as Android adaptive maskable icon)

Until you add them, the app still runs in the browser; only the install prompt
will be missing the proper icon.

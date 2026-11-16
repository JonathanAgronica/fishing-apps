# Mac's Yak 🛶

A mobile-first PWA for **kayak fishing on the Bundaberg coast**: a green/amber/red "is it too rough?" light for each of your kayak days, hour-by-hour weather, waves, tides and bite times, a paddle planner, a safety check-in and a catch log. It is the fourth app alongside Mac's Jacks, Mac's Marlin and Mac's Crabs.

**Live:** https://jonathanagronica.github.io/fishing-apps/yak/
Source: `src/yak/` in this repo. `python3 src/yak/build.py` builds into `/yak/`.

## Tabs
- **Days**: a 14-day light strip, plus a card for each chosen kayak day (e.g. Tue + Thu). Each card shows wind, gusts, waves, rain, temperature, UV, sunrise and sunset, the best green window and the best fishing inside it, a wind-turn warning with a "head back by" time, tides, moon and solunar times, and water quality (Mac's Jacks flood state, recent rain, and stinger season).
- **Hours**: the hourly table with the reason for each light.
- **Fishing**: major and minor solunar periods, moon, tides, a bite score per hour, and *Plan my session* (fish blocks plus 🧃 **Yak time** breaks; this is Mac's Jacks "tinny time" renamed).
- **Trip**: the paddle planner. Pick a target spot on the map and the app works out leave, fish and return times from distance, paddle speed (3.5 kn), tidal current and wind. The **safety check-in** lets you set a return time and an emergency contact. It reminds you when you're due, then prompts you to share your GPS position or SMS your contact. It only sends when you tap.
- **Log**: the yak catch log. Blank sessions count. The predicted score, tide stage, solunar, light, wind and the light colour are attached to each session. After 5 sessions (at least 6 h and 3 fish) your log nudges the bite score by up to ±15%.
- **Setup**: kayak days, launch spot (a preset or a map pin), water type, which way the shore faces (for the offshore-wind check), session hours, thresholds, alerts, safety notes and sources.

## Traffic light defaults (editable)
| | Green | Amber | Red |
|---|---|---|---|
| Wind (avg) | < 10 kn | 10–15 kn | > 15 kn, or ≥ 26 kn (BOM strong-wind level) |
| Gusts | < 15 kn | 15–20 kn | > 20 kn |
| Waves (open coast and mouths only) | < 0.8 m | 0.8–1.2 m | > 1.2 m |
| Offshore wind | limits × 0.7 | | |
| Storms | | unstable air + showers | thunderstorm (WMO code 95–99) |
| Rain / visibility | | ≥ 2 mm/h, ≥ 60 % showers, < 2 km | |

A day is **green** when there is a run of at least 2 green daylight hours inside your session hours (default 5am–12pm). It is **amber** when the best run is green or amber, and **red** otherwise.

Sources:
- BOM water sports safety: novices < 10 kn, advanced ≤ 20 kn, novice waves < 0.5 m.
- BOM boating safety: winds > 15 kn are unsuitable for small vessels, and gusts can be 40% stronger.
- BOM wind warnings: strong wind 26–33 kn, gale 34–47 kn.
- Paddle Australia Sea Guide: below 26 kn, seas and surf ≤ 1 m.
- Australian Canoeing Sit-on-Top Coastal Guide: < 17 kn, within 1 nm.
- MSQ bar crossings.
- qld.gov.au and SLSQ stinger season (Nov–May).

## Data
- Open-Meteo forecast and Marine APIs (keyless, CC-BY 4.0), fetched by the phone. The phone keeps the last forecast for offline use.
- Tides use Mac's Jacks base-port harmonics (`data/ports.json`, MSQ, CC-BY 4.0).
- Sun, moon and solunar times come from Mac's Jacks code (`src/astro.js`).
- Flood state comes from `/fishing-apps/data/flood_state.json` (Mac's Jacks hourly updater). There is **no updater** for this app.
- BOM warnings are not read automatically. The app links to them and treats strong-wind-level winds and thunderstorms as red.

## Alerts
- **In-app**: when the app is opened (or comes back to the foreground), it notifies once for today's kayak day (before 11am) and once for tomorrow's (after 2pm).
- **Background**: on Android Chrome with the app installed, Periodic Background Sync (`yak-check`, every 6 h or more) runs the same check from the service worker. iPhone has no background sync, so alerts there only come when the app is opened.
- **Server-side routine** (reliable on any phone): run `node src/yak/tools/yak_brief.mjs --spot <preset id | "lat,lng"> [--exp open|mouth|estuary] [--facing 90] --days tue,thu --when tomorrow [--json]`. It prints the plain-English message.
  - Preset ids: burnett-heads, bargara, elliott-heads, moore-park, burnett-town, kolan, baffle, elliott-river, theodolite, woodgate, burrum-heads.
  - Do not commit personal spots. Pass them on the command line only.

## Privacy
There are no accounts, analytics or keys. The launch, targets, emergency contact, GPS fixes, catch log and settings stay in localStorage, with a settings copy in Cache Storage for the service worker. Nothing personal is committed.

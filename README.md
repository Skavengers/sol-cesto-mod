# Sol Cesto – Pac-Man mod (+ mod loader)

A fan-made mod for [Sol Cesto](https://store.steampowered.com/app/2738490/Sol_Cesto/) that adds **Pac-Man as a new playable hero**, plus a small mod loader that other mods can use.

> This repository contains **no game files**. You need your own copy of Sol Cesto (Steam).
> Not affiliated with or endorsed by the developers or publishers of Sol Cesto, or by the owners of Pac-Man.

## The hero

| | |
|---|---|
| Health / Strength / Magic | 5 / 2 / 1 |
| Starting item | Potion (inventory: 2 slots) |
| **Power – Super Pac-Gomme** (recharges in 4 actions) | All monsters get scared and lose 1 power. |
| **Talent – Glouton** | Defeating a monster has a 25% chance to restore 1 HP. |

Pac-Man has his own hub figure, portrait, full set of in-game animations, shop arm and hand, death fall, and death sound.

## Install (Windows)

1. Download this repository (green **Code** button → **Download ZIP**) and unzip it.
2. Put the unzipped folder **inside your Sol Cesto folder**
   (Steam → right-click Sol Cesto → *Manage* → *Browse local files*).
3. Run **`install.bat`**.
4. Start the game with **`Play with mods.bat`** (in the Sol Cesto folder). Steam's normal *Play* button still starts the unmodded game.

In the hub, Pac-Man stands near the mine entrance.

**Uninstall:** run `uninstall.ps1` (right-click → *Run with PowerShell*).
**After a game update:** run `install.bat` again.

### What the installer does

- Unpacks the game's own `package.zip` into a `package` folder (once).
- Copies `modloader.js` and `mods/` into it.
- Adds one line to `package/index.html` to load the mod loader (the original is kept as `index.original.html`).
- Writes `steam_appid.txt` so Steam features keep working, and creates the `Play with mods.bat` launcher.

Your save is shared with the unmodded game. Back it up first if you care about it: `%LOCALAPPDATA%\SolCesto\User Data`.

## For modders

`modloader.js` loads every `mods/*.js` file and exposes `window.SolCestoMods`:

- `onStartup(runtime => …)`: get the Construct 3 runtime (`runtime.objects`, `runtime.globalVars`, `runtime.callFunction(...)`).
- `patchJson("tableau_persos.json", data => …)`: edit the game's data tables while they load, without touching the files.
- `images.swapFrames([...])` / `images.restore()`: replace sprite frames (reversibly).
- `log(...)` / `history`: logging.

See `mods/pacman.js` for a complete example (new hero, data tables, art, power, talent).

The Pac-Man art lives in `mods/pacman/sources/`. `build_images.py` (needs `pip install pillow`) turns it into the PNGs used in game. Run it from the installed copy (`package/mods/pacman/sources/`), because it reads frame sizes from the game's `data.json`.

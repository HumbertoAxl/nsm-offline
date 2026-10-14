# NSM Offline

Personal browser adaptation and reverse-engineering workspace for New Star Manager. This is a separate project from NSS Offline.

## Current result

The browser prototype executes original Monkey-generated DEX game instructions through a JavaScript VM/JIT and a new GLES 2 to WebGL adapter. It retains original UI scripts, GLSL shaders, models, animations, career rules and competition data. It does not emulate Android.

Original title screen, 3D stadium/home, assistant, training pitch and players render in a real browser. Passing, passing into space, drawing teammate runs and passing to paths have been tested through browser input. Full-match and long-term career validation are still in progress; see [implementation notes](analysis/BROWSER_PORT.md).

## Run locally

Install Node.js, open the `web` directory and run:

```sh
npm run dev
```

On Windows, double-click `run.cmd` in the project root instead. The static server listens on `0.0.0.0:4174`. Open `http://localhost:4174/` on the computer, or `http://<computer-LAN-IP>:4174/` on a phone connected to the same local network. This project uses a separate port and save namespace from NSS.

Initial startup loads and compiles substantial original resources. Tap Play, then the original TAP TO START button. Use landscape orientation for the game.

Progress is stored in the current browser/origin and mirrored to IndexedDB. Use Options to export a complete backup before changing devices, browsers or hosting addresses. A restore replaces NSM progress files and preserves the NSS namespace. Original cloud, advertising and store SDK startup is disabled.

For hosting, serve the complete `web/dist` directory as static files. No Android emulator or game backend is required. The committed runtime includes the resources needed to run without rebuilding from the APK.

## Validate and rebuild resources

```sh
cd web
npm test
npm run probe -- 30 --tap-start --after-tap-frames=50
npm run build:assets
```

The probe uses a fake GPU and validates original logic/native dispatch, not visible rendering. Asset preparation reads `new-star-manager.apk` and the exported `analysis/game-dex.json`. Existing shared runtime snapshots are preserved. `--refresh-shared` explicitly refreshes those modules from the sibling NSS workspace and may require revalidation. The running browser does not depend on that sibling project.

## Artifact

- Package: `uk.fiveaces.nsfc`
- Version: `1.7.7`, version code `57`, confirmed from the binary manifest
- File: `new-star-manager.apk` (98,242,140 bytes)
- SHA-256: `4dad26518d7214df383601b2d20e7f6a60d10cf107339a0ae59afe973d163bb0`
- Downloaded on October 11, 2026 from APKPure's public package download endpoint; see `analysis/runtime-comparison.json` for provenance.
- ZIP CRC integrity passed. The signing certificate and APK signing blocks were not independently authenticated.

## Investigation outputs

- [Feasibility assessment](analysis/FEASIBILITY.md)
- [APK identity](analysis/apk-identity.json)
- [Runtime comparison](analysis/runtime-comparison.json)
- [REA artifact evidence](analysis/rea-artifact-evidence.json)
- `analysis/extracted/`: resources and all four original DEX files
- `analysis/decompiled/sources/uk/fiveaces/nsfc/`: JADX output for the DEX containing the game
- `analysis/game-dex.json`: original game-package bytecode exported in the NSS VM data format
- `analysis/jadx.log`: diagnostics, including 77 decompilation errors

REA 6.4.0 supplied the artifact graph and retained Evidence. Its Android provider requires a separately supplied headless JADX MCP JAR that is not present, so code inspection used the already available JADX 1.5.6 CLI. Provider diagnostics are retained alongside the successful Evidence; no agent configuration was changed.

## Reproduce static checks

With Python 3.10 or newer:

```sh
python scripts/inspect_identity.py
python scripts/analyze_runtime.py
```

The comparison script reads the sibling `NSS Reverse Engineering` project. `scripts/dex_exporter.py` is its copied parser helper; use it through the comparison script rather than running its original exporter entry point. Neither command launches the Android game.

For REA's archive inspection, using a Node version supported by REA:

```sh
npx -y rea-agents@6.4.0 inspect-artifact new-star-manager.apk --json > analysis/rea-artifact-evidence.json
```

## Sources

- [New Star Games: New Star Manager](https://www.newstargames.com/new-star-manager)
- [Official Android listing](https://play.google.com/store/apps/details?id=uk.fiveaces.nsfc)
- [Publisher's Steam listing](https://store.steampowered.com/app/883130/New_Star_Manager/)
- [REA repository](https://github.com/morluto/rea)
- [REA investigation skill](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md)


### iPhone without browser toolbars

In Safari or Chrome, choose **Share -> Add to Home Screen**, enable **Open as Web App** when offered, and launch from the icon. If Brave does not provide this action, use Safari or Chrome for installation. Export progress before changing browser or launch context, then restore the backup if needed. NSM uses landscape orientation and safe-area sizing. **Options -> Full screen** requests the browser Fullscreen API where supported and otherwise shows installation instructions. Offline caching requires HTTPS or localhost.

## Netlify deployment

The production address is https://nsm-on-browser.netlify.app/.

Connect this repository to Netlify and select `main` as the production branch. The root `netlify.toml` runs the runtime regression tests and publishes `web/dist`. No asset rebuild, private APK download, environment variables or backend are required for deployment. Pushes to `main` trigger a new deployment after the repository connection is configured.

Progress belongs to the browser and the site's origin. Export a backup from your old local address before moving to the hosted address, then restore it through Options. Hosting does not automatically transfer or synchronize saves between devices. Use **Download for offline play** to cache resources while online; keep a separate exported backup of your progress.

## Repository contents

Runtime modules, bundled browser resources, tests, build helpers and English investigation notes are included. The original APK, decompiled source tree, local logs, temporary tools and personal/test progress backups are excluded. Original game content and available in-game languages are preserved.

## Performance investigation

See [performance findings and alternatives](analysis/PERFORMANCE.md) for the WebAssembly assessment, binary resource loading, scalar-register JIT changes and measurement limits. Repack resources with `node web/tools/pack-assets.mjs`; run the decoding benchmark with `node web/tools/bench-loading.mjs`. Both local serving and Netlify declare gzip encoding for the compressed binary resource pack.

## Phone display and trial texture fixes

Landscape uses the available viewport's native aspect ratio, with bounded device-pixel rendering and WebGL antialiasing where supported. See [trial and display validation](analysis/TRIAL_AND_DISPLAY.md) for the repaired temporary 3D texture ownership paths, memory limits and phone confirmation still required. After updating, reopen the Home Screen app online and download offline resources again if you use offline mode.

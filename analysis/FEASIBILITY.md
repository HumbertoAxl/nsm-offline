# Browser adaptation feasibility

Historical static assessment, written before the browser implementation. For current behavior and validation, see [STATUS.md](STATUS.md) and [BROWSER_PORT.md](BROWSER_PORT.md).

## Conclusion

A browser adaptation using original DEX code is a credible direction, but is not yet demonstrated. NSM belongs to the same Monkey-generated Java family as NSS. It does not require translating a bundled ARM engine. The work is substantially broader than renaming the package or swapping assets: NSM uses programmable OpenGL ES 2.0 and real 3D content, including in its interface.

This assessment is based on static artifacts and decompilation, not gameplay execution.

## Scope and evidence ledger

| Question | Result | Evidence |
|---|---|---|
| Obtain and identify the target | Answered: Android 1.7.7 (57), package uk.fiveaces.nsfc | APK manifest; apk-identity.json; downloaded file hash |
| Same general architecture as NSS? | Answered: MonkeyGame entry point, game-package Java/DEX, no bundled .so libraries | classes4.dex; MonkeyGame.java; bb_.java; APK member inventory |
| Reuse existing DEX execution? | Plausible, not validated by execution | Both packages exported with the same parser; runtime-comparison.json |
| Reuse graphics unchanged? | No | c_Shader.java; bb_ogles2rend.java; bb_opengl_gles20.java; comparison with NSS gl-host.js |
| Keep original model parsing? | Plausible | c_StaticModel.p_Load and c_AnimModel.p_Load are available in DEX |
| Local persistence? | Plausible with new namespacing and save validation | c_GameSave.java uses SaveState2/LoadState2 and monkeystate files |
| Offline services and store behavior? | Partially answered: original integration points identified, not modified or tested | Cloud setup URL in bb_.java; billing/ad declarations; SocialHub classes |
| Playable on an iPhone browser? | Unresolved | Needs a running browser proof of concept and physical-device tests |

## Reusable foundation

The NSM game package contains 3,676 class definitions and 24,033 declared methods, of which 23,383 have DEX bytecode. The NSS export contains 2,747 classes and 15,439 methods. There are 1,830 matching simple class names; matching names are clues rather than proof of matching behavior.

No game-package methods are declared native and the APK contains no .so members. Calls into Android/system libraries still require a browser host implementation. Both projects expose familiar BBGame/BBAndroidGame, data buffers, file streams, Monkey-generated collection classes, Gel UI, Tweaks, and string-based persistence.

NSM contains familiar `.uis`/`.uih` interfaces, Spine `.spinary` assets and readable club/competition data. Their schemas support adapting existing inspection tools. Similar layouts do not make the databases or game rules interchangeable.

## Main engineering difference

`c_Shader.java` compiles vertex and fragment shader sources, binds attributes, links programs and queries uniforms through Android GLES20. `bb_ogles2rend.java` drives drawing, depth, culling, texture binding and renderer state. The NSS bridge translates an older graphics interface using its own fixed shader program; it does not expose this full programmable API.

NSM has 654 static `.3DM` models, four `.3DA` animation assets, custom curves/rig data, 50 GLSL files and a dedicated texture directory. These are custom formats, not formats identified solely by their filename extensions. Original DEX loaders should be retained where possible instead of reimplementing their file formats blindly.

The 3D requirements occur before matches: `NewGUI/Screens/cardprep.uis` embeds cameras, shader selection and head/clothing models. `CamAnim.uih` uses camera curves and LookAt operations. Ignoring 3D calls would produce incomplete menus as well as broken matches.

The renderer adapter needs verified handling of shader programs, attributes, uniforms, vertex/index buffers, texture units, depth/culling and framebuffer/renderbuffer operations. GLES2 and WebGL are related APIs, which makes mapping plausible; Android overloads, buffer semantics, GL object handles and engine-specific wrappers still need explicit tests.

## Saves and services

`c_GameSave` stores global state and career files through `bb_app.g_SaveState2` and loads them through `g_LoadState2`. Current careers have up to 16 data segments plus timestamp records and a legacy single-file compatibility path. Browser persistence should preserve these routines and all associated files, with a distinct NSM storage namespace and backup format.

The APK still declares billing, ads and network services. `bb_.bbInit` configures the original publisher's Manager cloud endpoint. These paths can be replaced with explicit local behavior following the NSS pattern, but the exact Manager store/card/economy routines have not been modified or validated. No free-purchase behavior has been implemented in this investigation.

## Mobile performance

The extracted Monkey resource set is approximately 131 MB, compared with approximately 85 MB in NSS. Compressed download sizes do not measure runtime memory. Decoded atlases, textures, geometry and temporary buffers must be loaded and released deliberately. Timing, allocation rates and rendering cost must be measured in actual menu and match scenarios; static inspection cannot guarantee iPhone performance.

## Tool provenance and limits

Successful REA `inspect_artifact` Evidence:

`ev_132daa111a2999116f1011c5486eb145fce12a7d34373ddfd0d0e286d6130e74`

Artifact digest:

`4dad26518d7214df383601b2d20e7f6a60d10cf107339a0ae59afe973d163bb0`

The REA artifact graph is an archive observation, not code execution. The Android code provider is unavailable without a supplied `jadx-headless-mcp` 0.7.1 JAR. Code observations came from the existing JADX CLI and original DEX metadata. JADX reported 77 errors; readable Java output is incomplete and is not a trustworthy recompilable source tree. Original bytecode remains available for execution-oriented work.

The manifest declares a required density split. The downloaded base package contains the inspected game assets, but complete Android installation and split-resource coverage have not been checked. The APK signing certificate/blocks have not been independently authenticated.

No original game code was executed on Android or in a browser. Network traffic, resource lifetimes, deterministic game behavior and working saves remain runtime validation tasks.

## Suggested next proof of concept

1. Make an isolated NSM host with the correct package namespace and local storage, using the exported bytecode and original resources.
2. Implement the smallest GLES20/WebGL bridge needed to compile one original shader and draw an original static model correctly.
3. Reach the original main menu and render a player portrait. Preserve loaders, UI and original gameplay code wherever possible.
4. Create and reload one career with every save segment intact, then enter a scripted training/match chance.
5. Validate touch input, audio, browser pause/resume, memory and frame timing on the target iPhone.
6. Only after this foundation works, adapt original cloud/store/ad services and optional gameplay rules through scoped overrides.

A successful menu/model proof would reduce the main graphics uncertainty. It would not yet establish a complete playable port.


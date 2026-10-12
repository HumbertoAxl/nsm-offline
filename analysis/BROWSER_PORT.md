# Browser implementation notes

## Runtime architecture

The browser executes original Monkey-generated game-package DEX through a JavaScript interpreter/JIT. A Java/Android boundary implements strings, buffers, file streams, input, audio and local persistence. A GLES2/WebGL bridge preserves original shaders, models, animations and draw ordering. The shipped runtime is self-contained; the sibling NSS project is only an optional source when explicitly refreshing shared modules during resource preparation.

Original cloud, advertising and store SDK startup is disabled. Configuration and resource lookup use bundled data. Store/card economy changes have not been established as complete. No Android emulator or backend is required.

## Startup and input

The first three original update/render cycles run in their original order with browser painting opportunities between phases. The loading screen stays visible until these cycles finish. Subsequent frames use the normal animation loop. Guarded JIT string access avoids temporary host argument arrays for primitive String.length and String.charAt calls; overrides and unsupported receivers retain normal dispatch.

Play, Options and Close activate on primary touch/pen pointerdown. Synthesized clicks are suppressed to avoid duplicate actions; mouse and keyboard clicks remain available. Audio activation failures are handled independently of game startup. These changes resolved the startup failure reported on the user's physical iPhone. The temporary bottom debug panel and startup-report endpoint have been removed.

## Persistence and offline use

Original save routines write named NSM files into browser storage, mirrored to IndexedDB. Backups export every NSM entry and validate restores before replacement, with rollback on failure. NSS storage is separate.

Forced career checkpoints require the original club/competition validator to pass and a match not to be in progress. The tutorial can create an incomplete temporary club, so global preferences may be the only valid early checkpoint. This guard prevents newly forced invalid career files; it does not repair already invalid saves. Valid completed-career resume still needs broader verification.

Offline downloads are explicit and transactional: an incomplete download cannot replace an existing complete cache. Service workers require HTTPS or localhost. LAN HTTP requires the local server to stay running. Offline title startup was verified after stopping the development server.

Progress belongs to an origin and browser. Export it before switching from a LAN address to Netlify or another browser, then restore it at the new address. No cloud synchronization is implemented.

## Graphics ownership and performance

The adapter converts only the requested byte span of reserved NIO buffers. An isolated byte-identical upload benchmark improved from 1,024 ms to 15 ms for 500 uploads; this does not measure overall frame rate.

Temporary bitmap surfaces release registry entries and bound references on disposal. Program deletion clears uniform caches. Discard releases CPU bitmap data while Invalidate retains data for re-upload. Shared decoded images remain valid. Font atlas replacement and shutdown release only the renderer-owned image through original discard semantics.

Tests repeat 1,000 bitmap disposal, texture deletion, program rebuild and original font shutdown/discard cycles without retaining the tested temporary resources. This verifies specific ownership paths, not the absence of every possible long-session leak.

The animation loop executes at most one original update per presented frame and avoids catch-up bursts. Frame diagnostics use a fixed 120-entry ring and publish bounded CPU timing/resource counts. Reports are exported locally through Options. No report is uploaded automatically, and Safari may not expose heap measurements.

A desktop steady-screen observation from frame 780 through 6,180 held 476 GL objects and 120 registered surfaces. This is not a transition, match or physical-phone benchmark. Further performance changes were deferred at the user's request pending a computer restart.

## Presentation

The manifest, Apple web-app metadata and safe-area sizing support landscape Home Screen launch. Use Share, Add to Home Screen and Open as Web App where offered, then launch from the icon. Options can request the Fullscreen API where supported or display installation guidance. Desktop fullscreen entry and exit were verified; physical iPhone Home Screen installation still needs confirmation.

## Validation and remaining limits

Real browser inspection covered the title, stadium/home, assistant, training pitch and players, plus the passing and teammate-run tutorial interactions. The logic-only probe additionally completed dribbling and reached shooting. Its GPU is fake: it cannot validate visible rendering or actual shader compilation.

The regression suite covers startup, touch, audio failures, string JIT parity, save validation, backup rollback, service-worker cache behavior, GLES object ownership and font disposal. Original boot/first-update probes also pass. Full matches, long careers and valid career reload remain open validation work.

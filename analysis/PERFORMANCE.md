# Performance investigation and changes

Investigated on October 14, 2026. This report distinguishes local measurements from expected benefits and unverified phone behavior.

## Decision

Keep the working original-DEX browser runtime for this iteration. Remove measured startup conversion work and compiled register-array allocation first. WebAssembly GC / ahead-of-time compilation is the strongest candidate for a larger follow-up, but converting the runtime is not a drop-in library replacement and has not been proven faster for NSM.

## Findings and implementation

The old startup fetched an 84,628,271-byte JSON object containing Base64 resource data, parsed it and converted every byte through Uint8Array.from(atob(...), callback). The new indexed binary pack is 63,495,863 bytes, contains all 1,145 entries byte-for-byte, and exposes file views into one retained payload without copying every file. Its gzip transfer file is 20,580,779 bytes. Both local and Netlify serving explicitly declare Content-Encoding: gzip so the browser performs standard HTTP decompression before indexing the pack.

The 25% reduction compares uncompressed representations. The 20.6 MB transfer size must not be compared directly to the old 84.6 MB JSON as a network speedup: Netlify may compress that JSON too. Image/font downloads and the game's first original setup update still take time.

Three local Node 25.9.0 CPU-only decoding samples measured the old path at 3,474.5 / 3,561.6 / 3,494.7 ms, versus 25.85 / 26.75 / 25.92 ms for the binary index. The binary benchmark includes an input-buffer copy which browser fetch does not need. These numbers exclude network, HTTP decompression, image decode, game setup and GPU work; they are not iPhone startup times. Run `node web/tools/bench-loading.mjs` to reproduce.

The JIT previously created and zero-filled a register Array for each original DEX method invocation. It now emits local scalar registers in generated JavaScript. This removes that temporary allocation and allows the browser compiler to optimize locals. Unsupported methods retain interpreter fallback. The old compiled representation remains available for parity tests through `vm.scalarRegistersEnabled = false` before compiling methods.

Two instrumented fake-GPU observations after entering the same initial tutorial flow measured 67.07 ms and 56.04 ms per frame before/after the scalar change. These are preliminary observations, not a controlled FPS benchmark: instrumentation adds overhead, original animations/random choices can change workloads, and the fake GPU omits graphics cost. Do not claim a 16% phone speedup from them. The structural allocation reduction is independently verified.

Startup resource/ready durations are recorded in the existing bounded diagnostics object. No persistent visual debug panel, telemetry service or save-format migration was added. The original game, save routines, texture resolution and rendering order remain intact.

## Alternatives researched

| Approach | Fit for this project | Decision |
|---|---|---|
| TeaVM with WebAssembly GC | Compiles JVM class bytecode, not Android DEX. A potential pipeline is DEX-to-JAR conversion, Android boundary replacements and a TeaVM build. Original shaders/model loaders could be retained, but native calls, reflection/dynamic overrides and persistence need adaptation. | Most promising larger prototype; first prove one scene and compare actual phone CPU/frame timings. |
| CheerpJ | Runs Java SE applications in browsers with its own runtime. Does not supply our Android/GLES platform contract. | Not a demonstrated shortcut for NSM; adds another runtime and boundary migration. |
| Custom DEX-to-Wasm compiler / Binaryen | Can compile typed numerical code, but must preserve Java objects, strings, field storage, exceptions, class initialization, virtual dispatch and live overrides. | Consider whole hot subsystems, not per-operation JS/Wasm calls. A numerical kernel must win an end-to-end benchmark before shipping. |
| Web Workers / OffscreenCanvas | Moves work off the main thread and can improve responsiveness. Current fonts, audio gestures, keyboard, storage and graphics APIs share main-thread state. | Useful architectural follow-up, requiring explicit ownership/message contracts; moving a single heavy loop does not automatically increase game FPS. |
| Wasm threads / SIMD | Helpful for parallel or batched typed workloads. Emscripten pthreads require shared memory and cross-origin isolation; synchronous graphics/game state need careful design. | No blanket thread toggle. Adopt only after identifying a parallel workload and testing Safari compatibility. |
| WebGPU | Would require a new renderer/shader compatibility path. The current original GLES2 API already maps to WebGL. | Do not replace the working renderer without GPU evidence; it cannot remove DEX CPU dispatch/allocation costs. |
| Ahead-of-time JavaScript generation | Could move method translation from phone startup to build time and specialize dispatch/layout. | A practical next experiment alongside Wasm GC. Must retain override guards and interpreter fallback. |
| Deferred texture/resource loading | Could reduce startup/decoded-memory cost. Original resource requests are synchronous, including models and UI resources loaded on early updates. | Needs a dependency inventory and prefetch state machine; do not simply skip images and repeat texture regressions. |

## Research sources

Primary technical sources were used for implementation decisions:

- [TeaVM repository](https://github.com/konsoletyper/teavm) and [Wasm GC backend discussion](https://github.com/konsoletyper/teavm/discussions/963).
- [dex2jar](https://github.com/pxb1988/dex2jar): DEX-to-class/JAR tooling for an experimental TeaVM route.
- [CheerpJ](https://github.com/leaningtech/cheerpj-meta): Java SE browser runtime scope.
- [Binaryen](https://github.com/WebAssembly/binaryen): compiler/optimizer infrastructure and whole-module optimization.
- [WebKit Safari 18.2](https://webkit.org/blog/16301/webkit-features-in-safari-18-2/): WebAssembly GC and tail-call support.
- [WebKit JetStream 3](https://webkit.org/blog/17899/introducing-the-jetstream-3-benchmark-suite/): startup, GC and steady-state behavior must be evaluated together.
- [Emscripten pthreads](https://emscripten.org/docs/porting/pthreads.html): deployment requirements and main-thread limitations.
- [MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas): worker rendering API.

GitHub's monthly trending page and public Reddit/Hacker News searches were also checked for leads. Social reports about Wasm boundary overhead and disappointing small-kernel gains informed questions to investigate, not performance guarantees. Search crawl dates and popularity are not proof that a project is suitable or currently trending for this game. No turnkey DEX/Android/GLES replacement was demonstrated by this investigation.

## Validation and remaining work

Every bundled file is compared with the legacy decoded file. Invalid pack headers, index bounds, duplicate paths and unsafe paths are rejected. Scalar/array parity tests cover a backward conditional loop and wide arguments, and compiled budget enforcement/trace unwinding remain checked. The original logic-only tutorial reaches shooting, and real browser inspection verifies the original title graphics.

The complete regression suite must pass before publication. Physical iPhone responsiveness, complete matches, long careers and texture transitions still need real-device validation. The user can export an existing performance report through Options while reproducing a slow scene; improvements should then target its measured CPU/GPU boundary.

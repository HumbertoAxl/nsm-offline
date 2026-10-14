# Trial texture ownership and phone display

Updated October 14, 2026.

## Report and confirmed defects

The user reports that the Home Screen web app silently restarts when entering the first trial. A silent reload is consistent with browser process termination or memory pressure, but this has not been confirmed by an iPhone process log.

Two native 3D image loading paths allocated temporary gxtkSurface GPU handles and left those surfaces strongly referenced in the browser graphics registry. A focused reproduction of 1,000 LoadStaticTexImage calls retained 1,000 surfaces/objects before the fix and zero afterward.

LoadStaticTexImage now removes the temporary GPU registration before returning its CPU bitmap wrapper. Recycle releases only wrappers explicitly marked as temporary. Shared source images and renderer-owned live textures are preserved.

LoadImageData now removes its temporary GPU registration, transfers the readback array directly to the original DEX data buffer, and releases the temporary surface references. It does not retain a duplicate byte array or a discarded image surface in the graphics registry.

Immutable 2D image surfaces release their cached CPU RGBA readback after GPU upload. Their original decoded source remains available for re-upload. Edited surfaces are marked mutable and retain their modified pixels. Temporary readback canvases are reset after extracting ImageData. Texture conversion, premultiplication, padding and mipmap semantics remain those of the proven upload path.

A direct decoded-image upload experiment was rejected during real browser review because it caused missing title textures. It is not included in the final implementation.

## Phone display and graphics

Apple lists both the [iPhone 17 Pro Max](https://support.apple.com/en-us/125091) and [iPhone 18 Pro Max](https://www.apple.com/ie/iphone-18-pro/specs/) as 2868 by 1320 pixels. The app reads the actual available browser viewport rather than hardcoding a phone model, since browser bars, safe areas and standalone mode change the usable area.

Landscape canvas layout fills the safe available viewport at its native aspect ratio, rather than letterboxing everything to 16:9. The original game receives the actual render dimensions and handles its own layout and camera scaling. Touch input continues mapping the visible canvas rectangle to its render coordinates.

Render dimensions follow device pixel ratio up to 2x, with a 2.25-million-pixel budget. For a 956 by 440 CSS-pixel viewport and DPR 3, the buffer is 1912 by 880 instead of the old fixed 1280 by 720. This intentionally avoids allocating a full 2868 by 1320 buffer while addressing memory pressure. WebGL antialiasing is requested where supported. Original texture resolution is preserved; this cannot add detail absent from the original assets.

ResizeObserver updates the native boundary after viewport changes without repeatedly resetting an unchanged canvas. Portrait rotation emulation and changes to iOS system/browser bars are not part of this change.

## Validation

All 68 tests pass. New tests cover 1,000 temporary native bitmap loads, 1,000 native image readbacks, immutable versus modified pixels, Pro Max render sizing, bounded large displays and resizing without redundant canvas resets.

The original logic-only training probe reaches shooting. Its fake GPU does not validate visible graphics or complete match behavior.

Real browser review at a 956 by 440 viewport verified complete title textures, the 3D stadium, animated assistant, entry into the trial training pitch, a successful pass and advancement to the next instruction. Resizing back to the desktop viewport preserved the rendered scene. This is a desktop browser at phone dimensions, not a physical iPhone performance or memory measurement.

The original preload still loads all 290 image assets; their total uncompressed RGBA size is approximately 330 MiB. That estimate is not a measurement of the browser's decoded-image cache, GPU memory or process limit. Additional device-specific memory work may be needed if the silent reload persists.

Performance exports now include render size, device pixel ratio, actual WebGL antialiasing state and retained registered-surface CPU pixel bytes. Save namespaces and backup formats remain unchanged.

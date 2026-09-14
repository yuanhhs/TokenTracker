# Floating ball attribution

The floating ball uses the same default SVG geometry, animation engine, palette,
and gaze mapping as [PicBoard](https://github.com/lmy414/PicBoard).
The React wrapper and pointer interaction are adapted for TokenTracker's Windows host;
the image-board and image-intake features are not included.

- PicBoard: Copyright (c) 2026 lmy414, MIT; see `LICENSE.PicBoard`.
- bloub: Copyright (c) 2026 Jérémy Perret, MIT; see `bloub/LICENSE` and `bloub/NOTICE.md`.

Both licenses are also included in the built dashboard under `licenses/`.

The two vendored palette files (`bloub/skins.ts` and `bloub/decor.ts`) have
explicit color-only entries in the UI hardcode baseline to preserve the original
artwork. TokenTracker's own UI text and colors remain subject to the guardrails.

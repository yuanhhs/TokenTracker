// PicBoard's default BloubBall: the same engine, circle, palette, gaze and 68px SVG.
// Image-intake effects are omitted; see NOTICE.md and the bundled MIT licenses.
import { useEffect, useRef, useState } from "react";
import { BotEngine } from "./bloub/engine";
import { SHAPE_BY_ID, DEFAULT_SHAPE } from "./bloub/skins";
import { DEMI_VIEWBOX, RAYON } from "./bloub/repere";
import { pointerToLookTarget } from "./look-geometry";
import { subscribeCursor } from "./floating-bridge";

export function FloatingBall({ active = true }: { active?: boolean }) {
  const [uid] = useState(() => `bloub-${crypto.randomUUID()}`);
  const engine = useRef<BotEngine | null>(null);
  if (!engine.current) {
    engine.current = new BotEngine(RAYON, "idle", SHAPE_BY_ID.get(DEFAULT_SHAPE)!.radii);
    engine.current.setLook({ yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 }, 0);
  }
  const svg = useRef<SVGSVGElement | null>(null);
  const clock = useRef(0);
  const [frame, setFrame] = useState(() => engine.current!.sample(0));

  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = performance.now();
    let rendered = last;
    const step = (now: number) => {
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.visibilityState !== "hidden" && !reduced.matches) {
        clock.current += elapsed;
        // Preserve the reference's time-based motion without rendering a tiny ball at 144Hz.
        if (now - rendered >= 1000 / 30) {
          setFrame(engine.current!.sample(clock.current));
          rendered = now;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const lookAt = (x: number, y: number) => {
      if (reduced.matches) return;
      const rect = svg.current?.getBoundingClientRect();
      if (!rect?.width || !rect.height) return;
      const target = pointerToLookTarget(
        ((x - rect.left) / rect.width - 0.5) * 2,
        ((y - rect.top) / rect.height - 0.5) * 2,
      );
      engine.current!.setLook({ ...target, mix: 0.88, spin: 0, wander: 0 }, clock.current);
    };
    const move = (event: PointerEvent) => lookAt(event.clientX, event.clientY);
    window.addEventListener("pointermove", move, { passive: true });
    const unsubscribe = subscribeCursor(lookAt);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      unsubscribe();
    };
  }, [active]);

  return (
    <svg ref={svg} className="floating-ball" aria-hidden="true"
      viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${2 * DEMI_VIEWBOX} ${2 * DEMI_VIEWBOX}`}>
      <defs>
        <mask id={uid} maskUnits="userSpaceOnUse" x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX}
          width={2 * DEMI_VIEWBOX} height={2 * DEMI_VIEWBOX}>
          <path d={frame.bodyPath} fill="white" />
          {frame.eyes.map((eye, i) => <path key={i} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="black" />)}
        </mask>
      </defs>
      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill="var(--ball-eye)" />
        <g mask={`url(#${uid})`}>
          <rect x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={2 * DEMI_VIEWBOX} height={2 * DEMI_VIEWBOX} fill="var(--ball-ink)" />
        </g>
      </g>
    </svg>
  );
}

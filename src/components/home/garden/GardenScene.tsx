"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { SegmentLink } from "@/components/segment/SegmentLink";
import { rng } from "./rng";

/**
 * Illustrated garden landscape with layered scroll parallax (sky, sun,
 * clouds, far hills, tree line, vegetable beds and orchard, flower meadow
 * with a signpost, foreground grass). While the scene is pinned, scrolling
 * moves each layer at its own speed until the front meadow rises to fill the
 * screen and hands over to the green section below (MEADOW colour).
 *
 * Ambient motion (drifting clouds, birds, swaying trees/grass, sun glow) is
 * CSS-only and switched off, with the parallax, for reduced motion.
 */

export const MEADOW = "#4E7A45";

const W = 1600;
const H = 900;

type Fn = (x: number) => number;

/** Closed path from a horizon function down to the bottom of the box. */
function hill(f: Fn, step = 20, bottom = H) {
  let d = `M0 ${f(0).toFixed(1)}`;
  for (let x = step; x <= W; x += step) d += ` L${x} ${f(x).toFixed(1)}`;
  return `${d} L${W} ${bottom} L0 ${bottom} Z`;
}

const f1: Fn = (x) => 455 + 42 * Math.sin(x / 260) + 18 * Math.sin(x / 95 + 1);
const f2: Fn = (x) => 560 + 30 * Math.sin(x / 210 + 2) + 10 * Math.sin(x / 70);
const f3: Fn = (x) => 640 + 24 * Math.sin(x / 300 + 0.5);
const f4: Fn = (x) => 735 + 26 * Math.sin(x / 340 + 3);
const f5: Fn = (x) => 838 + 18 * Math.sin(x / 420 + 1.2);

function Cloud({ x, y, s = 1, className = "" }: { x: number; y: number; s?: number; className?: string }) {
  return (
    <g className={className}>
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <circle cx="0" cy="0" r="26" />
        <circle cx="34" cy="-16" r="36" />
        <circle cx="74" cy="-4" r="28" />
        <circle cx="104" cy="6" r="20" />
        <rect x="-26" y="0" width="150" height="26" rx="13" />
      </g>
    </g>
  );
}

function TreeLine() {
  const r = rng(17);
  const trees: React.ReactNode[] = [];
  for (let x = -20; x < W + 40; x += 26 + r() * 30) {
    const y = f2(x) + 6;
    const big = r() > 0.55;
    if (r() > 0.45) {
      // Rounded broadleaf
      const rr = big ? 30 + r() * 14 : 20 + r() * 10;
      trees.push(
        <g key={x} className="tree-sway" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${-r() * 6}s` }}>
          <rect x={x - 2.5} y={y - rr} width="5" height={rr} fill="#4A3A2A" />
          <circle cx={x} cy={y - rr - rr * 0.6} r={rr} fill={big ? "#4F7E4D" : "#5C8D58"} />
          <circle cx={x - rr * 0.35} cy={y - rr - rr * 0.8} r={rr * 0.45} fill="#6A9C63" opacity=".55" />
        </g>
      );
    } else {
      // Slim cypress / pine
      const h = big ? 90 + r() * 40 : 60 + r() * 30;
      trees.push(
        <path key={x} d={`M${x} ${y - h} C ${x + 16} ${y - h * 0.55}, ${x + 18} ${y - 10}, ${x} ${y} C ${x - 18} ${y - 10}, ${x - 16} ${y - h * 0.55}, ${x} ${y - h} Z`} fill="#3F6A3F" />
      );
    }
  }
  return <g>{trees}</g>;
}

function Beds() {
  // Curved vegetable beds: alternating soil and crop rows following the field.
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const off = 18 + i * 14;
    const d = (dy: number) => {
      let s = `M0 ${(f3(0) + dy).toFixed(1)}`;
      for (let x = 40; x <= W; x += 40) s += ` L${x} ${(f3(x) + dy).toFixed(1)}`;
      return s;
    };
    rows.push(<path key={`soil${i}`} d={d(off)} stroke="#7A5C40" strokeWidth={5 + i * 1.6} fill="none" opacity=".85" />);
    rows.push(<path key={`crop${i}`} d={d(off - 6 - i * 0.6)} stroke="#8DB46E" strokeWidth={2 + i} strokeDasharray={`${6 + i * 2} ${5 + i}`} fill="none" />);
  }
  return <g>{rows}</g>;
}

function Orchard() {
  const r = rng(29);
  const spots = [120, 260, 1330, 1480];
  return (
    <g>
      {spots.map((x, i) => {
        const y = f3(x) + 4;
        const rr = 44 + r() * 14;
        return (
          <g key={x} className="tree-sway" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${-i * 1.3}s` }}>
            <rect x={x - 4} y={y - rr * 1.1} width="8" height={rr * 1.1} fill="#5A4232" />
            <circle cx={x} cy={y - rr * 1.6} r={rr} fill="#3F6A3F" />
            <circle cx={x + rr * 0.45} cy={y - rr * 1.35} r={rr * 0.6} fill="#4F7E4D" />
            {Array.from({ length: 7 }).map((_, k) => (
              <circle key={k} cx={x - rr * 0.6 + r() * rr * 1.3} cy={y - rr * 2.1 + r() * rr * 1.1} r="5.5" fill={k % 3 ? "#E9A33A" : "#D9822B"} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Meadow() {
  const r = rng(43);
  const flowers: React.ReactNode[] = [];
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = f4(x) + 14 + r() * 120;
    const c = ["#F2C14E", "#FBF8F2", "#E07A3C", "#F2C14E", "#D4577A"][Math.floor(r() * 5)];
    flowers.push(
      <g key={i}>
        <path d={`M${x} ${y} l0 10`} stroke="#3F6A3F" strokeWidth="1.6" />
        <circle cx={x} cy={y} r={3 + r() * 2.5} fill={c} />
      </g>
    );
  }
  // A short fence with a climber on it.
  const fence: React.ReactNode[] = [];
  for (let k = 0; k < 9; k++) {
    const x = 1060 + k * 28;
    const y = f4(x) + 6;
    fence.push(<rect key={`p${k}`} x={x} y={y - 46} width="7" height="50" rx="2" fill="#B08A5E" />);
  }
  const fx0 = 1060;
  const fx1 = 1060 + 8 * 28 + 7;
  return (
    <g>
      {flowers}
      <g>
        {fence}
        <path d={`M${fx0} ${f4(fx0) - 30} L${fx1} ${f4(fx1) - 30}`} stroke="#9A7650" strokeWidth="5" />
        <path d={`M${fx0} ${f4(fx0) - 14} L${fx1} ${f4(fx1) - 14}`} stroke="#9A7650" strokeWidth="5" />
        <path d={`M${fx0 + 4} ${f4(fx0) - 2} C ${fx0 + 60} ${f4(fx0) - 60}, ${fx0 + 120} ${f4(fx0) + 10}, ${fx0 + 170} ${f4(fx0) - 44} S ${fx1} ${f4(fx1) - 20}, ${fx1 + 10} ${f4(fx1) - 50}`} stroke="#3F6A3F" strokeWidth="3" fill="none" />
        {[0.12, 0.3, 0.5, 0.66, 0.85].map((t, k) => {
          const x = fx0 + (fx1 - fx0) * t;
          const y = f4(x) - 30 - (k % 2) * 16;
          return (
            <g key={k}>
              <ellipse cx={x} cy={y} rx="11" ry="6" fill="#5E8A4E" transform={`rotate(${k % 2 ? 30 : -30} ${x} ${y})`} />
              {k % 2 === 0 && <circle cx={x + 8} cy={y + 9} r="6" fill="#C4472E" />}
            </g>
          );
        })}
      </g>
    </g>
  );
}

function ForeGrass() {
  const r = rng(71);
  const blades: React.ReactNode[] = [];
  for (let i = 0; i < 46; i++) {
    const side = i < 23 ? 0 : 1;
    const x = side === 0 ? r() * 330 : W - r() * 330;
    const h = 70 + r() * 120;
    const bend = (side === 0 ? 1 : -1) * (12 + r() * 30);
    const w = 6 + r() * 7;
    blades.push(
      <path
        key={i}
        className="grass-sway"
        style={{ animationDelay: `${-r() * 5}s` }}
        d={`M${x - w} ${H} Q${x + bend * 0.4} ${H - h * 0.6} ${x + bend} ${H - h} Q${x + bend * 0.4 + w * 0.3} ${H - h * 0.5} ${x + w} ${H} Z`}
        fill={["#3F6A3F", "#4E7A45", "#5E8A4E", "#6E9A5E"][Math.floor(r() * 4)]}
      />
    );
  }
  return <g>{blades}</g>;
}

function Layer({ speed, children, className = "" }: { speed: number; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`absolute inset-0 will-change-transform ${className}`}
      style={{ transform: `translate3d(0, calc(var(--p, 0) * var(--sh, 100vh) * ${-speed}), 0)` }}
    >
      {children}
    </div>
  );
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {children}
    </svg>
  );
}

export function GardenScene({ content }: { content: { eyebrow: string; headline: string; gardenSign: string; farmSign: string } }) {
  const outer = useRef<HTMLElement>(null);
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = outer.current;
    const sc = scene.current;
    if (!el || !sc || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      // The scene runs full-height behind the glass header.
      const sh = sc.getBoundingClientRect().height;
      sc.style.setProperty("--sh", `${Math.round(sh)}px`);
      // Scroll length = one scene height, so the front meadow (speed 0.94)
      // reaches the top exactly as the scene un-pins.
      el.style.height = `${Math.round(sh * 1.97)}px`;
      // Pull the next section up so its heading arrives just under the
      // header as the meadow fills the screen — no empty green on any screen.
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 120;
      document.documentElement.style.setProperty("--garden-overlap", `${Math.max(0, Math.round(sh - header - 28))}px`);
      const rect = el.getBoundingClientRect();
      const span = rect.height - sh;
      const p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      sc.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.documentElement.style.removeProperty("--garden-overlap");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    // Pulled up by the utility strip + header height (139px phone, 154px desktop)
    // so the sky sits behind the glass header.
    <section ref={outer} className="garden-scene relative -mt-[139px] h-[175vh] md:-mt-[154px] md:h-[195vh]" aria-label="Farmyzest garden">
      <div ref={scene} className="sticky top-0 h-[100svh] overflow-hidden bg-[#D4E6D6]">
        {/* Sun + clouds */}
        <Layer speed={0.06}>
          <Svg>
            <g className="sun-glow">
              <circle cx="800" cy="250" r="150" fill="#FBF8F2" opacity=".18" />
              <circle cx="800" cy="250" r="112" fill="#FBF8F2" opacity=".28" />
            </g>
            <circle cx="800" cy="250" r="74" fill="#FBF8F2" />
            <g fill="#FBF8F2">
              <Cloud x={180} y={190} s={1.1} className="cloud-drift" />
              <Cloud x={1180} y={150} s={0.9} className="cloud-drift cloud-drift-slow" />
              <Cloud x={1380} y={300} s={0.7} className="cloud-drift" />
              <Cloud x={420} y={330} s={0.6} className="cloud-drift cloud-drift-slow" />
            </g>
            <g className="birds" stroke="#3F5A3F" strokeWidth="2.2" fill="none" strokeLinecap="round">
              <path d="M0 0 q7 -7 14 0 q7 -7 14 0" transform="translate(560 200)" />
              <path d="M0 0 q5 -5 10 0 q5 -5 10 0" transform="translate(600 222)" />
              <path d="M0 0 q6 -6 12 0 q6 -6 12 0" transform="translate(530 232)" />
            </g>
          </Svg>
        </Layer>

        {/* Headline in the sky */}
        <Layer speed={0.32} className="z-10">
          <div
            className="pointer-events-none absolute inset-x-0 top-[calc(139px+6%)] px-5 text-center text-moss md:top-[calc(154px+7%)]"
            style={{ opacity: "calc(1 - var(--p, 0) * 2.2)" }}
          >
            {content.eyebrow && <p className="cat-label text-moss/70 rise">{content.eyebrow}</p>}
            <h1 className="rise mx-auto mt-4 max-w-[15ch] font-serif text-[2.6rem] leading-[1] tracking-[-0.02em] sm:text-[3.6rem] lg:text-[4.8rem] text-balance" style={{ animationDelay: "150ms" }}>
              {content.headline}
            </h1>
          </div>
        </Layer>

        <Layer speed={0.1}>
          <Svg>
            <path d={hill(f1)} fill="#AFCBB2" />
          </Svg>
        </Layer>

        <Layer speed={0.2}>
          <Svg>
            <path d={hill(f2)} fill="#86AE84" />
            <TreeLine />
          </Svg>
        </Layer>

        <Layer speed={0.36}>
          <Svg>
            <path d={hill(f3)} fill="#6E9A5E" />
            <Beds />
            <Orchard />
          </Svg>
        </Layer>

        <Layer speed={0.58}>
          <Svg>
            <path d={hill(f4)} fill="#5B8B4E" />
            <Meadow />
          </Svg>
          {/* Signpost: the two ways into the shop */}
          <div className="absolute inset-x-0 bottom-[6%] flex justify-center md:bottom-[7%]">
            <div className="relative flex flex-col items-center">
              <div className="flex flex-col items-start gap-2">
                <SegmentLink
                  segment="garden"
                  href="/shop?segment=garden"
                  className="sign-board -rotate-3 bg-[#C99A62] pl-4 pr-7 [clip-path:polygon(0_0,88%_0,100%_50%,88%_100%,0_100%)]"
                >
                  {content.gardenSign}
                </SegmentLink>
                <SegmentLink
                  segment="farm"
                  href="/shop?segment=farm"
                  className="sign-board ml-6 rotate-2 bg-[#B8874F] pl-7 pr-4 [clip-path:polygon(12%_0,100%_0,100%_100%,12%_100%,0_50%)]"
                >
                  {content.farmSign}
                </SegmentLink>
              </div>
              <span className="h-16 w-3.5 bg-[#8A6A44] md:h-24" aria-hidden="true" />
            </div>
          </div>
        </Layer>

        {/* Front: grass, then the meadow that rises to fill the screen exactly
            as the scene un-pins (hill top sits ~7% above the bottom). */}
        <Layer speed={0.94}>
          <Svg>
            <path d={hill(f5)} fill={MEADOW} />
            <ForeGrass />
          </Svg>
          <div className="absolute inset-x-0 top-full h-full" style={{ background: MEADOW }} />
          <div className="absolute inset-x-0 bottom-5 flex justify-center text-bone/90" style={{ opacity: "calc(1 - var(--p, 0) * 4)" }}>
            <span className="flex flex-col items-center gap-1 text-xs tracking-[0.2em] uppercase">
              Scroll
              <ChevronDown className="h-4 w-4 scroll-hint" strokeWidth={1.8} />
            </span>
          </div>
        </Layer>
      </div>
    </section>
  );
}

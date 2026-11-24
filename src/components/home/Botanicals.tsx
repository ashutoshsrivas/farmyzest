// Hand-drawn style botanical line art. Decorative only (aria-hidden).
// Wrap in <Reveal> to have the strokes draw in on scroll.

export function Sprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 260" fill="none" aria-hidden="true" className={`draw ${className}`} style={{ ["--len" as string]: 420 }}>
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M62 256 C 58 200, 60 140, 70 90 S 84 30, 78 6" />
        <path d="M61 214 C 40 208, 24 192, 20 170 C 40 172, 56 186, 61 214 Z" />
        <path d="M62 186 C 82 182, 98 166, 102 146 C 82 148, 66 162, 62 186 Z" />
        <path d="M64 150 C 44 142, 32 124, 32 104 C 50 110, 62 126, 64 150 Z" />
        <path d="M68 118 C 86 112, 98 96, 100 78 C 82 82, 70 96, 68 118 Z" />
        <path d="M72 82 C 56 74, 48 58, 50 42 C 64 48, 72 62, 72 82 Z" />
        <path d="M76 50 C 88 44, 94 32, 94 20 C 82 24, 76 36, 76 50 Z" />
      </g>
    </svg>
  );
}

export function SeedHead({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" fill="none" aria-hidden="true" className={`draw ${className}`} style={{ ["--len" as string]: 260 }}>
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <circle cx="80" cy="80" r="10" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6;
          const x1 = 80 + Math.cos(a) * 16;
          const y1 = 80 + Math.sin(a) * 16;
          const x2 = 80 + Math.cos(a) * 58;
          const y2 = 80 + Math.sin(a) * 58;
          return <path key={i} d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`} />;
        })}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6;
          const cx = 80 + Math.cos(a) * 64;
          const cy = 80 + Math.sin(a) * 64;
          return <circle key={`c${i}`} cx={cx.toFixed(1)} cy={cy.toFixed(1)} r="5" />;
        })}
      </g>
    </svg>
  );
}

/** Rotating circular seal: "Nidhi Enterprises · Trading since 1962". */
export function Seal({ className = "" }: { className?: string }) {
  const text = "NIDHI ENTERPRISES · TRADING SINCE 1962 · FARMYZEST · ";
  return (
    <div className={`relative w-36 h-36 lg:w-40 lg:h-40 rounded-full bg-bone text-moss ${className}`} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="absolute inset-0 spin-slow">
        <defs>
          <path id="seal-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <text fontFamily="var(--font-plex-mono), monospace" fontSize="13.5" letterSpacing="3.2" fill="currentColor">
          <textPath href="#seal-circle">{text}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="cat-label !text-[0.6rem] text-stone">Est.</span>
        <span className="font-serif text-[2.1rem] leading-none">1962</span>
      </div>
    </div>
  );
}

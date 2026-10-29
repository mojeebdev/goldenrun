/**
 * Lightweight static stadium for the homepage (inline SVG, no game bundle).
 * Same perspective rules as the in-game camera so the entrance feels like the
 * place you are about to play in.
 */
const W = 1600;
const H = 1000;
const HORIZON = 560;
const F = 1100;
const CAM_Y = 1.75;

const sx = (x: number, z: number) => W / 2 + (F * x) / z;
const sy = (y: number, z: number) => HORIZON - (F * (y - CAM_Y)) / z;
const pt = (x: number, y: number, z: number) => `${sx(x, z).toFixed(1)},${sy(y, z).toFixed(1)}`;

const D = 24;

function stripes() {
  const out: { points: string; dark: boolean }[] = [];
  let i = 0;
  for (let z = 3; z < D + 6; z += 3, i++) {
    const z2 = Math.min(z + 3, D + 6);
    out.push({ points: [pt(-60, 0, z), pt(60, 0, z), pt(60, 0, z2), pt(-60, 0, z2)].join(' '), dark: i % 2 === 1 });
  }
  return out;
}

function line(x1: number, z1: number, x2: number, z2: number, w = 0.14) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * (w / 2);
  const nz = (dx / l) * (w / 2);
  return [pt(x1 + nx, 0, z1 + nz), pt(x2 + nx, 0, z2 + nz), pt(x2 - nx, 0, z2 - nz), pt(x1 - nx, 0, z1 - nz)].join(' ');
}

export function StadiumHero({ className = '', preserve = 'xMidYMid slice' }: { className?: string; preserve?: string }) {
  const netLines: string[] = [];
  for (let x = -3.66; x <= 3.67; x += 0.4) netLines.push(`M${pt(x, 0, D + 1.9)} L${pt(x, 2.44, D + 0.9)} L${pt(x, 2.44, D)}`);
  for (let y = 0.2; y < 2.44; y += 0.4) {
    const d = 1.9 - (y / 2.44);
    netLines.push(`M${pt(-3.66, y, D)} L${pt(-3.66, y, D + d)} L${pt(3.66, y, D + d)} L${pt(3.66, y, D)}`);
  }
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={preserve}
      role="img"
      aria-label="A floodlit night stadium seen from behind the ball, facing the goal"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020308" />
          <stop offset="0.6" stopColor="#0a0e1b" />
          <stop offset="1" stopColor="#1a1a22" />
        </linearGradient>
        <radialGradient id="flood" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4d6" stopOpacity="1" />
          <stop offset="0.2" stopColor="#ffd88a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffbe5a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd68c" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffd68c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ballShade" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#ecebe4" />
          <stop offset="1" stopColor="#8d8c88" />
        </radialGradient>
        <radialGradient id="vignette" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </radialGradient>
        <pattern id="crowd" width="36" height="13" patternUnits="userSpaceOnUse">
          <rect width="36" height="13" fill="#15161f" />
          <rect x="1" y="3" width="7" height="9" rx="2" fill="#33303a" />
          <rect x="10" y="2" width="7" height="9" rx="2" fill="#e8b84a" opacity="0.8" />
          <rect x="19" y="3" width="7" height="9" rx="2" fill="#2a2731" />
          <rect x="28" y="2" width="7" height="9" rx="2" fill="#a3283a" opacity="0.75" />
        </pattern>
        <linearGradient id="standShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070d" stopOpacity="0.75" />
          <stop offset="1" stopColor="#05070d" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3a6" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffe3a6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      {/* Light beams */}
      <g style={{ mixBlendMode: 'screen' }}>
        <polygon points={`210,150 300,150 700,640 380,640`} fill="url(#beam)" />
        <polygon points={`1300,150 1390,150 1220,640 900,640`} fill="url(#beam)" />
      </g>
      {/* Upper roof */}
      <polygon points={`0,170 ${W},170 ${W},200 0,200`} fill="#0b0d14" />
      {/* Stands */}
      <polygon points={[pt(-70, 1.2, D + 8), pt(70, 1.2, D + 8), pt(70, 14.2, D + 31.4), pt(-70, 14.2, D + 31.4)].join(' ')} fill="#161925" />
      <polygon
        points={[pt(-70, 1.2, D + 8), pt(70, 1.2, D + 8), pt(70, 14.2, D + 31.4), pt(-70, 14.2, D + 31.4)].join(' ')}
        fill="url(#crowd)"
        className="hero-crowd"
      />
      <polygon
        points={[pt(-70, 1.2, D + 8), pt(70, 1.2, D + 8), pt(70, 14.2, D + 31.4), pt(-70, 14.2, D + 31.4)].join(' ')}
        fill="url(#standShade)"
      />
      <polygon points={[pt(-70, 13.4, D + 31), pt(70, 13.4, D + 31), pt(70, 14.6, D + 31.6), pt(-70, 14.6, D + 31.6)].join(' ')} fill="#5c0f1b" />
      {/* Floodlight banks */}
      {[180, 620, 980, 1420].map((x) => (
        <g key={x} className="hero-flood">
          <circle cx={x} cy={175} r={150} fill="url(#flood)" />
          <rect x={x - 46} y={164} width={92} height={22} rx={3} fill="#fff6dc" />
        </g>
      ))}
      {/* Pitch */}
      <polygon points={[pt(-80, 0, D + 7.6), pt(80, 0, D + 7.6), pt(80, 1.2, D + 8), pt(-80, 1.2, D + 8)].join(' ')} fill="#0a0b10" />
      {stripes().map((s, i) => (
        <polygon key={i} points={s.points} fill={s.dark ? '#185a2b' : '#1d6431'} />
      ))}
      <ellipse cx={W / 2} cy={sy(0, D - 8)} rx={620} ry={90} fill="url(#pool)" />
      {/* Boards */}
      <polygon points={[pt(-80, 0, D + 4), pt(80, 0, D + 4), pt(80, 0.95, D + 4), pt(-80, 0.95, D + 4)].join(' ')} fill="#07080b" />
      <polygon points={[pt(-80, 0.82, D + 4), pt(80, 0.82, D + 4), pt(80, 0.95, D + 4), pt(-80, 0.95, D + 4)].join(' ')} fill="#8e1b2a" />
      {/* Markings */}
      <g fill="rgba(242,239,230,0.8)">
        <polygon points={line(-60, D, 60, D)} />
        <polygon points={line(-20.16, D - 16.5, 20.16, D - 16.5)} />
        <polygon points={line(-20.16, D - 16.5, -20.16, D)} />
        <polygon points={line(20.16, D - 16.5, 20.16, D)} />
        <polygon points={line(-9.16, D - 5.5, 9.16, D - 5.5)} />
        <polygon points={line(-9.16, D - 5.5, -9.16, D)} />
        <polygon points={line(9.16, D - 5.5, 9.16, D)} />
        <ellipse cx={sx(0, D - 11)} cy={sy(0, D - 11)} rx={8} ry={2} />
      </g>
      {/* Net + goal frame */}
      <path d={netLines.join(' ')} stroke="rgba(255,255,255,0.32)" strokeWidth={1.2} fill="none" />
      <g stroke="#f2efe6" strokeWidth={6} strokeLinecap="square">
        <line x1={sx(-3.72, D)} y1={sy(0, D)} x2={sx(-3.72, D)} y2={sy(2.5, D)} />
        <line x1={sx(3.72, D)} y1={sy(0, D)} x2={sx(3.72, D)} y2={sy(2.5, D)} />
        <line x1={sx(-3.78, D)} y1={sy(2.5, D)} x2={sx(3.78, D)} y2={sy(2.5, D)} />
      </g>
      {/* Keeper silhouette */}
      <g transform={`translate(${sx(0, D - 0.5)} ${sy(0, D - 0.5)})`}>
        <ellipse cx={0} cy={0} rx={26} ry={4} fill="rgba(0,0,0,0.4)" />
        <path d="M-15 0 L-11 -34 L-4 -40 L4 -40 L11 -34 L15 0" stroke="#10141c" strokeWidth={7} fill="none" strokeLinejoin="round" />
        <rect x={-12} y={-82} width={24} height={44} rx={9} fill="#a3283a" />
        <rect x={-12} y={-64} width={24} height={4} fill="#e8b84a" />
        <path d="M-11 -78 L-30 -60 L-38 -52 M11 -78 L30 -60 L38 -52" stroke="#a3283a" strokeWidth={7} fill="none" strokeLinecap="round" />
        <circle cx={-39} cy={-51} r={5} fill="#ffd877" />
        <circle cx={39} cy={-51} r={5} fill="#ffd877" />
        <circle cx={0} cy={-91} r={8} fill="#8a5a3c" />
      </g>
      {/* Ball */}
      <ellipse cx={W / 2} cy={sy(0, 5.5) + 2} rx={30} ry={7} fill="rgba(0,0,0,0.55)" />
      <g transform={`translate(${W / 2} ${sy(0.11, 5.5)})`}>
        <circle r={22} fill="url(#ballShade)" />
        <path d="M0 -8 L7.6 -2.5 L4.7 6.5 L-4.7 6.5 L-7.6 -2.5Z" fill="#14161c" stroke="#e8b84a" strokeWidth={1.6} />
        <path d="M-17 -12 L-12 -18 M17 -12 L12 -18 M-19 8 L-13 14 M19 8 L13 14" stroke="#14161c" strokeWidth={3} />
      </g>
      <rect width={W} height={H} fill="url(#vignette)" />
    </svg>
  );
}

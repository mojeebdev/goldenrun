/**
 * Paints the static stadium (sky, floodlights, stands, crowd, boards, pitch and
 * markings) into a 2D canvas in true perspective. Re-painted only when the
 * viewport or the shooting spot changes; the per-frame cost is one texture.
 */
import { mulberry32, PALETTE } from './palette';
import type { Projection, Screen } from './projection';

export interface CrowdSpot {
  x: number;
  y: number;
  size: number;
  color: number;
  phase: number;
}

export interface LightBank {
  x: number;
  y: number;
  size: number;
}

export interface StadiumPaint {
  crowd: CrowdSpot[];
  lights: LightBank[];
}

type V3 = [number, number, number];

const PITCH_HALF = 34;

function poly(ctx: CanvasRenderingContext2D, pts: Screen[]): boolean {
  if (pts.length < 3) return false;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  return true;
}

function fillPoly(ctx: CanvasRenderingContext2D, proj: Projection, pts: V3[], style: string | CanvasGradient): void {
  if (poly(ctx, proj.projectPoly(pts))) {
    ctx.fillStyle = style;
    ctx.fill();
  }
}

/** A ground-plane line of given width (m) between two points, as a quad. */
function groundLine(ctx: CanvasRenderingContext2D, proj: Projection, x1: number, z1: number, x2: number, z2: number, w = 0.12): void {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * (w / 2);
  const nz = (dx / l) * (w / 2);
  if (
    poly(
      ctx,
      proj.projectPoly([
        [x1 + nx, 0, z1 + nz],
        [x2 + nx, 0, z2 + nz],
        [x2 - nx, 0, z2 - nz],
        [x1 - nx, 0, z1 - nz],
      ]),
    )
  )
    ctx.fill();
}

export function paintStadium(
  ctx: CanvasRenderingContext2D,
  proj: Projection,
  opts: { low: boolean; dpr: number },
): StadiumPaint {
  const W = proj.width;
  const H = proj.height;
  const D = proj.distance;
  const rand = mulberry32(2008);
  const crowd: CrowdSpot[] = [];
  const lights: LightBank[] = [];

  // ---------- sky ----------
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(proj.horizonY, 1));
  sky.addColorStop(0, '#020308');
  sky.addColorStop(0.55, '#070b16');
  sky.addColorStop(1, '#141626');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // ---------- pitch (alternating mown bands) ----------
  const band = 5.5;
  const zStart = -60;
  const zEnd = D + 6;
  for (let z = zStart, i = 0; z < zEnd; z += band, i++) {
    const z2 = Math.min(z + band, zEnd);
    fillPoly(ctx, proj, [
      [-PITCH_HALF - 8, 0, z],
      [PITCH_HALF + 8, 0, z],
      [PITCH_HALF + 8, 0, z2],
      [-PITCH_HALF - 8, 0, z2],
    ], i % 2 === 0 ? '#1d6431' : '#195a2c');
  }
  // Cross-mowing beyond the touchlines is darker.
  for (const s of [-1, 1]) {
    fillPoly(ctx, proj, [
      [s * PITCH_HALF, 0, zStart],
      [s * (PITCH_HALF + 8), 0, zStart],
      [s * (PITCH_HALF + 8), 0, zEnd],
      [s * PITCH_HALF, 0, zEnd],
    ], 'rgba(5,20,10,0.35)');
  }
  // Run-off behind the goal line.
  fillPoly(ctx, proj, [
    [-PITCH_HALF - 8, 0, D],
    [PITCH_HALF + 8, 0, D],
    [PITCH_HALF + 8, 0, zEnd],
    [-PITCH_HALF - 8, 0, zEnd],
  ], 'rgba(4,16,8,0.35)');

  // Goalmouth wear.
  const mouth = proj.project(0, 0, D - 2.5);
  if (mouth) {
    const r = 4.2 * mouth.scale;
    const g = ctx.createRadialGradient(mouth.x, mouth.y, 0, mouth.x, mouth.y, r);
    g.addColorStop(0, 'rgba(60,48,24,0.28)');
    g.addColorStop(1, 'rgba(60,48,24,0)');
    ctx.save();
    ctx.translate(mouth.x, mouth.y);
    ctx.scale(1, 0.18);
    ctx.translate(-mouth.x, -mouth.y);
    ctx.fillStyle = g;
    ctx.fillRect(mouth.x - r, mouth.y - r, r * 2, r * 2);
    ctx.restore();
  }

  // ---------- markings ----------
  ctx.fillStyle = 'rgba(242,239,230,0.82)';
  groundLine(ctx, proj, -PITCH_HALF, D, PITCH_HALF, D);
  for (const s of [-1, 1]) groundLine(ctx, proj, s * PITCH_HALF, zStart, s * PITCH_HALF, D);
  // Penalty area (16.5 m) and goal area (5.5 m).
  const box = (half: number, depth: number) => {
    groundLine(ctx, proj, -half, D - depth, half, D - depth);
    groundLine(ctx, proj, -half, D - depth, -half, D);
    groundLine(ctx, proj, half, D - depth, half, D);
  };
  box(20.16, 16.5);
  box(9.16, 5.5);
  // Penalty spot.
  const spot = proj.project(0, 0, D - 11);
  if (spot) {
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y, Math.max(1, 0.13 * spot.scale), Math.max(0.6, 0.13 * spot.scale * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The arc ("D"): radius 9.15 m around the spot, outside the box only.
  const arcPts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI; // behind the spot
    const x = Math.cos(a) * 9.15;
    const z = D - 11 + Math.sin(a) * 9.15;
    if (z <= D - 16.5) arcPts.push([x, z]);
  }
  for (let i = 0; i + 1 < arcPts.length; i++) {
    groundLine(ctx, proj, arcPts[i]![0], arcPts[i]![1], arcPts[i + 1]![0], arcPts[i + 1]![1]);
  }
  // Halfway-side markings far behind the camera are culled by the near plane.

  // ---------- stands behind the goal ----------
  const standX = 70;
  const lowerRows = opts.low ? 18 : 26;
  const seat = opts.low ? 0.9 : 0.55;
  const drawTier = (z0: number, y0: number, rows: number, rowDepth: number, rowRise: number, xHalf: number, tint: string) => {
    const z1 = z0 + rows * rowDepth;
    const y1 = y0 + rows * rowRise;
    // Tier face.
    const pts = proj.projectPoly([
      [-xHalf, y0, z0],
      [xHalf, y0, z0],
      [xHalf, y1, z1],
      [-xHalf, y1, z1],
    ]);
    if (poly(ctx, pts)) {
      const top = Math.min(...pts.map((p) => p.y));
      const bottom = Math.max(...pts.map((p) => p.y));
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, '#07080c');
      g.addColorStop(1, tint);
      ctx.fillStyle = g;
      ctx.fill();
    }
    // Crowd.
    for (let r = 0; r < rows; r++) {
      const z = z0 + (r + 0.5) * rowDepth;
      const y = y0 + r * rowRise + 0.45;
      const rowLight = 0.45 + 0.55 * (1 - r / rows);
      for (let x = -xHalf + seat / 2; x < xHalf; x += seat) {
        if (rand() < 0.08) continue; // empty seats
        const jitter = (rand() - 0.5) * seat * 0.4;
        const p = proj.project(x + jitter, y, z);
        if (!p || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H) continue;
        const sz = Math.max(1, 0.24 * p.scale);
        const roll = rand();
        let color: string;
        let hex: number;
        if (roll < 0.05) [color, hex] = [PALETTE.gold, 0xe8b84a];
        else if (roll < 0.09) [color, hex] = ['#8e1b2a', 0x8e1b2a];
        else if (roll < 0.12) [color, hex] = ['#bdb8ab', 0xbdb8ab];
        else {
          const v = Math.floor(22 + rand() * 30);
          color = `rgb(${v},${v - 2},${v + 8})`;
          hex = (v << 16) | ((v - 2) << 8) | (v + 8);
        }
        ctx.globalAlpha = rowLight;
        // Shirt, then head.
        ctx.fillStyle = color;
        ctx.fillRect(p.x - sz * 0.75, p.y - sz * 0.9, sz * 1.5, sz * 1.7);
        ctx.fillStyle = rand() < 0.5 ? '#6b4a36' : '#2a201b';
        ctx.fillRect(p.x - sz * 0.4, p.y - sz * 1.75, sz * 0.8, sz * 0.8);
        if (rand() < (opts.low ? 0.02 : 0.045)) {
          crowd.push({ x: p.x, y: p.y - sz * 1.75, size: sz, color: roll < 0.12 ? hex : rand() < 0.5 ? 0xe8b84a : 0x8e1b2a, phase: rand() * Math.PI * 2 });
        }
      }
    }
    ctx.globalAlpha = 1;
  };
  // Retaining walls fill the gap between the pitch and the first rows.
  fillPoly(ctx, proj, [
    [-standX, 0, D + 6.6],
    [standX, 0, D + 6.6],
    [standX, 1.2, D + 7],
    [-standX, 1.2, D + 7],
  ], '#0a0b10');
  for (const s of [-1, 1]) {
    fillPoly(ctx, proj, [
      [s * (PITCH_HALF + 6.6), 0, -40],
      [s * (PITCH_HALF + 6.6), 0, D + 7],
      [s * (PITCH_HALF + 7), 1.2, D + 7],
      [s * (PITCH_HALF + 7), 1.2, -40],
    ], '#0a0b10');
  }
  // Upper tier first (farther), then the lower tier.
  drawTier(D + 32, 15, opts.low ? 12 : 18, 0.85, 0.55, standX, '#141722');
  // Upper tier fascia with a deep-red band.
  fillPoly(ctx, proj, [
    [-standX, 13.6, D + 31.5],
    [standX, 13.6, D + 31.5],
    [standX, 15, D + 32],
    [-standX, 15, D + 32],
  ], PALETTE.redDeep);
  drawTier(D + 7, 1.1, lowerRows, 0.8, 0.45, standX, '#191c27');

  // ---------- side stands ----------
  for (const s of [-1, 1]) {
    const x0 = s * (PITCH_HALF + 7);
    const rows = opts.low ? 14 : 22;
    const pts = proj.projectPoly([
      [x0, 1.1, -40],
      [x0, 1.1, D + 7],
      [x0 + s * rows * 0.8, 1.1 + rows * 0.45, D + 7],
      [x0 + s * rows * 0.8, 1.1 + rows * 0.45, -40],
    ]);
    if (poly(ctx, pts)) {
      ctx.fillStyle = '#10131c';
      ctx.fill();
    }
    for (let r = 0; r < rows; r++) {
      const x = x0 + s * (r + 0.5) * 0.8;
      const y = 1.1 + r * 0.45 + 0.45;
      for (let z = -40; z < D + 7; z += seat) {
        if (rand() < 0.1) continue;
        const p = proj.project(x, y, z);
        if (!p || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H) continue;
        const sz = Math.max(1, 0.24 * p.scale);
        const roll = rand();
        const v = Math.floor(22 + rand() * 30);
        ctx.fillStyle = roll < 0.05 ? PALETTE.gold : roll < 0.09 ? '#8e1b2a' : `rgb(${v},${v - 2},${v + 8})`;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(p.x - sz * 0.75, p.y - sz * 0.9, sz * 1.5, sz * 1.7);
        ctx.fillStyle = '#3a2a22';
        ctx.fillRect(p.x - sz * 0.4, p.y - sz * 1.75, sz * 0.8, sz * 0.8);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- advertising boards (original Golden Run branding only) ----------
  const boardZ = D + 3.6;
  fillPoly(ctx, proj, [
    [-standX, 0, boardZ],
    [standX, 0, boardZ],
    [standX, 0.95, boardZ],
    [-standX, 0.95, boardZ],
  ], '#07080b');
  fillPoly(ctx, proj, [
    [-standX, 0.82, boardZ - 0.01],
    [standX, 0.82, boardZ - 0.01],
    [standX, 0.95, boardZ - 0.01],
    [-standX, 0.95, boardZ - 0.01],
  ], PALETTE.red);
  const labels = ['THE GOLDEN RUN', '2008 → 1,000', 'ONE GOAL AT A TIME'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = -66, i = 0; x <= 66; x += 12, i++) {
    if (Math.abs(x) < 7) continue; // keep the goalmouth background clean
    const p = proj.project(x, 0.42, boardZ - 0.02);
    if (!p || p.x < -200 || p.x > W + 200) continue;
    const size = 0.42 * p.scale;
    if (size < 3) continue;
    ctx.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.fillStyle = i % 3 === 1 ? PALETTE.chalk : PALETTE.gold;
    ctx.globalAlpha = 0.85;
    ctx.fillText(labels[i % labels.length]!, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  // ---------- roof edge + floodlight banks ----------
  fillPoly(ctx, proj, [
    [-standX, 26.5, D + 48],
    [standX, 26.5, D + 48],
    [standX, 28, D + 46],
    [-standX, 28, D + 46],
  ], '#0c0e15');
  const glow = (p: Screen, radius: number, alpha: number) => {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, `rgba(255,236,190,${alpha})`);
    g.addColorStop(0.25, `rgba(255,205,120,${alpha * 0.35})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  };
  ctx.globalCompositeOperation = 'lighter';
  const banks: V3[] = [
    [-48, 27.5, D + 46],
    [-16, 27.5, D + 46],
    [16, 27.5, D + 46],
    [48, 27.5, D + 46],
    [-62, 30, D - 20],
    [62, 30, D - 20],
  ];
  for (const [x, y, z] of banks) {
    const p = proj.project(x, y, z);
    if (!p) continue;
    const bw = 7 * p.scale;
    const bh = 1.6 * p.scale;
    // Lamp grid.
    ctx.fillStyle = 'rgba(255,244,214,0.95)';
    const cols = 8;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 2; r++) {
        ctx.fillRect(p.x - bw / 2 + (c + 0.15) * (bw / cols), p.y - bh / 2 + (r + 0.15) * (bh / 2), (bw / cols) * 0.7, (bh / 2) * 0.7);
      }
    }
    glow(p, Math.max(40 * opts.dpr, 14 * p.scale), 0.55);
    lights.push({ x: p.x, y: p.y, size: Math.max(40 * opts.dpr, 14 * p.scale) });
  }
  // Warm light pool on the penalty area and haze at the horizon.
  const pool = proj.project(0, 0, D - 9);
  if (pool) {
    const r = 22 * pool.scale;
    const g = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, r);
    g.addColorStop(0, 'rgba(255,214,140,0.10)');
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.save();
    ctx.translate(pool.x, pool.y);
    ctx.scale(1, 0.35);
    ctx.translate(-pool.x, -pool.y);
    ctx.fillStyle = g;
    ctx.fillRect(pool.x - r, pool.y - r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  const haze = ctx.createLinearGradient(0, proj.horizonY - H * 0.12, 0, proj.horizonY + H * 0.05);
  haze.addColorStop(0, 'rgba(255,200,120,0)');
  haze.addColorStop(0.6, 'rgba(255,200,120,0.07)');
  haze.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, proj.horizonY - H * 0.12, W, H * 0.17);

  // Floodlight spill from above the frame: warm haze and soft beams.
  const top = ctx.createLinearGradient(0, 0, 0, Math.max(1, proj.horizonY * 0.9));
  top.addColorStop(0, 'rgba(255,220,150,0.22)');
  top.addColorStop(0.35, 'rgba(255,210,140,0.06)');
  top.addColorStop(1, 'rgba(255,210,140,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, proj.horizonY);
  for (const fx of [0.18, 0.82]) {
    const bx = W * fx;
    const g = ctx.createLinearGradient(0, 0, 0, proj.horizonY);
    g.addColorStop(0, 'rgba(255,230,170,0.14)');
    g.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - W * 0.04, 0);
    ctx.lineTo(bx + W * 0.04, 0);
    ctx.lineTo(W / 2 + (bx - W / 2) * 0.25 + W * 0.12, proj.horizonY);
    ctx.lineTo(W / 2 + (bx - W / 2) * 0.25 - W * 0.12, proj.horizonY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Vignette pulls focus to the goal.
  const vg = ctx.createRadialGradient(W / 2, proj.horizonY, Math.min(W, H) * 0.3, W / 2, proj.horizonY, Math.max(W, H) * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  return { crowd, lights };
}

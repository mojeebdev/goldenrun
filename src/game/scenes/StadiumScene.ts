/**
 * The football scene. Rendering + playback only: every outcome it shows comes
 * from a precomputed ShotResult. Frame rate changes how smooth the replay looks,
 * never what happens.
 */
import Phaser from 'phaser';
import type { KeeperPlan, Scenario, ShotResult } from '../../shared/rules';
import { BALL_RADIUS, GOAL_HALF_WIDTH, GOAL_HEIGHT, KEEPER_LINE_OFFSET, keeperPose, netDepthAt, readyPlan } from '../../shared/rules';
import { HEX } from '../rendering/palette';
import { Projection } from '../rendering/projection';
import type { Screen } from '../rendering/projection';
import type { Rig } from '../rendering/keeperRig';
import { lerpRig, moveRig, readyRig } from '../rendering/keeperRig';
import { paintStadium } from '../rendering/stadium';
import type { CrowdSpot } from '../rendering/stadium';
import { createTextures } from '../rendering/textures';

export interface AimView {
  /** Preview flight (no keeper). */
  preview: ShotResult;
  power: number;
  aimY: number;
  spin: number;
  /** Strike point on the pad, -1..1 vertically. */
  strike: number;
  /** Finger path in CSS px (for curvature feedback). */
  path: { x: number; y: number }[] | null;
  /** Fraction of the preview path revealed (difficulty dependent). */
  reveal: number;
  /** Reticle uncertainty radius (m). */
  reticleSpread: number;
}

export interface SceneEvents {
  onCue?: (cue: 'kick' | 'post' | 'glove' | 'catch' | 'net', intensity: number) => void;
  onDecisive?: (shotId: number) => void;
  onComplete?: (shotId: number) => void;
}

export interface SceneSettings {
  reducedMotion: boolean;
  low: boolean;
}

interface Flight {
  shotId: number;
  result: ShotResult;
  t: number;
  fired: Set<string>;
  decisiveSent: boolean;
  endAt: number | null;
  exceptional: boolean;
}

interface NetWave {
  x: number;
  y: number;
  amp: number;
  start: number;
  side: number; // 0 back, -1/1 side
}

export class StadiumScene extends Phaser.Scene {
  private proj!: Projection;
  private scenario!: Scenario;
  private dpr = 1;
  private settings: SceneSettings = { reducedMotion: false, low: false };
  private bgKey = 'stadium-bg-0';
  private bgSeq = 0;
  private bg?: Phaser.GameObjects.Image;
  private crowd: CrowdSpot[] = [];
  private gCrowd!: Phaser.GameObjects.Graphics;
  private gNet!: Phaser.GameObjects.Graphics;
  private gFrame!: Phaser.GameObjects.Graphics;
  private gKeeper!: Phaser.GameObjects.Graphics;
  private gTrail!: Phaser.GameObjects.Graphics;
  private gAim!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private confetti?: Phaser.GameObjects.Particles.ParticleEmitter;
  private mist: Phaser.GameObjects.Image[] = [];
  private flight: Flight | null = null;
  private aim: AimView | null = null;
  private plan: KeeperPlan | null = null;
  private recoveryFrom: { rig: Rig; start: number } | null = null;
  private trail: { x: number; y: number }[] = [];
  private ballRot = 0;
  private net: NetWave | null = null;
  private netDirty = true;
  private excitement = 0;
  private clock = 0;
  private ready = false;
  private padRadiusCss = 52;
  private ballFade = 1;
  events$: SceneEvents = {};
  private pendingLayout: { scenario: Scenario; w: number; h: number; dpr: number } | null = null;

  constructor() {
    super('stadium');
  }

  create(): void {
    createTextures(this);
    this.gCrowd = this.add.graphics().setDepth(1);
    this.gNet = this.add.graphics().setDepth(10);
    this.gFrame = this.add.graphics().setDepth(20);
    this.gKeeper = this.add.graphics().setDepth(30);
    this.gTrail = this.add.graphics().setDepth(39).setBlendMode(Phaser.BlendModes.ADD);
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(5);
    this.ball = this.add.image(0, 0, 'ball').setDepth(40);
    this.gAim = this.add.graphics().setDepth(60);
    for (let i = 0; i < 2; i++) {
      this.mist.push(this.add.image(0, 0, 'glow').setDepth(2).setAlpha(0.06).setBlendMode(Phaser.BlendModes.ADD));
    }
    this.confetti = this.add.particles(0, 0, 'confetti', {
      emitting: false,
      lifespan: { min: 1600, max: 2600 },
      speedY: { min: 80, max: 320 },
      speedX: { min: -120, max: 120 },
      gravityY: 160,
      rotate: { start: 0, end: 540 },
      scaleX: { min: 0.6, max: 1.1 },
      scaleY: { min: 0.4, max: 0.9 },
      tint: [HEX.gold, HEX.goldBright, HEX.chalk, HEX.red],
      alpha: { start: 1, end: 0.2 },
      quantity: 2,
    });
    this.confetti.setDepth(70);
    this.ready = true;
    if (this.pendingLayout) {
      const l = this.pendingLayout;
      this.pendingLayout = null;
      this.layout(l.scenario, l.w, l.h, l.dpr);
    }
  }

  configure(settings: SceneSettings, padRadiusCss: number): void {
    const relayout = settings.low !== this.settings.low;
    this.settings = settings;
    this.padRadiusCss = padRadiusCss;
    if (relayout && this.ready && this.scenario) this.layout(this.scenario, this.proj.width, this.proj.height, this.dpr);
  }

  /** (Re)build the camera and static stadium for a viewport + spot. */
  layout(scenario: Scenario, width: number, height: number, dpr: number): void {
    if (!this.ready) {
      this.pendingLayout = { scenario, w: width, h: height, dpr };
      return;
    }
    if (width < 2 || height < 2) return;
    this.scenario = scenario;
    this.dpr = dpr;
    this.proj = new Projection(width, height, scenario);
    if (!this.flight) this.plan = readyPlan(scenario.keeperX, scenario.distance - KEEPER_LINE_OFFSET, 0);
    // Paint the stadium into a fresh canvas texture.
    const oldKey = this.bgKey;
    this.bgKey = `stadium-bg-${++this.bgSeq}`;
    const tex = this.textures.createCanvas(this.bgKey, Math.ceil(width), Math.ceil(height));
    if (tex) {
      const paint = paintStadium(tex.getContext(), this.proj, { low: this.settings.low, dpr });
      tex.refresh();
      this.crowd = paint.crowd;
      if (this.bg) this.bg.setTexture(this.bgKey);
      else this.bg = this.add.image(0, 0, this.bgKey).setOrigin(0, 0).setDepth(0);
      if (this.textures.exists(oldKey)) this.textures.remove(oldKey);
      const l0 = paint.lights[1];
      const l1 = paint.lights[2];
      this.mist.forEach((m, i) => {
        const l = i === 0 ? l0 : l1;
        m.setPosition(l?.x ?? width * 0.3, (l?.y ?? height * 0.2) + height * 0.12);
        m.setDisplaySize(width * 0.9, height * 0.35);
        m.setVisible(!this.settings.low);
      });
    }
    this.cameras.main.setZoom(1).centerOn(width / 2, height / 2);
    this.netDirty = true;
    this.drawFrame();
  }

  get projection(): Projection | undefined {
    return this.proj;
  }

  /** Ball spot on screen, in CSS px (for hit-testing the strike pad). */
  ballScreenCss(): { x: number; y: number } | null {
    if (!this.proj || !this.scenario) return null;
    const p = this.proj.project(this.scenario.ballX, BALL_RADIUS, 0);
    return p ? { x: p.x / this.dpr, y: p.y / this.dpr } : null;
  }

  /** Screen position (CSS px) of the goal mouth centre — used to keep HUD clear. */
  goalScreenCss(): { top: number; bottom: number; left: number; right: number } | null {
    if (!this.proj || !this.scenario) return null;
    const D = this.scenario.distance;
    const tl = this.proj.project(-GOAL_HALF_WIDTH, GOAL_HEIGHT, D);
    const br = this.proj.project(GOAL_HALF_WIDTH, 0, D);
    if (!tl || !br) return null;
    return { top: tl.y / this.dpr, bottom: br.y / this.dpr, left: tl.x / this.dpr, right: br.x / this.dpr };
  }

  setAim(aim: AimView | null): void {
    this.aim = aim;
  }

  playShot(shotId: number, result: ShotResult): void {
    const exceptional =
      result.goal && result.modifiers.some((m) => m.id !== 'goal') && !this.settings.reducedMotion;
    this.flight = { shotId, result, t: 0, fired: new Set(), decisiveSent: false, endAt: null, exceptional };
    this.plan = result.keeper;
    this.recoveryFrom = null;
    this.trail = [];
    this.aim = null;
    this.events$.onCue?.('kick', 0.6 + (result.command.power / 1000) * 0.4);
  }

  /** Skip the remaining celebration and complete the shot now. */
  skip(): void {
    const f = this.flight;
    if (!f) return;
    if (!f.decisiveSent) {
      f.decisiveSent = true;
      this.events$.onDecisive?.(f.shotId);
    }
    this.finish();
  }

  /** Abandon any in-flight replay without resolving (tab hidden, restart). */
  abandon(): void {
    this.flight = null;
    this.trail = [];
    this.resetBall();
  }

  private finish(): void {
    const f = this.flight;
    if (!f) return;
    const pose = keeperPose(f.result.keeper, Math.min(f.t, f.result.duration));
    this.recoveryFrom = { rig: moveRig(pose, f.result.keeper), start: this.clock };
    this.flight = null;
    this.trail = [];
    this.events$.onComplete?.(f.shotId);
  }

  resetBall(): void {
    this.ballFade = 0;
    this.excitement = Math.min(this.excitement, 0.6);
    if (!this.settings.reducedMotion) {
      this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 450, ease: 'Sine.easeInOut' });
    } else {
      this.cameras.main.setZoom(1);
    }
    if (this.scenario) this.plan = readyPlan(this.scenario.keeperX, this.scenario.distance - KEEPER_LINE_OFFSET, 0);
  }

  update(_time: number, deltaMs: number): void {
    if (!this.proj) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.clock += dt;
    this.excitement = Math.max(0, this.excitement - dt * 0.25);
    this.ballFade = Math.min(1, this.ballFade + dt * 4);

    const f = this.flight;
    let ballPos = { x: this.scenario.ballX, y: BALL_RADIUS, z: 0 };
    let spin = 0;
    if (f) {
      let rate = 1;
      const d = f.result.decisiveAt;
      if (f.exceptional && f.t > d - 0.28 && f.t < d + 0.22) rate = 0.4;
      f.t += dt * rate;
      ballPos = this.sampleAt(f.result, f.t);
      spin = this.sampleSpin(f.result, f.t);
      this.fireEvents(f);
      if (!f.decisiveSent && f.t >= d) {
        f.decisiveSent = true;
        this.onDecisiveVisual(f.result);
        this.events$.onDecisive?.(f.shotId);
      }
      if (f.t >= f.result.duration) {
        if (f.endAt === null) f.endAt = this.clock;
        const hold = f.result.goal ? 1.5 : 0.9;
        if (this.clock - f.endAt >= hold) this.finish();
      }
    }

    this.drawCrowd();
    this.drawMist();
    this.drawNetIfNeeded();
    this.drawKeeper(f ? f.t : 0);
    this.drawBall(ballPos, spin, dt, !!f);
    this.drawAim();
  }

  // ---------------- playback helpers ----------------

  private sampleAt(r: ShotResult, t: number): { x: number; y: number; z: number } {
    const s = r.samples;
    const tt = Math.min(Math.max(t, 0), r.duration);
    // Samples are at 60 Hz except possibly the last one.
    let i = Math.min(Math.floor(tt * 60), s.length - 1);
    while (i > 0 && s[i]!.t > tt) i--;
    while (i < s.length - 1 && s[i + 1]!.t <= tt) i++;
    const a = s[i]!;
    const b = s[Math.min(i + 1, s.length - 1)]!;
    const span = b.t - a.t;
    const u = span > 0 ? (tt - a.t) / span : 0;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
  }

  private sampleSpin(r: ShotResult, t: number): number {
    const i = Math.min(Math.floor(Math.max(t, 0) * 60), r.samples.length - 1);
    return r.samples[i]!.s;
  }

  private fireEvents(f: Flight): void {
    const r = f.result;
    const once = (key: string, at: number, fn: () => void) => {
      if (f.t >= at && !f.fired.has(key)) {
        f.fired.add(key);
        fn();
      }
    };
    r.woodwork.forEach((w, i) => once(`w${i}`, w.t, () => this.events$.onCue?.('post', 1)));
    if (r.keeperContact) {
      const k = r.keeperContact;
      once('keeper', k.t, () => this.events$.onCue?.(k.kind === 'catch' ? 'catch' : 'glove', 1));
    }
    if (r.netImpact) {
      const n = r.netImpact;
      once('net', n.t, () => {
        const v = r.launchSpeed;
        const side = n.z - this.scenario.distance < netDepthAt(n.y) - 0.3 && Math.abs(n.x) > GOAL_HALF_WIDTH - 0.3 ? Math.sign(n.x) : 0;
        this.net = { x: n.x, y: n.y, amp: Math.min(0.6, 0.12 + v * 0.016), start: this.clock, side };
        this.netDirty = true;
        this.events$.onCue?.('net', 1);
      });
    }
  }

  private onDecisiveVisual(r: ShotResult): void {
    if (r.goal) {
      this.excitement = 1;
      if (!this.settings.reducedMotion) {
        const g = this.goalScreenCss();
        const cam = this.cameras.main;
        if (g) {
          const cx = ((g.left + g.right) / 2) * this.dpr;
          const cy = ((g.top + g.bottom) / 2) * this.dpr;
          this.tweens.add({ targets: cam, zoom: 1.06, duration: 900, ease: 'Sine.easeOut' });
          this.tweens.add({ targets: cam, scrollX: cx - this.proj.width / 2, scrollY: (cy - this.proj.height / 2) * 0.5, duration: 900, ease: 'Sine.easeOut' });
        }
        if (!this.settings.low && this.confetti) {
          const bursts = 8;
          const per = this.proj.width > 900 ? 16 : 10;
          for (let i = 0; i < bursts; i++) {
            this.confetti.explode(per, ((i + 0.5) / bursts) * this.proj.width, -12 * this.dpr);
          }
        }
      }
    } else if (r.outcome === 'saved' || r.outcome === 'post' || r.outcome === 'crossbar') {
      this.excitement = 0.55;
    } else {
      this.excitement = 0.3;
    }
  }

  // ---------------- drawing ----------------

  private drawCrowd(): void {
    const g = this.gCrowd;
    g.clear();
    if (this.settings.low) return;
    const amp = this.settings.reducedMotion ? 0.3 : 0.6 + this.excitement * 4.5;
    const speed = 3 + this.excitement * 9;
    const excited = this.excitement > 0.5;
    for (const c of this.crowd) {
      const bob = Math.max(0, Math.sin(this.clock * speed + c.phase)) * amp * c.size * 0.5;
      const sz = c.size;
      // A fan rising out of their seat: shirt + head, drawn over the static crowd.
      g.fillStyle(excited ? c.color : 0x24232c, excited ? 0.95 : 0.9);
      g.fillRect(c.x - sz * 0.75, c.y + sz * 0.85 - bob, sz * 1.5, sz * 1.7);
      g.fillStyle(0x4a3428, 1);
      g.fillRect(c.x - sz * 0.4, c.y - bob, sz * 0.8, sz * 0.8);
      if (excited && c.phase < 2.2) {
        // Arms (and scarves) up.
        g.fillStyle(c.color, 1);
        g.fillRect(c.x - sz * 0.95, c.y - bob - sz * 1.2, sz * 0.3, sz * 1.9);
        g.fillRect(c.x + sz * 0.65, c.y - bob - sz * 1.2, sz * 0.3, sz * 1.9);
      }
    }
  }

  private drawMist(): void {
    if (this.settings.low || this.settings.reducedMotion) return;
    this.mist.forEach((m, i) => {
      m.x += Math.sin(this.clock * 0.07 + i * 2) * 0.15 * this.dpr;
      m.setAlpha(0.05 + 0.02 * Math.sin(this.clock * 0.3 + i));
    });
  }

  private drawFrame(): void {
    const g = this.gFrame;
    g.clear();
    if (!this.proj) return;
    const D = this.scenario.distance;
    const post = 0.12;
    const segs: [number, number, number, number, number, number][] = [
      [-GOAL_HALF_WIDTH - 0.06, 0, D - 0.06, -GOAL_HALF_WIDTH - 0.06, GOAL_HEIGHT + 0.12, D - 0.06],
      [GOAL_HALF_WIDTH + 0.06, 0, D - 0.06, GOAL_HALF_WIDTH + 0.06, GOAL_HEIGHT + 0.12, D - 0.06],
      [-GOAL_HALF_WIDTH - 0.12, GOAL_HEIGHT + 0.06, D - 0.06, GOAL_HALF_WIDTH + 0.12, GOAL_HEIGHT + 0.06, D - 0.06],
    ];
    // Ground shadow of the frame.
    const s1 = this.proj.project(-GOAL_HALF_WIDTH, 0, D + 0.4);
    const s2 = this.proj.project(GOAL_HALF_WIDTH, 0, D + 0.4);
    if (s1 && s2) {
      g.lineStyle(Math.max(1, post * s1.scale * 0.8), 0x000000, 0.35);
      g.lineBetween(s1.x, s1.y, s2.x, s2.y);
    }
    for (const [x1, y1, z1, x2, y2, z2] of segs) {
      const a = this.proj.project(x1, y1, z1);
      const b = this.proj.project(x2, y2, z2);
      if (!a || !b) continue;
      const w = Math.max(2, post * a.scale);
      g.lineStyle(w + 2 * this.dpr, 0x000000, 0.35);
      g.lineBetween(a.x + this.dpr, a.y + this.dpr, b.x + this.dpr, b.y + this.dpr);
      g.lineStyle(w, HEX.chalk, 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(Math.max(1, w * 0.3), 0xffffff, 1);
      g.lineBetween(a.x - w * 0.15, a.y, b.x - w * 0.15, b.y);
    }
  }

  private netOffset(x: number, y: number, z: number, side: number): number {
    const n = this.net;
    if (!n) return 0;
    const t = this.clock - n.start;
    if (t > 2.2) return 0;
    if (side !== n.side) return 0;
    const dx = side === 0 ? x - n.x : z - (this.scenario.distance + 0.8);
    const dy = y - n.y;
    const falloff = Math.exp(-(dx * dx + dy * dy) / 0.7);
    const wobble = this.settings.reducedMotion ? Math.exp(-3 * t) : Math.exp(-3.2 * t) * Math.cos(t * 16);
    return n.amp * falloff * wobble;
  }

  private drawNetIfNeeded(): void {
    const animating = this.net && this.clock - this.net.start <= 2.3;
    if (!animating && !this.netDirty) return;
    this.netDirty = !!animating;
    if (this.net && !animating) this.net = null;
    const g = this.gNet;
    g.clear();
    const D = this.scenario.distance;
    const P = (x: number, y: number, z: number): Screen | null => this.proj.project(x, y, z);
    const lw = Math.max(1, 0.9 * this.dpr);
    g.lineStyle(lw, 0xffffff, 0.3);
    const line = (pts: (Screen | null)[]) => {
      let started = false;
      g.beginPath();
      for (const p of pts) {
        if (!p) continue;
        if (!started) {
          g.moveTo(p.x, p.y);
          started = true;
        } else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    };
    const back = (x: number, y: number): Screen | null => {
      const z = D + netDepthAt(y);
      return P(x, y, z + this.netOffset(x, y, z, 0));
    };
    const step = this.settings.low ? 0.45 : 0.3;
    // Back panel verticals continuing over the roof.
    for (let x = -GOAL_HALF_WIDTH; x <= GOAL_HALF_WIDTH + 1e-6; x += step) {
      const pts: (Screen | null)[] = [];
      for (let y = 0; y <= GOAL_HEIGHT + 1e-6; y += 0.3) pts.push(back(x, y));
      for (let d = netDepthAt(GOAL_HEIGHT); d >= 0; d -= 0.3) pts.push(P(x, GOAL_HEIGHT, D + d));
      line(pts);
    }
    // Horizontals wrapping side → back → side.
    for (let y = 0.15; y < GOAL_HEIGHT; y += step) {
      const depth = netDepthAt(y);
      const pts: (Screen | null)[] = [];
      for (let d = 0; d <= depth; d += 0.3) {
        const z = D + d;
        const off = this.netOffset(-GOAL_HALF_WIDTH, y, z, -1);
        pts.push(P(-GOAL_HALF_WIDTH + off, y, z));
      }
      for (let x = -GOAL_HALF_WIDTH; x <= GOAL_HALF_WIDTH + 1e-6; x += 0.3) pts.push(back(x, y));
      for (let d = depth; d >= 0; d -= 0.3) {
        const z = D + d;
        const off = this.netOffset(GOAL_HALF_WIDTH, y, z, 1);
        pts.push(P(GOAL_HALF_WIDTH + off, y, z));
      }
      line(pts);
    }
    // Roof lines.
    for (let d = 0.3; d < netDepthAt(GOAL_HEIGHT); d += 0.3) {
      line([P(-GOAL_HALF_WIDTH, GOAL_HEIGHT, D + d), P(GOAL_HALF_WIDTH, GOAL_HEIGHT, D + d)]);
    }
    // Side verticals.
    for (const sx of [-1, 1]) {
      for (let d = 0.3; d < NET_MAX; d += 0.3) {
        const pts: (Screen | null)[] = [];
        for (let y = 0; y <= GOAL_HEIGHT + 1e-6; y += 0.3) {
          if (d > netDepthAt(y)) break;
          const off = this.netOffset(sx * GOAL_HALF_WIDTH, y, D + d, sx);
          pts.push(P(sx * GOAL_HALF_WIDTH + off, y, D + d));
        }
        if (pts.length > 1) line(pts);
      }
    }
    // Back stanchions.
    g.lineStyle(Math.max(1.5, 1.6 * this.dpr), 0xdedbd2, 0.85);
    for (const sx of [-1, 1]) {
      line([P(sx * GOAL_HALF_WIDTH, GOAL_HEIGHT, D), P(sx * GOAL_HALF_WIDTH, GOAL_HEIGHT, D + netDepthAt(GOAL_HEIGHT)), P(sx * GOAL_HALF_WIDTH, 0, D + netDepthAt(0))]);
    }
    line([P(-GOAL_HALF_WIDTH, 0, D + netDepthAt(0)), P(GOAL_HALF_WIDTH, 0, D + netDepthAt(0))]);
  }

  private drawKeeper(t: number): void {
    const g = this.gKeeper;
    g.clear();
    if (!this.plan || !this.proj) return;
    const plan = this.plan;
    let rig: Rig;
    const idle = {
      time: this.clock,
      shuffle: this.aim || this.flight ? 0 : Math.sin(this.clock * 0.9) * 0.6,
      crouch: this.aim ? 0.8 : this.flight ? 1 : 0.25,
    };
    if (this.flight) {
      const pose = keeperPose(plan, t);
      rig = pose.progress > 0 && plan.action !== 'ready' && plan.action !== 'watch' ? moveRig(pose, plan) : readyRig(plan.x, plan.z, idle);
      if (plan.action === 'watch') {
        // Turns to watch it go past: small lean toward the ball.
        rig = readyRig(plan.x, plan.z, { ...idle, shuffle: (plan.read?.x ?? 0) > plan.x ? 0.3 : -0.3, crouch: 0.6 });
      }
    } else if (this.recoveryFrom) {
      const k = Math.min(1, (this.clock - this.recoveryFrom.start - 0.5) / 0.7);
      const target = readyRig(plan.x, plan.z, idle);
      if (k >= 1) {
        rig = target;
        this.recoveryFrom = null;
      } else {
        const e = k <= 0 ? 0 : k * k * (3 - 2 * k);
        rig = lerpRig(this.recoveryFrom.rig, target, e);
      }
    } else {
      rig = readyRig(plan.x, plan.z, idle);
    }
    const P = (p: { x: number; y: number; z: number }) => this.proj.project(p.x, p.y, p.z);
    const hip = P(rig.hip);
    if (!hip) return;
    const s = hip.scale;
    // Shadow.
    const sh = this.proj.project(rig.hip.x, 0, rig.hip.z);
    if (sh) {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(sh.x, sh.y, 1.1 * s, 0.16 * s);
    }
    const limb = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, w: number, color: number) => {
      const pa = P(a);
      const pb = P(b);
      if (!pa || !pb) return;
      const lw = Math.max(1.5, w * s);
      g.lineStyle(lw, color, 1);
      g.lineBetween(pa.x, pa.y, pb.x, pb.y);
      g.fillStyle(color, 1);
      g.fillCircle(pa.x, pa.y, lw / 2);
      g.fillCircle(pb.x, pb.y, lw / 2);
    };
    // Legs (socks + shorts).
    limb(rig.footL, rig.kneeL, 0.13, HEX.sock);
    limb(rig.footR, rig.kneeR, 0.13, HEX.sock);
    limb(rig.kneeL, rig.hip, 0.17, 0x15171d);
    limb(rig.kneeR, rig.hip, 0.17, 0x15171d);
    // Boots.
    for (const f of [rig.footL, rig.footR]) {
      const pf = P(f);
      if (pf) {
        g.fillStyle(HEX.boot, 1);
        g.fillEllipse(pf.x, pf.y, 0.2 * s, 0.09 * s);
      }
    }
    // Torso: deep-red jersey with a gold chest band.
    limb(rig.hip, rig.neck, 0.4, HEX.red);
    const mid = { x: (rig.hip.x + rig.neck.x) / 2, y: (rig.hip.y + rig.neck.y) / 2 + 0.08, z: rig.hip.z };
    const pm = P(mid);
    if (pm) {
      const pn = P(rig.neck)!;
      const ang = Math.atan2(pn.y - hip.y, pn.x - hip.x) + Math.PI / 2;
      g.lineStyle(Math.max(1, 0.05 * s), HEX.keeperTrim, 1);
      const hw = 0.19 * s;
      g.lineBetween(pm.x - Math.cos(ang) * hw, pm.y - Math.sin(ang) * hw, pm.x + Math.cos(ang) * hw, pm.y + Math.sin(ang) * hw);
    }
    // Arms + gloves.
    limb(rig.shoulderL, rig.elbowL, 0.12, HEX.red);
    limb(rig.shoulderR, rig.elbowR, 0.12, HEX.red);
    limb(rig.elbowL, rig.handL, 0.1, HEX.redDeep);
    limb(rig.elbowR, rig.handR, 0.1, HEX.redDeep);
    for (const h of [rig.handL, rig.handR]) {
      const ph = P(h);
      if (ph) {
        g.fillStyle(HEX.glove, 1);
        g.fillCircle(ph.x, ph.y, Math.max(2, 0.085 * s));
      }
    }
    // Head.
    const ph = P(rig.head);
    if (ph) {
      g.fillStyle(HEX.skin, 1);
      g.fillCircle(ph.x, ph.y, Math.max(2, 0.115 * s));
      g.fillStyle(HEX.hair, 1);
      g.fillEllipse(ph.x, ph.y - 0.05 * s, 0.22 * s, 0.11 * s);
    }
  }

  private drawBall(pos: { x: number; y: number; z: number }, spin: number, dt: number, inFlight: boolean): void {
    const p = this.proj.project(pos.x, pos.y, pos.z);
    if (!p) {
      this.ball.setVisible(false);
      this.shadow.setVisible(false);
      return;
    }
    const D = this.scenario.distance;
    const kz = D - KEEPER_LINE_OFFSET;
    const depth = pos.z >= D - 0.06 ? 15 : pos.z >= kz ? 25 : 40;
    const size = Math.max(3, BALL_RADIUS * 2 * p.scale);
    this.ball.setVisible(true).setPosition(p.x, p.y).setDisplaySize(size, size).setDepth(depth).setAlpha(this.ballFade);
    if (inFlight) this.ballRot += (spin * 16 + 6) * dt;
    this.ball.setRotation(this.ballRot);
    const sp = this.proj.project(pos.x, 0, pos.z);
    if (sp) {
      const h = Math.max(0, pos.y - BALL_RADIUS);
      const k = 1 / (1 + h * 0.6);
      const w = BALL_RADIUS * 2.6 * sp.scale * (1 + h * 0.15);
      this.shadow.setVisible(true).setPosition(sp.x, sp.y).setDisplaySize(w, w * 0.28).setAlpha(0.65 * k * this.ballFade).setDepth(depth - 1);
    }
    // Trail.
    const g = this.gTrail;
    g.clear();
    if (inFlight) {
      this.trail.push({ x: p.x, y: p.y });
      if (this.trail.length > 14) this.trail.shift();
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1]!;
        const b = this.trail[i]!;
        const k = i / this.trail.length;
        g.lineStyle(Math.max(1, size * 0.55 * k), HEX.gold, 0.35 * k);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  private drawAim(): void {
    const g = this.gAim;
    g.clear();
    if (this.flight || !this.proj) return;
    const bp = this.proj.project(this.scenario.ballX, BALL_RADIUS, 0);
    if (!bp) return;
    const dpr = this.dpr;
    const R = this.padRadiusCss * dpr;
    const aim = this.aim;
    // Strike pad ring.
    const pulse = aim || this.settings.reducedMotion ? 0 : (Math.sin(this.clock * 3) + 1) * 0.5;
    g.lineStyle(2 * dpr, HEX.gold, 0.55 + pulse * 0.3);
    g.strokeCircle(bp.x, bp.y, R + pulse * 3 * dpr);
    g.lineStyle(1 * dpr, HEX.gold, 0.25);
    g.strokeCircle(bp.x, bp.y, R * 0.55);
    if (!aim) return;

    // Strike point on the ball (elevation feedback).
    const sy = bp.y + aim.strike * R * 0.8;
    g.lineStyle(1 * dpr, 0xffffff, 0.35);
    g.lineBetween(bp.x - R * 0.8, bp.y, bp.x + R * 0.8, bp.y);
    g.fillStyle(HEX.goldBright, 1);
    g.fillCircle(bp.x, sy, 5 * dpr);

    // Power ring (clockwise from the top), green → gold → red.
    const pw = aim.power / 1000;
    const color = pw < 0.5 ? 0x7fd18b : pw < 0.85 ? HEX.gold : 0xe0563f;
    g.lineStyle(6 * dpr, 0x000000, 0.35);
    g.beginPath();
    g.arc(bp.x, bp.y, R + 9 * dpr, -Math.PI / 2, Math.PI * 1.5, false);
    g.strokePath();
    if (pw > 0.005) {
      g.lineStyle(6 * dpr, color, 0.95);
      g.beginPath();
      g.arc(bp.x, bp.y, R + 9 * dpr, -Math.PI / 2, -Math.PI / 2 + pw * Math.PI * 2, false);
      g.strokePath();
    }

    // Finger path (curvature feedback).
    if (aim.path && aim.path.length > 1) {
      g.lineStyle(3 * dpr, 0xffffff, 0.35);
      g.beginPath();
      g.moveTo(aim.path[0]!.x * dpr, aim.path[0]!.y * dpr);
      for (const pt of aim.path) g.lineTo(pt.x * dpr, pt.y * dpr);
      g.strokePath();
    }

    // Trajectory preview dots.
    const samples = aim.preview.samples;
    const n = Math.max(2, Math.floor(samples.length * aim.reveal));
    for (let i = 2; i < n; i += 2) {
      const sm = samples[i]!;
      const pp = this.proj.project(sm.x, sm.y, sm.z);
      if (!pp) continue;
      const k = 1 - i / samples.length;
      g.fillStyle(HEX.goldBright, 0.35 + 0.5 * k);
      g.fillCircle(pp.x, pp.y, Math.max(1.5 * dpr, 0.05 * pp.scale));
    }
    // Reticle at the goal plane.
    const c = aim.preview.crossing;
    if (c) {
      const rp = this.proj.project(c.x, c.y, this.scenario.distance);
      if (rp) {
        const r = Math.max(6 * dpr, (0.22 + aim.reticleSpread) * rp.scale);
        const ok = c.inside;
        g.lineStyle(2 * dpr, ok ? HEX.goldBright : 0xe0563f, 0.95);
        g.strokeCircle(rp.x, rp.y, r);
        g.lineBetween(rp.x - r * 1.4, rp.y, rp.x - r * 0.6, rp.y);
        g.lineBetween(rp.x + r * 0.6, rp.y, rp.x + r * 1.4, rp.y);
        g.lineBetween(rp.x, rp.y - r * 1.4, rp.x, rp.y - r * 0.6);
        g.lineBetween(rp.x, rp.y + r * 0.6, rp.x, rp.y + r * 1.4);
      }
    }
    // Curl indicator above the pad.
    if (Math.abs(aim.spin) > 30) {
      const dir = Math.sign(aim.spin);
      const mag = Math.min(1, Math.abs(aim.spin) / 1000);
      const cy = bp.y - R - 26 * dpr;
      const span = (18 + 26 * mag) * dpr;
      g.lineStyle(3 * dpr, HEX.goldBright, 0.9);
      g.beginPath();
      const steps = 10;
      let ex = 0;
      let ey = 0;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = bp.x - dir * span + dir * span * 2 * u;
        const y = cy - Math.sin(u * Math.PI) * 10 * dpr * mag;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
        ex = x;
        ey = y;
      }
      g.strokePath();
      g.fillStyle(HEX.goldBright, 0.95);
      g.fillTriangle(ex + dir * 7 * dpr, ey + 1 * dpr, ex - dir * 2 * dpr, ey - 6 * dpr, ex - dir * 2 * dpr, ey + 7 * dpr);
    }
  }
}

const NET_MAX = 1.9;

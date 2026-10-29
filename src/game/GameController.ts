/**
 * Owns the Phaser game, the practice session, sound and all input (pointer +
 * keyboard). React talks to the game only through this class.
 */
import Phaser from 'phaser';
import type { KeeperLevel, ShotResult } from '../shared/rules';
import { BALL_RADIUS, GOAL_HEIGHT, getScenario, makeCommand, previewShot } from '../shared/rules';
import { Projection } from './rendering/projection';
import { SoundEngine } from './audio/sound';
import type { GestureFrame, Point, ShotParams } from './input/gesture';
import { KEY_STEPS, readGesture, referenceLength, resamplePath } from './input/gesture';
import { StadiumScene } from './scenes/StadiumScene';
import { PracticeSession } from './session';
import type { ResolvedShot } from './session';
import type { Settings } from './settings';
import { loadSettings, saveSettings, systemPrefersReducedMotion } from './settings';

export interface AimReadout {
  power: number;
  aimY: number;
  spin: number;
  aimX: number;
  onTarget: boolean;
  source: 'pointer' | 'keyboard';
}

export interface ControllerUi {
  aim: AimReadout | null;
  banner: ResolvedShot | null;
  hint: string | null;
  settings: Settings;
  reducedMotion: boolean;
  lowQuality: boolean;
  paused: boolean;
  /** Layout anchors in CSS px for placing HUD elements around the play. */
  layout: { ball: { x: number; y: number }; goalTop: number; goalBottom: number; padRadius: number } | null;
}

/** Difficulty-dependent preview honesty (spec: informative, not perfect, at high difficulty). */
const PREVIEW: Record<KeeperLevel, { reveal: number; spread: number }> = {
  rookie: { reveal: 1, spread: 0 },
  professional: { reveal: 0.7, spread: 0.35 },
  legendary: { reveal: 0.45, spread: 0.7 },
};

export class GameController {
  readonly session: PracticeSession;
  private game: Phaser.Game | null = null;
  private scene: StadiumScene | null = null;
  private host: HTMLElement;
  private sound = new SoundEngine();
  private ro: ResizeObserver | null = null;
  private ui: ControllerUi;
  private uiListeners = new Set<() => void>();
  private pointerId: number | null = null;
  private path: Point[] = [];
  private keyAim: ShotParams | null = null;
  private padRadius = 52;
  private size = { w: 0, h: 0, dpr: 1 };
  private fpsSamples: number[] = [];
  private autoLow = false;
  private hintTimer: number | null = null;
  private shotsTaken = 0;
  private destroyed = false;
  private uiFrame = 0;

  constructor(host: HTMLElement) {
    this.host = host;
    const settings = loadSettings();
    this.session = new PracticeSession(settings.level);
    if (import.meta.env.DEV) this.session.subscribe(() => this.exposeDebug());
    this.ui = {
      aim: null,
      banner: null,
      hint: 'Touch the ball · drag toward goal · release to shoot',
      settings,
      reducedMotion: settings.reducedMotion ?? systemPrefersReducedMotion(),
      lowQuality: settings.quality === 'low',
      paused: false,
      layout: null,
    };
  }

  // ---------------- lifecycle ----------------

  mount(): void {
    const rect = this.host.getBoundingClientRect();
    this.size = { w: rect.width, h: rect.height, dpr: this.pickDpr() };
    const scene = new StadiumScene();
    this.scene = scene;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.host,
      backgroundColor: '#05070d',
      scale: {
        mode: Phaser.Scale.NONE,
        width: Math.max(2, Math.round(rect.width * this.size.dpr)),
        height: Math.max(2, Math.round(rect.height * this.size.dpr)),
      },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      render: { antialias: true, powerPreference: 'high-performance' },
      fps: { target: 60, smoothStep: true },
      audio: { noAudio: true },
      banner: false,
      scene: [scene],
      callbacks: {
        postBoot: (game) => {
          game.canvas.style.width = '100%';
          game.canvas.style.height = '100%';
          game.canvas.setAttribute('aria-hidden', 'true');
        },
      },
    });
    scene.events$ = {
      onCue: (cue, intensity) => this.sound.play(cue, intensity),
      onDecisive: (shotId) => this.onDecisive(shotId),
      onComplete: () => this.onComplete(),
    };
    this.game.events.once(Phaser.Core.Events.READY, () => {
      this.applySceneSettings();
      this.relayout();
      this.game?.events.on(Phaser.Core.Events.POST_STEP, (_t: number, delta: number) => this.trackFps(delta));
    });

    this.host.addEventListener('pointerdown', this.onPointerDown);
    this.host.addEventListener('pointermove', this.onPointerMove);
    this.host.addEventListener('pointerup', this.onPointerUp);
    this.host.addEventListener('pointercancel', this.onPointerCancel);
    this.host.addEventListener('lostpointercapture', this.onPointerCancel);
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    this.ro = new ResizeObserver(() => this.relayout());
    this.ro.observe(this.host);
    if (this.ui.settings.sound) {
      // Preference remembered, but audio may only start inside a gesture.
      const unlock = () => {
        if (this.ui.settings.sound) this.sound.enable();
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      };
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('pointermove', this.onPointerMove);
    this.host.removeEventListener('pointerup', this.onPointerUp);
    this.host.removeEventListener('pointercancel', this.onPointerCancel);
    this.host.removeEventListener('lostpointercapture', this.onPointerCancel);
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.ro?.disconnect();
    this.sound.disable();
    this.sound.suspend();
    if (this.hintTimer) window.clearTimeout(this.hintTimer);
    cancelAnimationFrame(this.uiFrame);
    this.game?.destroy(true);
    this.game = null;
  }

  // ---------------- UI store ----------------

  subscribeUi = (fn: () => void): (() => void) => {
    this.uiListeners.add(fn);
    return () => this.uiListeners.delete(fn);
  };

  getUi = (): ControllerUi => this.ui;

  private setUi(patch: Partial<ControllerUi>): void {
    this.ui = { ...this.ui, ...patch };
    if (import.meta.env.DEV) this.exposeDebug();
    for (const fn of this.uiListeners) fn();
  }

  /** Coalesce frequent aim updates into one React render per frame. */
  private setAimUi(aim: AimReadout | null): void {
    cancelAnimationFrame(this.uiFrame);
    if (aim === null) {
      this.setUi({ aim: null });
      return;
    }
    this.uiFrame = requestAnimationFrame(() => this.setUi({ aim }));
  }

  /** Dev-only read-only hook for automated browser tests. */
  private exposeDebug(): void {
    const snap = this.session.getSnapshot();
    (window as unknown as { __goldenrun?: unknown }).__goldenrun = {
      layout: this.ui.layout,
      phase: snap.phase,
      stats: snap.stats,
      spot: snap.spotIndex,
      last: snap.last && {
        outcome: snap.last.result.outcome,
        points: snap.last.points,
        keeper: snap.last.result.keeper.action,
        crossing: snap.last.result.crossing,
      },
    };
  }

  // ---------------- settings ----------------

  updateSettings(patch: Partial<Settings>): void {
    const settings = { ...this.ui.settings, ...patch };
    saveSettings(settings);
    if (patch.sound !== undefined) {
      if (patch.sound) this.sound.enable();
      else this.sound.disable();
    }
    if (patch.level && patch.level !== this.ui.settings.level) {
      this.session.setLevel(patch.level);
      this.cancelAim();
    }
    if (patch.quality) this.autoLow = false;
    this.setUi({
      settings,
      reducedMotion: settings.reducedMotion ?? systemPrefersReducedMotion(),
      lowQuality: settings.quality === 'low' || (settings.quality === 'auto' && this.autoLow),
    });
    this.applySceneSettings();
    if (patch.quality) this.relayout(true);
    else if (patch.level) this.relayout();
  }

  setPaused(paused: boolean): void {
    if (paused) this.cancelAim();
    this.setUi({ paused });
  }

  private applySceneSettings(): void {
    this.scene?.configure({ reducedMotion: this.ui.reducedMotion, low: this.ui.lowQuality }, this.padRadius);
  }

  private pickDpr(): number {
    const raw = window.devicePixelRatio || 1;
    const low = this.ui?.lowQuality;
    return Math.min(raw, low ? 1 : 2);
  }

  private relayout(force = false): void {
    if (!this.game || !this.scene || this.destroyed) return;
    const rect = this.host.getBoundingClientRect();
    const dpr = this.pickDpr();
    if (!force && rect.width === this.size.w && rect.height === this.size.h && dpr === this.size.dpr && this.scene.projection) {
      return;
    }
    const resized = rect.width !== this.size.w || rect.height !== this.size.h || dpr !== this.size.dpr;
    // A real viewport change invalidates an in-progress drag; a quality-only refresh must not.
    if (resized && this.pointerId !== null) this.cancelAim();
    this.size = { w: rect.width, h: rect.height, dpr };
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    this.game.scale.resize(w, h);
    this.padRadius = Math.max(40, Math.min(64, Math.min(rect.width, rect.height) * 0.11));
    this.applySceneSettings();
    const scenario = getScenario(this.session.scenarioId)!;
    this.scene.layout(scenario, w, h, dpr);
    const proj = new Projection(w, h, scenario);
    const ball = proj.project(scenario.ballX, BALL_RADIUS, 0);
    const top = proj.project(0, GOAL_HEIGHT, scenario.distance);
    const bottom = proj.project(0, 0, scenario.distance);
    if (ball && top && bottom) {
      this.setUi({
        layout: {
          ball: { x: ball.x / dpr, y: ball.y / dpr },
          goalTop: top.y / dpr,
          goalBottom: bottom.y / dpr,
          padRadius: this.padRadius,
        },
      });
    }
    if (this.keyAim) this.pushKeyAim();
  }

  private trackFps(delta: number): void {
    if (this.ui.settings.quality !== 'auto' || this.autoLow) return;
    this.fpsSamples.push(delta);
    if (this.fpsSamples.length < 180) return;
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    const busy = this.pointerId !== null || this.keyAim !== null || this.session.getSnapshot().phase !== 'ready';
    if (avg > 26 && busy) {
      // Never swap quality mid-gesture or mid-shot: re-check on the next calm frame.
      this.fpsSamples.shift();
      return;
    }
    this.fpsSamples = [];
    if (avg > 26) {
      // Sustained < ~38 fps: shed decorative work, keep gameplay identical.
      this.autoLow = true;
      this.setUi({ lowQuality: true });
      this.applySceneSettings();
      this.relayout(true);
    }
  }

  // ---------------- sound ----------------

  toggleSound(): void {
    this.updateSettings({ sound: !this.ui.settings.sound });
    if (this.ui.settings.sound) this.sound.play('tick');
  }

  // ---------------- shot flow ----------------

  private canAim(): boolean {
    const phase = this.session.getSnapshot().phase;
    return !this.ui.paused && (phase === 'ready' || phase === 'aiming') && !!this.scene?.projection;
  }

  private gestureFrame(): GestureFrame | null {
    const pad = this.ui.layout?.ball;
    if (!pad) return null;
    return { padCenter: pad, padRadius: this.padRadius, refLength: referenceLength(this.size.w, this.size.h) };
  }

  private showAim(params: ShotParams, source: 'pointer' | 'keyboard', strike: number, path: Point[] | null): void {
    const cmd = makeCommand(this.session.scenarioId, params);
    const preview = previewShot(cmd);
    const level = this.ui.settings.level;
    this.scene?.setAim({
      preview,
      power: cmd.power,
      aimY: cmd.aimY,
      spin: cmd.spin,
      strike,
      path,
      reveal: PREVIEW[level].reveal,
      reticleSpread: PREVIEW[level].spread,
    });
    this.setAimUi({
      power: cmd.power,
      aimY: cmd.aimY,
      spin: cmd.spin,
      aimX: cmd.aimX,
      onTarget: preview.crossing?.inside ?? false,
      source,
    });
  }

  private cancelAim(): void {
    if (this.pointerId !== null) {
      try {
        this.host.releasePointerCapture(this.pointerId);
      } catch {
        /* already released */
      }
    }
    this.pointerId = null;
    this.path = [];
    this.keyAim = null;
    this.scene?.setAim(null);
    this.setAimUi(null);
    if (this.session.getSnapshot().phase === 'aiming') this.session.setPhase('ready');
  }

  private shoot(params: ShotParams): void {
    const cmd = makeCommand(this.session.scenarioId, params);
    const shot = this.session.shoot(cmd);
    this.pointerId = null;
    this.path = [];
    this.keyAim = null;
    this.scene?.setAim(null);
    this.setAimUi(null);
    if (!shot) return;
    this.shotsTaken++;
    this.setUi({ banner: null, hint: null });
    this.scene?.playShot(shot.shotId, shot.result);
  }

  private onDecisive(shotId: number): void {
    const resolved = this.session.resolve(shotId);
    if (!resolved) return;
    const r: ShotResult = resolved.result;
    if (r.goal) this.sound.play('goal');
    else this.sound.play('groan');
    this.setUi({ banner: resolved });
  }

  private onComplete(): void {
    const prevSpot = this.session.getSnapshot().spotIndex;
    this.session.next();
    this.setUi({ banner: null });
    this.scene?.resetBall();
    if (this.session.getSnapshot().spotIndex !== prevSpot) this.relayout(true);
    if (this.shotsTaken === 1 && this.session.getSnapshot().stats.goals === 0) {
      this.flashHint('Curve your drag to bend it · strike low on the ball to lift it');
    }
  }

  private flashHint(text: string): void {
    this.setUi({ hint: text });
    if (this.hintTimer) window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.setUi({ hint: null }), 4200);
  }

  /** Skip the celebration / reaction and ready the next ball. */
  skip(): void {
    const phase = this.session.getSnapshot().phase;
    if (phase === 'flight' || phase === 'resolution') this.scene?.skip();
  }

  restart(): void {
    this.cancelAim();
    this.scene?.abandon();
    this.session.reset();
    this.shotsTaken = 0;
    this.setUi({ banner: null, hint: 'Touch the ball · drag toward goal · release to shoot' });
    this.relayout(true);
  }

  selectSpot(index: number): void {
    if (this.session.inFlight) return;
    this.cancelAim();
    this.session.selectSpot(index);
    this.relayout(true);
  }

  // ---------------- pointer input ----------------

  private localPoint(e: PointerEvent): Point {
    const r = this.host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.sound.unlock();
    const phase = this.session.getSnapshot().phase;
    if (phase === 'flight' || phase === 'resolution') {
      // Tap to skip only once the outcome is shown.
      if (phase === 'resolution') this.skip();
      return;
    }
    if (!this.canAim() || this.pointerId !== null) return;
    const frame = this.gestureFrame();
    if (!frame) return;
    const p = this.localPoint(e);
    const d = Math.hypot(p.x - frame.padCenter.x, p.y - frame.padCenter.y);
    if (d > frame.padRadius * 1.6) {
      this.flashHint('Start your swipe on the ball');
      return;
    }
    e.preventDefault();
    this.keyAim = null;
    this.pointerId = e.pointerId;
    try {
      this.host.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers refuse capture for synthetic events */
    }
    this.path = [p];
    this.session.setPhase('aiming');
    this.setUi({ hint: null });
    this.updatePointerAim();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ce of events.length ? events : [e]) this.path.push(this.localPoint(ce));
    if (this.path.length > 600) this.path.splice(1, this.path.length - 600);
    this.updatePointerAim();
  };

  private normalisedPath(): Point[] {
    return resamplePath(this.path, Math.max(4, referenceLength(this.size.w, this.size.h) * 0.02));
  }

  private updatePointerAim(): void {
    const frame = this.gestureFrame();
    if (!frame) return;
    const pts = this.normalisedPath();
    const reading = readGesture(pts, frame);
    const strike = Math.max(-1, Math.min(1, (this.path[0]!.y - frame.padCenter.y) / frame.padRadius));
    this.showAim(reading.params, 'pointer', strike, this.path);
    if (reading.cancel) this.setAimUi({ ...this.ui.aim!, power: 0 });
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.path.push(this.localPoint(e));
    const frame = this.gestureFrame();
    const reading = frame ? readGesture(this.normalisedPath(), frame) : null;
    try {
      this.host.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (!reading || reading.cancel) {
      this.cancelAim();
      this.flashHint('Drag farther toward the goal to shoot');
      return;
    }
    this.shoot(reading.params);
  };

  private onPointerCancel = (e: Event): void => {
    if (this.pointerId === null) return;
    if ('pointerId' in e && (e as PointerEvent).pointerId !== this.pointerId) return;
    // A cancelled or interrupted gesture never shoots.
    if (e.type === 'lostpointercapture' && this.session.getSnapshot().phase !== 'aiming') return;
    this.cancelAim();
  };

  // ---------------- keyboard ----------------

  private pushKeyAim(): void {
    if (!this.keyAim) return;
    // Inverse of elevationFromStrike: aimY = 450 + strike * 550.
    const strike = (this.keyAim.aimY - 450) / 550;
    this.showAim(this.keyAim, 'keyboard', Math.max(-1, Math.min(1, strike)), null);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.ui.paused || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const phase = this.session.getSnapshot().phase;
    const key = e.key;
    if ((phase === 'flight' || phase === 'resolution') && (key === 'Enter' || key === ' ')) {
      if (phase === 'resolution') this.skip();
      e.preventDefault();
      return;
    }
    if (!this.canAim() || this.pointerId !== null) return;
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', 'q', 'Q', 'e', 'E', 'Enter', ' ', 'Escape'];
    if (!handled.includes(key)) return;
    e.preventDefault();
    this.sound.unlock();
    if (key === 'Escape') {
      this.cancelAim();
      return;
    }
    const a = this.keyAim ?? { aimX: 0, aimY: 450, power: 600, spin: 0 };
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    switch (key) {
      case 'ArrowLeft':
        a.aimX = clamp(a.aimX - KEY_STEPS.aimX, -1000, 1000);
        break;
      case 'ArrowRight':
        a.aimX = clamp(a.aimX + KEY_STEPS.aimX, -1000, 1000);
        break;
      case 'ArrowUp':
        a.aimY = clamp(a.aimY + KEY_STEPS.aimY, 0, 1000);
        break;
      case 'ArrowDown':
        a.aimY = clamp(a.aimY - KEY_STEPS.aimY, 0, 1000);
        break;
      case 'w':
      case 'W':
        a.power = clamp(a.power + KEY_STEPS.power, 0, 1000);
        break;
      case 's':
      case 'S':
        a.power = clamp(a.power - KEY_STEPS.power, 0, 1000);
        break;
      case 'q':
      case 'Q':
        a.spin = clamp(a.spin - KEY_STEPS.spin, -1000, 1000);
        break;
      case 'e':
      case 'E':
        a.spin = clamp(a.spin + KEY_STEPS.spin, -1000, 1000);
        break;
      case 'Enter':
      case ' ':
        if (this.keyAim) {
          this.shoot(this.keyAim);
          return;
        }
        break;
    }
    this.keyAim = a;
    this.session.setPhase('aiming');
    this.setUi({ hint: null });
    this.pushKeyAim();
  };

  // ---------------- interruptions ----------------

  private onVisibility = (): void => {
    if (document.hidden) {
      this.cancelAim();
      this.sound.suspend();
    } else {
      this.sound.unlock();
    }
  };

  private onBlur = (): void => {
    if (this.pointerId !== null) this.cancelAim();
  };
}

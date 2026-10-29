/** Procedurally generated textures (original artwork, no external assets). */
import type Phaser from 'phaser';

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

export function createTextures(scene: Phaser.Scene): void {
  // Football: white leather, dark pentagon panels with gold piping, soft shading.
  canvasTexture(scene, 'ball', 128, 128, (ctx) => {
    const c = 64;
    const r = 60;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#f7f5ef';
    ctx.fillRect(0, 0, 128, 128);
    const panel = (x: number, y: number, size: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * Math.PI * 2;
        const px = x + Math.cos(a) * size;
        const py = y + Math.sin(a) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#14161c';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#e8b84a';
      ctx.stroke();
    };
    panel(c, c, 17, -Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + Math.PI / 5;
      panel(c + Math.cos(a) * 48, c + Math.sin(a) * 48, 15, a + Math.PI);
    }
    // Seams.
    ctx.strokeStyle = 'rgba(40,40,48,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 17, c + Math.sin(a) * 17);
      ctx.lineTo(c + Math.cos(a) * 36, c + Math.sin(a) * 36);
      ctx.stroke();
    }
    ctx.restore();
    // Spherical shading (lit from the floodlights above/behind the goal).
    const g = ctx.createRadialGradient(c - 18, c - 22, 6, c, c, r);
    g.addColorStop(0, 'rgba(255,250,235,0.35)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'shadow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  canvasTexture(scene, 'glow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.3, 'rgba(255,210,130,0.45)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  canvasTexture(scene, 'confetti', 8, 14, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 8, 14);
  });

  canvasTexture(scene, 'spark', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
}

/**
 * Share cards drawn on the player's device (canvas → PNG). No third-party
 * image service; the image never leaves the device unless the player shares it.
 */
export interface CardSpec {
  kicker: string;
  title: string;
  big: string;
  sub: string;
  url: string;
}

export async function renderCard(spec: CardSpec): Promise<Blob | null> {
  const W = 1200;
  const H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  await document.fonts?.ready;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#05070d');
  bg.addColorStop(0.6, '#0b1220');
  bg.addColorStop(1, '#17552a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Floodlight glow.
  const glow = ctx.createRadialGradient(W * 0.78, 0, 0, W * 0.78, 0, 520);
  glow.addColorStop(0, 'rgba(255,216,140,0.35)');
  glow.addColorStop(1, 'rgba(255,216,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // Goal frame motif.
  ctx.strokeStyle = 'rgba(242,239,230,0.18)';
  ctx.lineWidth = 10;
  ctx.strokeRect(700, 300, 420, 200);
  ctx.fillStyle = '#8e1b2a';
  ctx.fillRect(0, H - 14, W, 14);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e8b84a';
  ctx.font = '600 28px "Azeret Mono", monospace';
  ctx.fillText(spec.kicker.toUpperCase(), 72, 110);
  ctx.fillStyle = '#f2efe6';
  ctx.font = 'italic 800 72px "Barlow Condensed", sans-serif';
  ctx.fillText(spec.title.toUpperCase(), 72, 200, W - 144);
  const gold = ctx.createLinearGradient(72, 0, 700, 0);
  gold.addColorStop(0, '#b8862b');
  gold.addColorStop(0.5, '#ffd877');
  gold.addColorStop(1, '#e8b84a');
  ctx.fillStyle = gold;
  ctx.font = 'italic 800 190px "Barlow Condensed", sans-serif';
  ctx.fillText(spec.big, 66, 400, W - 144);
  ctx.fillStyle = 'rgba(242,239,230,0.85)';
  ctx.font = '600 34px "Figtree", sans-serif';
  ctx.fillText(spec.sub, 72, 470, W - 144);
  ctx.fillStyle = '#e8b84a';
  ctx.font = 'italic 800 40px "Barlow Condensed", sans-serif';
  ctx.fillText('THE GOLDEN RUN', 72, 565);
  ctx.fillStyle = 'rgba(242,239,230,0.6)';
  ctx.font = '500 24px "Azeret Mono", monospace';
  ctx.fillText(spec.url.replace(/^https?:\/\//, ''), 390, 563);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

/** Native share sheet when available, otherwise copy the link and download the card. */
export async function shareCard(spec: CardSpec, text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const blob = await renderCard(spec);
  const file = blob ? new File([blob], 'golden-run.png', { type: 'image/png' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (file && nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, url: spec.url });
      return 'shared';
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ text, url: spec.url });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
  }
  try {
    await navigator.clipboard.writeText(`${text} ${spec.url}`);
  } catch {
    /* clipboard blocked */
  }
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'golden-run.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return 'copied';
}

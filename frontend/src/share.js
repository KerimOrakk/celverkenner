// Draws a quiz result as a picture (1200 x 630, the size social apps expect)
// and shares it with the Web Share API, or downloads it when that is missing.

const W = 1200;
const H = 630;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A little cell, like the favicon, so the card is recognisable. */
function drawCell(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(76, 175, 80, 0.22)';
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8E5BD9';
  ctx.beginPath();
  ctx.arc(cx + r * 0.18, cy - r * 0.15, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E040FB';
  ctx.beginPath();
  ctx.arc(cx + r * 0.22, cy - r * 0.2, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF8800';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.45, cy + r * 0.35, r * 0.27, r * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.arc(cx + r * 0.45, cy + r * 0.5, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fitText(ctx, text, maxWidth, size, weight = 700) {
  let fontSize = size;
  do {
    ctx.font = `${weight} ${fontSize}px "Bricolage Grotesque", "Atkinson Hyperlegible", system-ui, sans-serif`;
    fontSize -= 2;
  } while (ctx.measureText(text).width > maxWidth && fontSize > 18);
}

/**
 * @param {object} result { title, mode, cells, time, mistakesLine, footer, url }
 * @returns {Promise<Blob>} PNG
 */
export async function renderResultCard(result) {
  try {
    await document.fonts?.load('700 60px "Bricolage Grotesque"');
  } catch {
    // system font it is
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0F0F1A';
  ctx.fillRect(0, 0, W, H);
  // a soft glow behind the time
  const glow = ctx.createRadialGradient(W * 0.32, H * 0.55, 20, W * 0.32, H * 0.55, 420);
  glow.addColorStop(0, 'rgba(0, 229, 255, 0.16)');
  glow.addColorStop(1, 'rgba(0, 229, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1A1A2D';
  roundRect(ctx, 48, 48, W - 96, H - 96, 32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawCell(ctx, 128, 132, 40);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  fitText(ctx, result.title, 500, 36);
  ctx.fillText(result.title, 190, 132);

  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  fitText(ctx, result.mode, 700, 30, 400);
  ctx.fillText(result.mode, 96, 224);

  ctx.fillStyle = '#00E5FF';
  fitText(ctx, result.time, 620, 150);
  ctx.fillText(result.time, 92, 340);

  ctx.fillStyle = '#FFFFFF';
  fitText(ctx, result.cells, 1000, 32, 400);
  ctx.fillText(result.cells, 96, 448);

  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  fitText(ctx, result.mistakesLine, 1000, 28, 400);
  ctx.fillText(result.mistakesLine, 96, 496);

  ctx.fillStyle = '#81C784';
  fitText(ctx, result.footer, 1000, 30);
  ctx.fillText(result.footer, 96, 556);

  drawCell(ctx, W - 190, H - 150, 90);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Share the card + link with the system share sheet; otherwise download the picture. Returns what happened. */
export async function shareResultCard(blob, { title, text, url, filename }) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ title, text, url, files: [file] });
      else await navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  try {
    await navigator.clipboard?.writeText(url);
    return 'downloaded-copied';
  } catch {
    return 'downloaded';
  }
}

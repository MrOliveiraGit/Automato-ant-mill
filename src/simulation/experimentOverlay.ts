import type { ColumnSettings } from "./initialConditions.js";
import type { MillSnapshot } from "./millMetrics.js";

// mesma inversão do Grid.draw(): x = linha → eixo vertical, y = coluna → horizontal
function toPixel(x: number, y: number, cellSize: number): [number, number] {
  return [y * cellSize + cellSize / 2, x * cellSize + cellSize / 2];
}

export function drawTrailEndpoints(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  trails: ColumnSettings,
) {
  ctx.save();
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const [label, [x, y]] of [
    ["A", trails.pointA],
    ["B", trails.pointB],
  ] as const) {
    const [px, py] = toPixel(x, y, cellSize);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "black";
    ctx.fillText(label, px, py);
  }

  ctx.restore();
}

/*
 * Seta no canto superior direito com a direção e a intensidade do vento
 * efetivamente aplicado ao feromônio. O comprimento cresce até a intensidade
 * "forte" (0.4) e satura daí em diante; o valor exato fica no texto.
 */
export function drawWindIndicator(
  ctx: CanvasRenderingContext2D,
  velocity: [number, number],
  label: string,
) {
  const [vx, vy] = velocity;
  const speed = Math.hypot(vx, vy);

  const originX = ctx.canvas.width - 44;
  const originY = 44;

  ctx.save();

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(originX, originY, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#333";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${label} ${speed.toFixed(2)}`, originX, originY + 30);

  if (speed > 0) {
    const length = 10 + 22 * Math.min(1, speed / 0.4);

    const unitX = vy / speed;
    const unitY = vx / speed;

    const tailX = originX - (unitX * length) / 2;
    const tailY = originY - 4 - (unitY * length) / 2;
    const tipX = originX + (unitX * length) / 2;
    const tipY = originY - 4 + (unitY * length) / 2;

    ctx.strokeStyle = "darkorange";
    ctx.fillStyle = "darkorange";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    const angle = Math.atan2(unitY, unitX);

    ctx.beginPath();
    ctx.moveTo(tipX + unitX * 4, tipY + unitY * 4);
    ctx.lineTo(
      tipX - 8 * Math.cos(angle - 0.5),
      tipY - 8 * Math.sin(angle - 0.5),
    );
    ctx.lineTo(
      tipX - 8 * Math.cos(angle + 0.5),
      tipY - 8 * Math.sin(angle + 0.5),
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function drawMillMarker(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  snapshot: MillSnapshot,
) {
  if (!snapshot.rotating) {
    return;
  }

  // o centroide está em coordenadas contínuas, não em índice de célula
  const px = snapshot.centerY * cellSize;
  const py = snapshot.centerX * cellSize;

  ctx.save();
  ctx.strokeStyle = "magenta";
  ctx.fillStyle = "magenta";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(px, py, Math.max(1, snapshot.meanRadius) * cellSize, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

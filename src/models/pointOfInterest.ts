export class PointOfInterest {
  private remainingTicks: number;

  constructor(
    public x: number,
    public y: number,
    private lifespan: number = 300,
  ) {
    this.remainingTicks = lifespan;
  }

  /*
   * Consome uma parte da "comida" a cada tick. Quando o POI
   * se esgota (remainingTicks <= 0), AntRules o remove do grid.
   */
  tick(): void {
    if (this.remainingTicks > 0) {
      this.remainingTicks--;
    }
  }

  isExpired(): boolean {
    return this.remainingTicks <= 0;
  }

  draw(ctx: CanvasRenderingContext2D, cellSize: number) {
    const alpha = this.remainingTicks / this.lifespan;

    ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;

    ctx.beginPath();

    ctx.arc(
      this.y * cellSize + cellSize / 2,
      this.x * cellSize + cellSize / 2,
      cellSize / 3,
      0,
      Math.PI * 2,
    );

    ctx.fill();
  }
}

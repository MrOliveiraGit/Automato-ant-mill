export class PointOfInterest {
  constructor(
    public x: number,
    public y: number,
  ) {}

  draw(ctx: CanvasRenderingContext2D, cellSize: number) {
    ctx.fillStyle = "red";

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

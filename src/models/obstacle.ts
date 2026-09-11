export class Obstacle {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
  ) {}

  contains(x: number, y: number): boolean {
    return (
      x >= this.x &&
      x < this.x + this.height &&
      y >= this.y &&
      y < this.y + this.width
    );
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cellSize: number,
  ) {
    ctx.fillStyle = "black";

    ctx.fillRect(
      this.y * cellSize,
      this.x * cellSize,
      this.width * cellSize,
      this.height * cellSize,
    );
  }
}
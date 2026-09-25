import { Cell } from "./cell.js";

export class Grid {
  public cells: Cell[][];

  constructor(
    public rows: number,

    public cols: number,

    public cellSize: number,

    // ausente quando a simulação roda sem navegador (experimentos em lote)
    private ctx: CanvasRenderingContext2D | null = null,
  ) {
    this.cells = Array.from(
      {
        length: rows,
      },

      (_, x) =>
        Array.from(
          {
            length: cols,
          },

          (_, y) => new Cell(x, y),
        ),
    );
  }

  get(
    x: number,

    y: number,
  ): Cell | undefined {
    if (x < 0 || y < 0 || x >= this.rows || y >= this.cols) {
      return undefined;
    }

    return this.cells[x][y];
  }

  draw() {
    if (!this.ctx) {
      throw new Error("Grid.draw() requires a canvas context");
    }

    const maxPheromone = 10;

    this.ctx.clearRect(
      0,

      0,

      this.ctx.canvas.width,

      this.ctx.canvas.height,
    );

    for (let x = 0; x < this.rows; x++) {
      for (let y = 0; y < this.cols; y++) {
        const cell = this.cells[x][y];

        /*
                Formiga
                */

        if (cell.ants > 0) {
          this.ctx.fillStyle = "green";
        }

        /*
                Feromônio
                */
        else if (cell.pheromone > 0.001) {
          const alpha = Math.min(
            cell.pheromone / 0.5,

            1,
          );

          this.ctx.fillStyle = `rgba(0,0,255,${alpha})`;
        }

        /*
                Vazio
                */
        else {
          this.ctx.fillStyle = "white";
        }

        this.ctx.fillRect(
          y * this.cellSize,

          x * this.cellSize,

          this.cellSize,

          this.cellSize,
        );
      }
    }
  }
}

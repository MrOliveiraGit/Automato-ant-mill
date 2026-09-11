import { Grid } from "../models/grid.js";
import type { Rules } from "./rules.js";

export class ConwayRules implements Rules {
  public update(grid: Grid): void {
    const next: boolean[][] = Array.from({ length: grid.rows }, () =>
      Array(grid.cols).fill(false),
    );

    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        let neighbours = 0;

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;

            if (grid.get(x + dx, y + dy)?.alive) neighbours++;
          }
        }

        const alive = grid.get(x, y)!.alive;

        next[x][y] = alive
          ? neighbours === 2 || neighbours === 3
          : neighbours === 3;
      }
    }

    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        grid.get(x, y)!.alive = next[x][y];
      }
    }
  }
}

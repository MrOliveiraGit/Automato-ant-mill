import { Grid } from "../models/grid.js";

export interface Rules {
  update(grid: Grid): void;
}

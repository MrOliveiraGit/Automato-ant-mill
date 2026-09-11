import { Grid } from "../models/grid";
import { Ant } from "../models/ant";

export interface InitialCondition {
  initialize(grid: Grid, ants: Ant[]): void;
}

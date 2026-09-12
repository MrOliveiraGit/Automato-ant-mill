export class Cell {
  public pheromone: number = 0;
  public ants: number = 0;

  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

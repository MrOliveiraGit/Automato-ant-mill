import type { Ant } from "../models/ant.js";

export class LevyFlight {
  constructor(
    private mu: number = 1.5,
    private maxLength: number = 20,
  ) {}

  move(ant: Ant): [number, number] {
    // Se não está em um voo, começa um novo
    if (ant.levyRemainingSteps <= 0) {
      this.startFlight(ant);
    }

    const nx = ant.x + ant.levyDirectionX;
    const ny = ant.y + ant.levyDirectionY;

    ant.levyRemainingSteps--;

    return [nx, ny];
  }

  isFlying(ant: Ant): boolean {
    return ant.levyRemainingSteps > 0;
  }

  private startFlight(ant: Ant): void {
    const directions: [number, number][] = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    const direction = directions[Math.floor(Math.random() * directions.length)];

    ant.levyDirectionX = direction[0];
    ant.levyDirectionY = direction[1];

    let length = Math.pow(Math.random(), -1 / (this.mu - 1));

    length = Math.min(length, this.maxLength);

    ant.levyRemainingSteps = Math.max(1, Math.floor(length));
  }
}

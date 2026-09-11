import type { Movement } from "./movement.js";

export class RandomWalk implements Movement {
  move(x: number, y: number): [number, number] {
    const directions: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    const step = directions[Math.floor(Math.random() * directions.length)];

    return [x + step[0], y + step[1]];
  }
}

import { Grid } from "./models/grid.js";
import { Ant } from "./models/ant.js";
import { PointOfInterest } from "./models/pointOfInterest.js";
import { AntRules } from "./rules/antsRules.js";
import { Obstacle } from "./models/obstacle.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const ctx = canvas.getContext("2d");

if (!ctx) throw new Error();

const cellSize = 6;
const rows = 100;
const cols = 100;

canvas.width = cols * cellSize;
canvas.height = rows * cellSize;

const grid = new Grid(rows, cols, cellSize, ctx);

const ants: Ant[] = [];
const pointsOfInterest: PointOfInterest[] = [];
const obstacles: Obstacle[] = [];

const numberOfAnts = 200;

const spawnWidth = 0.2;
const spawnHeight = 0.3;

for (let i = 0; i < numberOfAnts; i++) {
  const x = Math.floor(Math.random() * grid.rows * spawnWidth);

  const y = Math.floor(Math.random() * grid.cols * spawnHeight);

  ants.push(new Ant(x, y));
}

/*
 * Clique esquerdo → cria um POI
 */

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();

  const y = Math.floor((event.clientX - rect.left) / grid.cellSize);

  const x = Math.floor((event.clientY - rect.top) / grid.cellSize);

  console.log("POI:", { x, y });

  pointsOfInterest.push(new PointOfInterest(x, y));
});

/*
 * Clique direito → cria um obstáculo
 */

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();

  const y = Math.floor((event.clientX - rect.left) / grid.cellSize);

  const x = Math.floor((event.clientY - rect.top) / grid.cellSize);

  console.log("Obstáculo:", { x, y });

  obstacles.push(
    new Obstacle(
      x,
      y,
      10, // largura
      5, // altura
    ),
  );
});
/*
Agora o AntRules recebe os POIs.
*/

const rules = new AntRules(ants, pointsOfInterest, obstacles);

setInterval(() => {
  rules.update(grid);

  grid.draw();

  for (const poi of pointsOfInterest) {
    poi.draw(ctx, cellSize);
  }

  for (const obstacle of obstacles) {
    obstacle.draw(ctx, cellSize);
  }
}, 100);

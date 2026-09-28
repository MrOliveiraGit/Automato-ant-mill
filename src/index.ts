import { Obstacle } from "./models/obstacle.js";
import {
  SCENARIOS,
  WIND_EXPERIMENT,
  WIND_PRESETS,
  createSimulation,
  nearWallFraction,
  type Scenario,
  type Simulation,
} from "./simulation/windExperiment.js";
import type { MillSnapshot } from "./simulation/millMetrics.js";
import {
  drawMillMarker,
  drawTrailEndpoints,
  drawWindIndicator,
} from "./simulation/experimentOverlay.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLElement;

const ctx = canvas.getContext("2d");

if (!ctx) throw new Error();

const cellSize = 6;

canvas.width = WIND_EXPERIMENT.cols * cellSize;
canvas.height = WIND_EXPERIMENT.rows * cellSize;

/*
 * ?scenario=random|column|ring|trails|classic escolhe a condição inicial
 * (ver SCENARIOS); o padrão é o ambiente neutro.
 */
const requested = new URLSearchParams(location.search).get("scenario");

const scenario: Scenario =
  SCENARIOS.find((name) => name === requested) ?? "random";

/*
 * Obstáculos colocados com o mouse sobrevivem ao reinício, para que as
 * intensidades de vento sejam comparadas sobre a mesma configuração.
 */
const placedObstacles: Obstacle[] = [];

let presetIndex = 0;
let tick = 0;

const start = (): Simulation => {
  tick = 0;

  return createSimulation({
    scenario,
    windStrength: WIND_PRESETS[presetIndex].strength,
    seed: WIND_EXPERIMENT.seed,
    ctx,
    cellSize,
    obstacles: placedObstacles,
  });
};

let simulation = start();

function cellAt(event: MouseEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();

  return [
    Math.floor((event.clientY - rect.top) / cellSize),
    Math.floor((event.clientX - rect.left) / cellSize),
  ];
}

/*
 * Clique direito → cria um obstáculo
 */
canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();

  const [x, y] = cellAt(event);

  console.log("Obstáculo:", { x, y });

  const obstacle = new Obstacle(
    x,
    y,
    10, // largura
    5, // altura
  );

  placedObstacles.push(obstacle);
  simulation.obstacles.push(obstacle);
});

/*
 * 1–4 → escolhe a intensidade do vento e reinicia da mesma condição inicial;
 * R → reinicia sem trocar o vento.
 */
window.addEventListener("keydown", (event) => {
  const preset = ["1", "2", "3", "4"].indexOf(event.key);

  if (preset >= 0) {
    presetIndex = preset;
    simulation = start();
  } else if (event.key.toLowerCase() === "r") {
    simulation = start();
  }
});

function describe(snapshot: MillSnapshot): string {
  const summary = simulation.metrics.summary();
  const [vx, vy] = simulation.rules.advectionVelocity();
  const walls = nearWallFraction(simulation.ants, simulation.grid);
  const { minParticipants, minAlignment } = WIND_EXPERIMENT.metrics;

  const mill = snapshot.rotating
    ? `YES — episode ${snapshot.episodeTicks} ticks, ${snapshot.episodeRotations.toFixed(2)} rotations`
    : `no (needs ≥ ${minParticipants} looping ants with alignment ≥ ${minAlignment})`;

  return [
    `Wind: ${WIND_PRESETS[presetIndex].name} — v = (${vx.toFixed(3)}, ${vy.toFixed(3)}) cells/tick`,
    `  [1] no wind  [2] weak  [3] moderate  [4] strong  [R] restart  ` +
      `[right-click] obstacle   seed ${WIND_EXPERIMENT.seed}, tick ${tick}`,
    `Scenario: ${scenario}   (?scenario=${SCENARIOS.join("|")})`,
    `Mill: ${mill}`,
    `  looping ants ${snapshot.participants} (${snapshot.sense > 0 ? "counter-clockwise" : "clockwise"}), ` +
      `alignment ${snapshot.alignment.toFixed(2)}, order ${snapshot.order.toFixed(2)}, ` +
      `radius ${snapshot.meanRadius.toFixed(1)}, ω ${snapshot.angularVelocity.toFixed(3)} rad/tick`,
    `  run so far: rotating ${((100 * summary.rotatingTicks) / Math.max(1, summary.ticks)).toFixed(1)}% of ticks, ` +
      `longest episode ${summary.longestEpisodeTicks} ticks, max ${summary.maxEpisodeRotations.toFixed(2)} rotations`,
    `Ants within 2 cells of the grid edge: ${(100 * walls).toFixed(0)}%`,
  ].join("\n");
}

setInterval(() => {
  simulation.rules.update(simulation.grid);

  const snapshot = simulation.metrics.measure(simulation.ants);

  tick++;

  simulation.grid.draw();

  for (const obstacle of simulation.obstacles) {
    obstacle.draw(ctx, cellSize);
  }

  if (scenario === "trails") {
    drawTrailEndpoints(ctx, cellSize, WIND_EXPERIMENT.trails);
  } else if (scenario === "column") {
    drawTrailEndpoints(ctx, cellSize, WIND_EXPERIMENT.column);
  }

  drawMillMarker(ctx, cellSize, snapshot);
  drawWindIndicator(
    ctx,
    simulation.rules.advectionVelocity(),
    WIND_PRESETS[presetIndex].name,
  );

  hud.textContent = describe(snapshot);
}, 100);

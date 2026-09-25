import { Grid } from "../models/grid.js";
import { Ant } from "../models/ant.js";
import { Obstacle } from "../models/obstacle.js";
import { Wind } from "../models/wind.js";
import type { PointOfInterest } from "../models/pointOfInterest.js";
import { AntRules } from "../rules/antsRules.js";
import {
  CornerCluster,
  TwoWayTrails,
  type TrailSettings,
} from "./initialConditions.js";
import {
  MillMetrics,
  type MillMetricsSettings,
  type MillRunSummary,
} from "./millMetrics.js";

/*
 * Intensidades comparadas no experimento, em células/tick. O que importa
 * fisicamente é o alcance da advecção durante a vida do feromônio,
 * strength / evaporation: ~1 célula (fraco), ~3 células (moderado, da ordem
 * de trailDistance / 2) e ~8 células (forte, maior que a distância entre as
 * pistas).
 */
export const WIND_PRESETS = [
  { name: "no wind", strength: 0 },
  { name: "weak", strength: 0.05 },
  { name: "moderate", strength: 0.15 },
  { name: "strong", strength: 0.4 },
];

// obstáculos (linha, coluna, largura em colunas, altura em linhas)
export const OBSTACLE_LAYOUTS = {
  none: [],
  // no vão entre as duas pistas, sem tocar nenhuma delas
  gap: [{ x: 49, y: 35, width: 30, height: 3 }],
  // atravessando as duas pistas no meio do caminho entre A e B
  block: [{ x: 42, y: 48, width: 4, height: 17 }],
} satisfies Record<
  string,
  { x: number; y: number; width: number; height: number }[]
>;

export type ObstacleLayout = keyof typeof OBSTACLE_LAYOUTS;

export const WIND_EXPERIMENT = {
  rows: 100,
  cols: 100,
  numberOfAnts: 200,
  seed: 1,
  layout: "none" as ObstacleLayout,

  // (linha, coluna): perpendicular às pistas, ou seja, vento cruzado
  windDirection: [1, 0] as [number, number],

  trails: {
    pointA: [50, 20],
    pointB: [50, 80],
    trailDistance: 6,
    trailStrength: 5,
    trailWidth: 1,
    headingJitter: 0.3,
  } satisfies TrailSettings,

  metrics: {
    displacementWindow: 5,
    minSpeed: 0.2,
    maxTurnPerTick: Math.PI / 3,
    windingWindow: 300,
    minTurnConsistency: 0.3,
    minParticipants: 15,
    minAlignment: 0.8,
    centerTolerance: 3,
  } satisfies MillMetricsSettings,

  // uma corrida conta como "formou mill" se algum episódio rotacional
  // completou pelo menos esse número de voltas
  minRotations: 1,

  ticksPerRun: 2000,
};

export type Scenario = "trails" | "classic";

export interface SimulationOptions {
  scenario: Scenario;
  windStrength: number;
  seed: number;
  layout?: ObstacleLayout | undefined;
  ctx?: CanvasRenderingContext2D | undefined;
  cellSize?: number | undefined;
  obstacles?: Obstacle[] | undefined;
  pointsOfInterest?: PointOfInterest[] | undefined;
}

export interface Simulation {
  grid: Grid;
  ants: Ant[];
  pointsOfInterest: PointOfInterest[];
  obstacles: Obstacle[];
  wind: Wind;
  rules: AntRules;
  metrics: MillMetrics;
}

export function createSimulation(options: SimulationOptions): Simulation {
  const config = WIND_EXPERIMENT;

  const grid = new Grid(
    config.rows,
    config.cols,
    options.cellSize ?? 6,
    options.ctx ?? null,
  );

  const layout =
    options.scenario === "trails" ? (options.layout ?? config.layout) : "none";

  const obstacles = [
    ...OBSTACLE_LAYOUTS[layout].map(
      (o) => new Obstacle(o.x, o.y, o.width, o.height),
    ),
    ...(options.obstacles ?? []),
  ];

  const pointsOfInterest = [...(options.pointsOfInterest ?? [])];

  const ants = Array.from({ length: config.numberOfAnts }, () => new Ant(0, 0));

  const initialCondition =
    options.scenario === "trails"
      ? new TwoWayTrails(config.trails, options.seed, (x, y) =>
          obstacles.some((obstacle) => obstacle.contains(x, y)),
        )
      : new CornerCluster(options.seed);

  initialCondition.initialize(grid, ants);

  const wind = new Wind(
    config.windDirection[0],
    config.windDirection[1],
    options.windStrength,
  );

  const rules = new AntRules(
    ants,
    pointsOfInterest,
    obstacles,
    wind,
    options.scenario === "trails",
  );

  return {
    grid,
    ants,
    pointsOfInterest,
    obstacles,
    wind,
    rules,
    metrics: new MillMetrics(config.metrics),
  };
}

/*
 * Com vento constante, a trilha inteira (formigas + feromônio) é carregada
 * vento abaixo até a colônia se espremer contra a parede do grid, numa faixa
 * de ~2 células — um efeito de borda que precisa ser medido para não ser
 * confundido com o resultado.
 */
export function nearWallFraction(ants: Ant[], grid: Grid, band = 2): number {
  const near = ants.filter(
    (ant) =>
      ant.x < band ||
      ant.y < band ||
      ant.x >= grid.rows - band ||
      ant.y >= grid.cols - band,
  );

  return ants.length > 0 ? near.length / ants.length : 0;
}

export interface TrialResult extends MillRunSummary {
  windStrength: number;
  seed: number;
  millFormed: boolean;
  meanNearWall: number;
  finalNearWall: number;
  minPheromone: number;
  maxPheromone: number;
}

export function runTrial(
  windStrength: number,
  seed: number,
  ticks: number,
  layout: ObstacleLayout = WIND_EXPERIMENT.layout,
): TrialResult {
  const simulation = createSimulation({
    scenario: "trails",
    windStrength,
    seed,
    layout,
  });

  let nearWallSum = 0;
  let minPheromone = Infinity;
  let maxPheromone = -Infinity;

  for (let tick = 0; tick < ticks; tick++) {
    simulation.rules.update(simulation.grid);
    simulation.metrics.measure(simulation.ants);

    nearWallSum += nearWallFraction(simulation.ants, simulation.grid);

    for (const row of simulation.grid.cells) {
      for (const cell of row) {
        minPheromone = Math.min(minPheromone, cell.pheromone);
        maxPheromone = Math.max(maxPheromone, cell.pheromone);
      }
    }
  }

  const summary = simulation.metrics.summary();

  return {
    ...summary,
    windStrength,
    seed,
    millFormed: summary.maxEpisodeRotations >= WIND_EXPERIMENT.minRotations,
    meanNearWall: ticks > 0 ? nearWallSum / ticks : 0,
    finalNearWall: nearWallFraction(simulation.ants, simulation.grid),
    minPheromone,
    maxPheromone,
  };
}

export interface ExperimentOptions {
  runs: number;
  ticks: number;
  seed: number;
  layout: ObstacleLayout;
  onTrial?: ((result: TrialResult, preset: string) => void) | undefined;
}

/*
 * A corrida r de cada condição usa a semente seed + r: todas as intensidades
 * de vento partem do mesmo conjunto de condições iniciais (comparação
 * pareada), e só a dinâmica estocástica difere entre elas.
 */
export function runWindExperiment(options: ExperimentOptions) {
  return WIND_PRESETS.map((preset) => {
    const trials: TrialResult[] = [];

    for (let run = 0; run < options.runs; run++) {
      const result = runTrial(
        preset.strength,
        options.seed + run,
        options.ticks,
        options.layout,
      );

      trials.push(result);
      options.onTrial?.(result, preset.name);
    }

    return { preset, trials };
  });
}

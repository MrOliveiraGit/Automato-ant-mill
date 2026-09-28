import { Grid } from "../models/grid.js";
import { Ant } from "../models/ant.js";
import { Obstacle } from "../models/obstacle.js";
import { Wind } from "../models/wind.js";
import {
  AntRules,
  DEFAULT_ANT_RULES,
  type AntRulesSettings,
} from "../rules/antsRules.js";
import {
  Column,
  CornerCluster,
  RandomScatter,
  Ring,
  TwoWayTrails,
  type ColumnSettings,
  type InitialCondition,
  type RingSettings,
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

  // teste A (sustentar um mill pronto)
  ring: {
    center: [50, 50],
    radius: 15,
    strength: 5,
    width: 1,
    headingJitter: 0.2,
  } satisfies RingSettings,

  // teste B (uma coluna que perdeu a trilha)
  column: {
    pointA: [50, 15],
    pointB: [50, 60],
    trailStrength: 5,
    trailWidth: 1,
    headingJitter: 0.2,
  } satisfies ColumnSettings,

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

/*
 * random: formigas espalhadas, sem feromônio (ambiente neutro);
 * column: uma coluna de correição sobre uma trilha que termina (teste B);
 * ring: um mill pronto (teste A); trails: as duas pistas A↔B do experimento
 * de vento; classic: o aglomerado no canto do cenário original.
 */
export const SCENARIOS = [
  "random",
  "column",
  "ring",
  "trails",
  "classic",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export interface SimulationOptions {
  scenario: Scenario;
  windStrength: number;
  seed: number;
  layout?: ObstacleLayout | undefined;
  rules?: Partial<AntRulesSettings> | undefined;
  ctx?: CanvasRenderingContext2D | undefined;
  cellSize?: number | undefined;
  obstacles?: Obstacle[] | undefined;
}

export interface Simulation {
  grid: Grid;
  ants: Ant[];
  obstacles: Obstacle[];
  wind: Wind;
  rules: AntRules;
  metrics: MillMetrics;
}

function initialCondition(
  scenario: Scenario,
  seed: number,
  isBlocked: (x: number, y: number) => boolean,
): InitialCondition {
  const config = WIND_EXPERIMENT;

  switch (scenario) {
    case "random":
      return new RandomScatter(seed, isBlocked);
    case "column":
      return new Column(config.column, seed, isBlocked);
    case "ring":
      return new Ring(config.ring, seed, isBlocked);
    case "trails":
      return new TwoWayTrails(config.trails, seed, isBlocked);
    case "classic":
      return new CornerCluster(seed);
  }
}

export function createSimulation(options: SimulationOptions): Simulation {
  const config = WIND_EXPERIMENT;

  const grid = new Grid(
    config.rows,
    config.cols,
    options.cellSize ?? 6,
    options.ctx ?? null,
  );

  const obstacles = [
    ...OBSTACLE_LAYOUTS[options.layout ?? config.layout].map(
      (o) => new Obstacle(o.x, o.y, o.width, o.height),
    ),
    ...(options.obstacles ?? []),
  ];

  const ants = Array.from({ length: config.numberOfAnts }, () => new Ant(0, 0));

  initialCondition(options.scenario, options.seed, (x, y) =>
    obstacles.some((obstacle) => obstacle.contains(x, y)),
  ).initialize(grid, ants);

  const wind = new Wind(
    config.windDirection[0],
    config.windDirection[1],
    options.windStrength,
  );

  const rules = new AntRules(ants, obstacles, wind, {
    ...DEFAULT_ANT_RULES,
    ...options.rules,
  });

  return {
    grid,
    ants,
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

/*
 * Fração das formigas "em coluna": com outra formiga logo à frente (até
 * `distance` células, dentro de ±30° da própria direção) andando no mesmo
 * sentido (direções a menos de 45°). É o que se espera de formigas de
 * correição seguindo trilha, e o que falta tanto num passeio aleatório
 * quanto num aglomerado parado.
 */
export function followingFraction(ants: Ant[], distance = 3): number {
  let following = 0;

  for (const ant of ants) {
    const hx = Math.cos(ant.heading);
    const hy = Math.sin(ant.heading);

    const hasLeader = ants.some((other) => {
      if (other === ant) {
        return false;
      }

      const dx = other.x - ant.x;
      const dy = other.y - ant.y;
      const d = Math.hypot(dx, dy);

      return (
        d > 0 &&
        d <= distance &&
        (dx * hx + dy * hy) / d >= Math.cos(Math.PI / 6) &&
        Math.cos(other.heading - ant.heading) >= Math.cos(Math.PI / 4)
      );
    });

    following += hasLeader ? 1 : 0;
  }

  return ants.length > 0 ? following / ants.length : 0;
}

// fração das formigas em células com ≥ `minAnts` formigas (aglomerados)
export function crowdedFraction(grid: Grid, ants: Ant[], minAnts = 4): number {
  const crowded = ants.filter(
    (ant) => (grid.get(ant.cellX, ant.cellY)?.ants ?? 0) >= minAnts,
  );

  return ants.length > 0 ? crowded.length / ants.length : 0;
}

export interface TrialOptions {
  scenario: Scenario;
  windStrength: number;
  seed: number;
  ticks: number;
  layout?: ObstacleLayout | undefined;
  rules?: Partial<AntRulesSettings> | undefined;
}

export interface TrialResult extends MillRunSummary {
  scenario: Scenario;
  windStrength: number;
  seed: number;
  millFormed: boolean;

  // fração dos ticks do último quarto da corrida em estado rotacional —
  // no teste A, se o mill semeado ainda existe no fim
  lateRotating: number;

  // médias ao longo do último quarto da corrida
  following: number;
  crowded: number;

  meanNearWall: number;
  finalNearWall: number;
  minPheromone: number;
  maxPheromone: number;
}

export function runTrial(options: TrialOptions): TrialResult {
  const { ticks } = options;

  const simulation = createSimulation(options);

  const lateStart = Math.floor((3 * ticks) / 4);
  let lateRotatingTicks = 0;
  let followingSum = 0;
  let crowdedSum = 0;
  let lateSamples = 0;

  let nearWallSum = 0;
  let minPheromone = Infinity;
  let maxPheromone = -Infinity;

  for (let tick = 0; tick < ticks; tick++) {
    simulation.rules.update(simulation.grid);
    const snapshot = simulation.metrics.measure(simulation.ants);

    nearWallSum += nearWallFraction(simulation.ants, simulation.grid);

    if (tick >= lateStart) {
      lateRotatingTicks += snapshot.rotating ? 1 : 0;

      // O(n²): amostrado a cada 10 ticks
      if ((tick - lateStart) % 10 === 0) {
        followingSum += followingFraction(simulation.ants);
        crowdedSum += crowdedFraction(simulation.grid, simulation.ants);
        lateSamples++;
      }
    }

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
    scenario: options.scenario,
    windStrength: options.windStrength,
    seed: options.seed,
    millFormed: summary.maxEpisodeRotations >= WIND_EXPERIMENT.minRotations,
    lateRotating:
      ticks > lateStart ? lateRotatingTicks / (ticks - lateStart) : 0,
    following: lateSamples > 0 ? followingSum / lateSamples : 0,
    crowded: lateSamples > 0 ? crowdedSum / lateSamples : 0,
    meanNearWall: ticks > 0 ? nearWallSum / ticks : 0,
    finalNearWall: nearWallFraction(simulation.ants, simulation.grid),
    minPheromone,
    maxPheromone,
  };
}

export interface ExperimentOptions {
  scenario: Scenario;
  runs: number;
  ticks: number;
  seed: number;
  layout: ObstacleLayout;
  rules?: Partial<AntRulesSettings> | undefined;
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
      const result = runTrial({
        scenario: options.scenario,
        windStrength: preset.strength,
        seed: options.seed + run,
        ticks: options.ticks,
        layout: options.layout,
        rules: options.rules,
      });

      trials.push(result);
      options.onTrial?.(result, preset.name);
    }

    return { preset, trials };
  });
}

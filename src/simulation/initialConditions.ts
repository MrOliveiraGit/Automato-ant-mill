import type { Grid } from "../models/grid.js";
import type { Ant } from "../models/ant.js";

export interface InitialCondition {
  initialize(grid: Grid, ants: Ant[]): void;
}

type BlockedTest = (x: number, y: number) => boolean;

/*
 * mulberry32. Só as condições iniciais são semeadas — assim cada condição de
 * vento parte exatamente do mesmo estado — enquanto a dinâmica continua
 * estocástica via Math.random.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isFree(grid: Grid, isBlocked: BlockedTest, x: number, y: number) {
  return x >= 0 && y >= 0 && x < grid.rows && y < grid.cols && !isBlocked(x, y);
}

/*
 * Formigas espalhadas uniformemente pela arena, direções aleatórias, sem
 * feromônio: o teste mais neutro possível — qualquer trilha, coluna ou mill
 * que apareça foi construído pelas próprias formigas.
 */
export class RandomScatter implements InitialCondition {
  constructor(
    private seed: number,
    private isBlocked: BlockedTest = () => false,
  ) {}

  initialize(grid: Grid, ants: Ant[]): void {
    const random = createSeededRandom(this.seed);

    for (const ant of ants) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const x = random() * grid.rows;
        const y = random() * grid.cols;

        if (isFree(grid, this.isBlocked, x, y)) {
          ant.x = x;
          ant.y = y;
          break;
        }
      }

      ant.heading = random() * Math.PI * 2;
    }
  }
}

/*
 * O cenário original: formigas aglomeradas num canto do grid, sem nenhum
 * feromônio inicial.
 */
export class CornerCluster implements InitialCondition {
  constructor(
    private seed: number,
    private spawnWidth = 0.2,
    private spawnHeight = 0.3,
  ) {}

  initialize(grid: Grid, ants: Ant[]): void {
    const random = createSeededRandom(this.seed);

    for (const ant of ants) {
      ant.x = random() * grid.rows * this.spawnWidth;
      ant.y = random() * grid.cols * this.spawnHeight;
      ant.heading = random() * Math.PI * 2;
    }
  }
}

export interface RingSettings {
  // centro (linha, coluna) e raio do eixo do anel, em células
  center: [number, number];
  radius: number;

  // feromônio no eixo do anel, caindo linearmente até a borda
  strength: number;

  // meia-largura do anel, em células
  width: number;

  // desvio angular máximo (rad) da direção inicial em relação à tangente
  headingJitter: number;
}

/*
 * Teste A: um mill já pronto — anel de feromônio com as formigas sobre ele,
 * todas andando no mesmo sentido ao longo da tangente. Não pergunta se um
 * mill surge, e sim se as regras de movimento conseguem sustentá-lo. O
 * sentido do giro existe só na condição inicial; a partir do primeiro tick
 * vale a regra simétrica de sempre.
 */
export class Ring implements InitialCondition {
  constructor(
    private settings: RingSettings,
    private seed: number,
    private isBlocked: BlockedTest = () => false,
  ) {}

  initialize(grid: Grid, ants: Ant[]): void {
    const random = createSeededRandom(this.seed);
    const { center, radius, strength, width, headingJitter } = this.settings;
    const [cx, cy] = center;
    const reach = width + 1;

    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        const distance = Math.abs(
          Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius,
        );

        if (distance < reach && !this.isBlocked(x, y)) {
          const cell = grid.get(x, y)!;
          cell.pheromone = Math.max(
            cell.pheromone,
            strength * (1 - distance / reach),
          );
        }
      }
    }

    ants.forEach((ant, index) => {
      // espaçamento uniforme ao longo do anel, com um pouco de ruído
      const angle = ((index + random()) / ants.length) * Math.PI * 2;
      const r = radius + (random() * 2 - 1) * width;

      ant.x = cx + r * Math.cos(angle);
      ant.y = cy + r * Math.sin(angle);
      ant.heading = angle + Math.PI / 2 + (random() * 2 - 1) * headingJitter;
    });
  }
}

export interface TrailSettings {
  // extremidades (linha, coluna)
  pointA: [number, number];
  pointB: [number, number];

  // distância entre os eixos da pista A→B e da pista B→A
  trailDistance: number;

  // feromônio no eixo de cada pista, caindo linearmente até a borda
  trailStrength: number;

  // meia-largura de cada pista, em células
  trailWidth: number;

  // desvio angular máximo (rad) da direção inicial em relação à pista
  headingJitter: number;
}

// o que uma pista precisa, sem a separação entre pistas do TwoWayTrails
type LaneSettings = Pick<
  TrailSettings,
  "trailStrength" | "trailWidth" | "headingJitter"
>;

export type ColumnSettings = LaneSettings &
  Pick<TrailSettings, "pointA" | "pointB">;

interface Lane {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/*
 * Teste B: uma coluna de correição — uma única pista de feromônio de A até
 * B com todas as formigas sobre ela, andando de A para B. A trilha acaba em
 * B; o que a coluna faz depois disso (se dispersa, forma novas trilhas, se
 * fecha num mill) é resultado da regra de movimento.
 */
export class Column implements InitialCondition {
  constructor(
    private settings: ColumnSettings,
    private seed: number,
    private isBlocked: BlockedTest = () => false,
  ) {}

  lane(): Lane {
    const [fromX, fromY] = this.settings.pointA;
    const [toX, toY] = this.settings.pointB;

    return { fromX, fromY, toX, toY };
  }

  initialize(grid: Grid, ants: Ant[]): void {
    const random = createSeededRandom(this.seed);
    const lane = this.lane();

    layLane(grid, lane, this.settings, this.isBlocked);

    for (const ant of ants) {
      placeOnLane(grid, ant, lane, this.settings, random, this.isBlocked);
    }
  }
}

/*
 * Duas pistas paralelas de feromônio entre A e B, com as formigas
 * distribuídas sobre elas. `Cell.pheromone` é escalar, então uma pista não
 * tem sentido próprio: "A→B" e "B→A" são faixas espacialmente separadas, e
 * o sentido existe só na direção inicial (heading) de cada formiga. Isso é
 * condição inicial, não regra de movimento — a partir do primeiro tick as
 * formigas seguem o modelo de sempre e a trilha semeada evapora se não for
 * reforçada.
 */
export class TwoWayTrails implements InitialCondition {
  constructor(
    private settings: TrailSettings,
    private seed: number,
    private isBlocked: BlockedTest = () => false,
  ) {}

  lanes(): [Lane, Lane] {
    const [ax, ay] = this.settings.pointA;
    const [bx, by] = this.settings.pointB;

    const length = Math.hypot(bx - ax, by - ay);

    // perpendicular unitária a A→B; a pista A→B fica do lado +p
    const px = -(by - ay) / length;
    const py = (bx - ax) / length;

    const half = this.settings.trailDistance / 2;

    return [
      {
        fromX: ax + px * half,
        fromY: ay + py * half,
        toX: bx + px * half,
        toY: by + py * half,
      },
      {
        fromX: bx - px * half,
        fromY: by - py * half,
        toX: ax - px * half,
        toY: ay - py * half,
      },
    ];
  }

  initialize(grid: Grid, ants: Ant[]): void {
    const random = createSeededRandom(this.seed);
    const lanes = this.lanes();

    for (const lane of lanes) {
      layLane(grid, lane, this.settings, this.isBlocked);
    }

    ants.forEach((ant, index) => {
      placeOnLane(
        grid,
        ant,
        lanes[index % 2],
        this.settings,
        random,
        this.isBlocked,
      );
    });
  }
}

function layLane(
  grid: Grid,
  lane: Lane,
  settings: LaneSettings,
  isBlocked: BlockedTest,
) {
  const reach = settings.trailWidth + 1;

  for (let x = 0; x < grid.rows; x++) {
    for (let y = 0; y < grid.cols; y++) {
      const distance = distanceToLane(x, y, lane);

      if (distance >= reach || isBlocked(x, y)) {
        continue;
      }

      const cell = grid.get(x, y)!;
      const value = settings.trailStrength * (1 - distance / reach);

      cell.pheromone = Math.max(cell.pheromone, value);
    }
  }
}

function placeOnLane(
  grid: Grid,
  ant: Ant,
  lane: Lane,
  settings: LaneSettings,
  random: () => number,
  isBlocked: BlockedTest,
) {
  const dx = lane.toX - lane.fromX;
  const dy = lane.toY - lane.fromY;
  const length = Math.hypot(dx, dy);

  const perpX = -dy / length;
  const perpY = dx / length;

  for (let attempt = 0; attempt < 100; attempt++) {
    const along = random();
    const across = (random() * 2 - 1) * settings.trailWidth;

    // eixo da pista passa pelo centro das células (x + 0.5, y + 0.5)
    const x = lane.fromX + dx * along + perpX * across + 0.5;
    const y = lane.fromY + dy * along + perpY * across + 0.5;

    if (isFree(grid, isBlocked, x, y)) {
      ant.x = x;
      ant.y = y;
      break;
    }
  }

  const jitter = (random() * 2 - 1) * settings.headingJitter;
  ant.heading = Math.atan2(dy, dx) + jitter;
}

function distanceToLane(x: number, y: number, lane: Lane): number {
  const dx = lane.toX - lane.fromX;
  const dy = lane.toY - lane.fromY;
  const lengthSquared = dx * dx + dy * dy;

  const t =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((x - lane.fromX) * dx + (y - lane.fromY) * dy) / lengthSquared,
          ),
        );

  return Math.hypot(x - (lane.fromX + t * dx), y - (lane.fromY + t * dy));
}

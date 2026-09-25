import type { Grid } from "../models/grid.js";
import type { Ant } from "../models/ant.js";

export interface InitialCondition {
  initialize(grid: Grid, ants: Ant[]): void;
}

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

function setHeading(ant: Ant, angle: number) {
  ant.dirX = Math.cos(angle);
  ant.dirY = Math.sin(angle);
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
      ant.x = Math.floor(random() * grid.rows * this.spawnWidth);
      ant.y = Math.floor(random() * grid.cols * this.spawnHeight);
      setHeading(ant, random() * Math.PI * 2);
    }
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

interface Lane {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/*
 * Duas pistas paralelas de feromônio entre A e B, com as formigas
 * distribuídas sobre elas. `Cell.pheromone` é escalar, então uma pista não
 * tem sentido próprio: "A→B" e "B→A" são faixas espacialmente separadas, e
 * o sentido existe só na direção memorizada inicial (dirX/dirY) de cada
 * formiga. Isso é condição inicial, não regra de movimento — a partir do
 * primeiro tick as formigas seguem o modelo de sempre e a trilha semeada
 * evapora se não for reforçada.
 */
export class TwoWayTrails implements InitialCondition {
  constructor(
    private settings: TrailSettings,
    private seed: number,
    private isBlocked: (x: number, y: number) => boolean = () => false,
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
      this.layLane(grid, lane);
    }

    ants.forEach((ant, index) => {
      const lane = lanes[index % 2];
      this.placeOnLane(grid, ant, lane, random);
    });
  }

  private layLane(grid: Grid, lane: Lane) {
    const reach = this.settings.trailWidth + 1;

    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        const distance = distanceToLane(x, y, lane);

        if (distance >= reach || this.isBlocked(x, y)) {
          continue;
        }

        const cell = grid.get(x, y)!;
        const value = this.settings.trailStrength * (1 - distance / reach);

        cell.pheromone = Math.max(cell.pheromone, value);
      }
    }
  }

  private placeOnLane(grid: Grid, ant: Ant, lane: Lane, random: () => number) {
    const dx = lane.toX - lane.fromX;
    const dy = lane.toY - lane.fromY;
    const length = Math.hypot(dx, dy);

    const perpX = -dy / length;
    const perpY = dx / length;

    for (let attempt = 0; attempt < 100; attempt++) {
      const along = random();
      const across = Math.round((random() * 2 - 1) * this.settings.trailWidth);

      const x = Math.round(lane.fromX + dx * along + perpX * across);
      const y = Math.round(lane.fromY + dy * along + perpY * across);

      if (grid.get(x, y) && !this.isBlocked(x, y)) {
        ant.x = x;
        ant.y = y;
        break;
      }
    }

    const jitter = (random() * 2 - 1) * this.settings.headingJitter;
    setHeading(ant, Math.atan2(dy, dx) + jitter);
  }
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

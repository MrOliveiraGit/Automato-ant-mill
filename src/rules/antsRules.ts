import type { Grid } from "../models/grid.js";
import type { Ant } from "../models/ant.js";
import type { PointOfInterest } from "../models/pointOfInterest.js";
import type { Obstacle } from "../models/obstacle.js";
import type { Wind } from "../models/wind.js";

import { RandomWalk } from "../movement/randomWalk.js";
import { LevyFlight } from "../movement/levyFlight.js";

export class AntRules {
  private randomWalk = new RandomWalk();

  private levyFlight = new LevyFlight();

  // parâmetros do modelo
  private D = 0.005;
  private evaporation = 0.05;
  private lambda = 0.2;

  // influência do POI
  private poiWeight = 2.0;

  // força do gradiente de feromônio (b, na equação dv/dt = b∇g)
  private gradientGain = 3.0;

  // concentração de feromônio na qual a influência do gradiente satura
  private gradientSaturation = 0.1;

  // ruído aleatório aplicado à direção a cada passo
  private directionNoise = 0.15;

  // quanto a direção memorizada pesa frente ao estímulo do tick atual
  private memoryWeight = 0.5;

  // fração dos ticks (fora de um voo de Lévy) em que a formiga segue a trilha
  private trailFollowChance = 0.8;

  constructor(
    private ants: Ant[],
    private pointsOfInterest: PointOfInterest[],
    private obstacles: Obstacle[],
    private wind: Wind,
    private followTrailsWithoutPOI = false,
  ) {}

  /*
   * Velocidade de advecção efetivamente usada pelo solver. O esquema upwind
   * explícito abaixo só preserva positividade (e estabilidade) enquanto
   * |vx| + |vy| + 4D + evaporation ≤ 1 — todos os coeficientes da
   * atualização ficam não negativos, então o novo valor é uma média
   * ponderada dos vizinhos. Um vento mais forte que isso é reduzido
   * mantendo a direção, em vez de deixar o campo explodir.
   */
  advectionVelocity(): [number, number] {
    const [vx, vy] = this.wind.velocity();
    const limit = 1 - 4 * this.D - this.evaporation;
    const speed = Math.abs(vx) + Math.abs(vy);

    if (speed <= limit) {
      return [vx, vy];
    }

    return [(vx * limit) / speed, (vy * limit) / speed];
  }

  update(grid: Grid): void {
    this.clearAntDensity(grid);
    this.moveAnts(grid);
    this.depositPheromone(grid);
    this.diffusePheromone(grid);
  }

  private clearAntDensity(grid: Grid) {
    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        const cell = grid.get(x, y);

        if (cell) {
          cell.ants = 0;
        }
      }
    }
  }

  private moveAnts(grid: Grid) {
    for (const ant of this.ants) {
      let nx = ant.x;
      let ny = ant.y;

      if (this.levyFlight.isFlying(ant)) {
        [nx, ny] = this.levyFlight.move(ant);
      } else {
        /*
         * Sem um POI, não há nenhum objetivo competindo com o
         * feromônio — formigas recém-nascidas já começam agrupadas,
         * então seguir a trilha nesse momento faz o próprio
         * agrupamento inicial colapsar num mill antes mesmo de a
         * simulação começar de verdade. Enquanto não existir POI, as
         * formigas apenas exploram (Lévy/Random Walk); o
         * comportamento de seguir trilha + memória só entra quando
         * há um objetivo real a perseguir.
         *
         * `followTrailsWithoutPOI` desliga essa trava para condições
         * iniciais que já trazem uma estrutura química semeada (as
         * trilhas A↔B do experimento de vento), onde as formigas não
         * nascem aglomeradas e a trilha é justamente o que se quer que
         * elas sigam.
         */
        const followChance =
          this.followTrailsWithoutPOI || this.pointsOfInterest.length > 0
            ? this.trailFollowChance
            : 0;

        if (Math.random() < followChance) {
          [nx, ny] = this.steerTowardTrail(grid, ant);
        } else {
          if (Math.random() < 0.01) {
            [nx, ny] = this.levyFlight.move(ant);
          } else {
            [nx, ny] = this.randomWalk.move(ant.x, ant.y);
          }
        }
      }

      /*
       * Verifica se a nova posição está dentro do grid
       * e se não está dentro de um obstáculo.
       */
      const insideGrid = nx >= 0 && nx < grid.rows && ny >= 0 && ny < grid.cols;

      const blocked = this.isBlocked(nx, ny);

      if (insideGrid && !blocked) {
        ant.x = nx;
        ant.y = ny;
      }

      const cell = grid.get(ant.x, ant.y);

      if (cell) {
        cell.ants++;
      }
    }
  }

  /*
   * Implementa dv/dt = b∇g (Li & Chen, arXiv:1703.06859): a direção
   * memorizada da formiga (ant.dirX/dirY) é somada — não substituída —
   * ao gradiente local de feromônio e à atração pelo POI, o que
   * combina memória (persistência de direção) com reforço (trilha de
   * feromônio). A direção resultante só serve para escolher, entre os
   * vizinhos válidos, qual célula do grid ocupar a seguir — a posição
   * da formiga continua inteira, célula a célula.
   */
  private steerTowardTrail(grid: Grid, ant: Ant): [number, number] {
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

    const poi = this.getClosestPOI(ant);

    let poiDirX = 0;
    let poiDirY = 0;

    if (poi) {
      const dx = poi.x - ant.x;
      const dy = poi.y - ant.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        poiDirX = dx / distance;
        poiDirY = dy / distance;
      }
    }

    const candidates: {
      x: number;
      y: number;
      unitX: number;
      unitY: number;
    }[] = [];

    let gradientX = 0;
    let gradientY = 0;

    for (const [dx, dy] of directions) {
      const nx = ant.x + dx;
      const ny = ant.y + dy;

      const cell = grid.get(nx, ny);

      /*
       * Impede a formiga de entrar em um obstáculo.
       */
      if (!cell || this.isBlocked(nx, ny)) {
        continue;
      }

      const length = Math.sqrt(dx * dx + dy * dy);
      const unitX = dx / length;
      const unitY = dy / length;

      candidates.push({
        x: nx,
        y: ny,
        unitX,
        unitY,
      });

      gradientX += unitX * cell.pheromone;
      gradientY += unitY * cell.pheromone;
    }

    /*
     * Se nenhuma posição válida foi encontrada,
     * utiliza Random Walk.
     */
    if (candidates.length === 0) {
      return this.randomWalk.move(ant.x, ant.y);
    }

    /*
     * A influência do gradiente de feromônio satura com a
     * concentração em vez de ser proporcional a ela (gradientLength
     * cru) ou totalmente normalizada para módulo 1: cru, a
     * concentração cresce sem limite onde as formigas se aglomeram e
     * sobrepuja o peso fixo do POI; normalizada, até um resquício
     * fraquíssimo de feromônio (ruído) puxa com força máxima, o que
     * gruda todas as formigas num único bloco rígido que só desliza
     * junto e nunca se diferencia o bastante para circular. A curva
     * `length / (gradientSaturation + length)` fica perto de 0 para
     * feromônio fraco (ignorado como ruído) e se aproxima de 1 só onde
     * a trilha é de fato forte — refletindo o termo de quimiotaxia
     * saturante do artigo (β/(α+βg)).
     */
    const gradientLength = Math.sqrt(
      gradientX * gradientX + gradientY * gradientY,
    );

    let gradientDirX = 0;
    let gradientDirY = 0;

    if (gradientLength > 0) {
      const scale = gradientLength / (this.gradientSaturation + gradientLength);

      gradientDirX = (gradientX / gradientLength) * scale;
      gradientDirY = (gradientY / gradientLength) * scale;
    }

    let signalX = this.gradientGain * gradientDirX + this.poiWeight * poiDirX;
    let signalY = this.gradientGain * gradientDirY + this.poiWeight * poiDirY;

    /*
     * O estímulo do tick atual (gradiente + POI) é normalizado antes de
     * ser combinado com a direção memorizada. Sem isso, a magnitude do
     * feromônio acumulado (que cresce/varia sem limite) determinaria
     * sozinha o quanto a memória pesa, tornando `memoryWeight` sem
     * efeito e fazendo a formiga oscilar contra obstáculos em vez de
     * deslizar suavemente ao redor deles.
     */
    const signalLength = Math.sqrt(signalX * signalX + signalY * signalY);

    if (signalLength > 0) {
      signalX /= signalLength;
      signalY /= signalLength;
    }

    const noiseX = (Math.random() * 2 - 1) * this.directionNoise;
    const noiseY = (Math.random() * 2 - 1) * this.directionNoise;

    let dirX =
      this.memoryWeight * ant.dirX + (1 - this.memoryWeight) * signalX + noiseX;

    let dirY =
      this.memoryWeight * ant.dirY + (1 - this.memoryWeight) * signalY + noiseY;

    const dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

    if (dirLength > 0) {
      dirX /= dirLength;
      dirY /= dirLength;
    }

    ant.dirX = dirX;
    ant.dirY = dirY;

    /*
     * Escolhe, entre os vizinhos válidos, aquele cujo deslocamento
     * mais se alinha com a direção memorizada — se o melhor vizinho
     * estiver bloqueado ele nem entra em `candidates`, então a
     * formiga automaticamente desliza para o próximo mais alinhado
     * em vez de perder o rumo ao tocar um obstáculo.
     */
    let best = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const score = candidate.unitX * dirX + candidate.unitY * dirY;

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return [best.x, best.y];
  }

  /*
   * Verifica se uma posição está dentro de
   * qualquer obstáculo existente.
   */
  private isBlocked(x: number, y: number): boolean {
    return this.obstacles.some((obstacle) => obstacle.contains(x, y));
  }

  private getClosestPOI(ant: Ant): PointOfInterest | null {
    if (this.pointsOfInterest.length === 0) {
      return null;
    }

    let closest = this.pointsOfInterest[0];

    let minDistance = Infinity;

    for (const poi of this.pointsOfInterest) {
      const dx = poi.x - ant.x;

      const dy = poi.y - ant.y;

      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        closest = poi;
      }
    }

    return closest;
  }

  private depositPheromone(grid: Grid) {
    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        const cell = grid.get(x, y);

        if (cell) {
          cell.pheromone += this.lambda * cell.ants;
        }
      }
    }
  }

  /*
   * Integra ∂g/∂t = D∇²g − v·∇g − evaporation·g (o termo λρ já entrou em
   * depositPheromone) com Euler explícito, dt = 1 tick e dx = 1 célula.
   *
   * O termo de advecção usa upwind de primeira ordem: a derivada em cada
   * eixo é tomada do lado de onde o vento vem, o que dá
   * −|v|·(g − g_upwind). Diferença central seria mais simples, mas com
   * Euler explícito é instável para advecção pura e gera concentrações
   * negativas. Na borda de onde o vento sopra entra ar limpo (vizinho
   * ausente conta como 0) e na borda oposta o feromônio simplesmente sai
   * do grid. Obstáculos não bloqueiam o vento, assim como já não bloqueiam
   * a difusão.
   */
  private diffusePheromone(grid: Grid) {
    const [vx, vy] = this.advectionVelocity();

    const next = Array.from(
      {
        length: grid.rows,
      },
      () => new Array(grid.cols).fill(0),
    );

    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        const cell = grid.get(x, y);

        if (!cell) {
          continue;
        }

        const g = cell.pheromone;

        const laplacian =
          (grid.get(x + 1, y)?.pheromone ?? g) +
          (grid.get(x - 1, y)?.pheromone ?? g) +
          (grid.get(x, y + 1)?.pheromone ?? g) +
          (grid.get(x, y - 1)?.pheromone ?? g) -
          4 * g;

        const upwindX = vx > 0 ? grid.get(x - 1, y) : grid.get(x + 1, y);
        const upwindY = vy > 0 ? grid.get(x, y - 1) : grid.get(x, y + 1);

        const advection =
          Math.abs(vx) * (g - (upwindX?.pheromone ?? 0)) +
          Math.abs(vy) * (g - (upwindY?.pheromone ?? 0));

        let value = g + this.D * laplacian - this.evaporation * g - advection;

        if (value < 0) {
          value = 0;
        }

        next[x][y] = value;
      }
    }

    for (let x = 0; x < grid.rows; x++) {
      for (let y = 0; y < grid.cols; y++) {
        const cell = grid.get(x, y);

        if (cell) {
          cell.pheromone = next[x][y];
        }
      }
    }
  }
}

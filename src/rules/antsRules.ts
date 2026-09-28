import type { Grid } from "../models/grid.js";
import type { Ant } from "../models/ant.js";
import type { Obstacle } from "../models/obstacle.js";
import type { Wind } from "../models/wind.js";

export interface AntRulesSettings {
  // --- campo de feromônio: ∂g/∂t = D∇²g − v·∇g − evaporation·g + deposit·ρ

  diffusion: number;
  evaporation: number;

  // feromônio depositado por formiga por tick, na célula onde ela está
  deposit: number;

  // --- movimento

  // velocidade constante, em células por tick: formigas nunca param
  speed: number;

  // as duas antenas ficam a essa distância à frente (células)...
  sensorDistance: number;

  // ...e a ± esse ângulo (rad) da direção atual. Nada atrás é percebido.
  sensorAngle: number;

  // b: ganho da virada em direção à antena com mais feromônio
  turnGain: number;

  // α: concentração abaixo da qual a diferença entre as antenas pesa pouco
  turnSaturation: number;

  // maior virada determinística possível num tick (rad)
  maxTurn: number;

  // desvio padrão do ruído angular por tick (rad)
  turnNoise: number;
}

export const DEFAULT_ANT_RULES: AntRulesSettings = {
  diffusion: 0.005,
  evaporation: 0.05,
  deposit: 0.2,

  speed: 1,
  sensorDistance: 3,
  sensorAngle: Math.PI / 4,
  turnGain: 1,
  turnSaturation: 0.05,
  maxTurn: 0.5,
  turnNoise: 0.1,
};

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// normal padrão (Box–Muller)
function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/*
 * Formiga de correição cega seguindo trilha (Li & Chen, arXiv:1703.06859).
 *
 * O artigo usa ∂v/∂t + v·∇v = b∇g. Com velocidade constante s, a única
 * parte do gradiente que muda o movimento é a perpendicular à direção, e a
 * lei vira dθ/dt = (b/s)·(∇g·n̂), com n̂ a normal à esquerda. Uma formiga
 * mede ∇g·n̂ comparando as duas antenas — é exatamente o que moveAnts faz:
 * vira para o lado com mais feromônio, proporcionalmente à diferença, com a
 * saturação β/(α + βg) do artigo aparecendo como (gL − gR)/(α + gL + gR).
 *
 * Não há alvo, voo de Lévy nem passo aleatório: toda formiga anda o tempo
 * todo, deposita feromônio onde passa e segue o que as da frente deixaram.
 * A regra é simétrica entre esquerda e direita, então nada favorece girar
 * num sentido — um mill só pode aparecer se a trilha se fechar sozinha.
 */
export class AntRules {
  constructor(
    private ants: Ant[],
    private obstacles: Obstacle[],
    private wind: Wind,
    private settings: AntRulesSettings = DEFAULT_ANT_RULES,
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
    const limit = 1 - 4 * this.settings.diffusion - this.settings.evaporation;
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
    for (const row of grid.cells) {
      for (const cell of row) {
        cell.ants = 0;
      }
    }
  }

  private moveAnts(grid: Grid) {
    const { turnGain, turnSaturation, maxTurn, turnNoise, sensorAngle } =
      this.settings;

    for (const ant of this.ants) {
      const left = this.sense(grid, ant, sensorAngle);
      const right = this.sense(grid, ant, -sensorAngle);

      const pull =
        (turnGain * (left - right)) / (turnSaturation + left + right);
      const turn = Math.max(-maxTurn, Math.min(maxTurn, pull));

      ant.heading = wrapAngle(ant.heading + turn + turnNoise * gaussian());

      this.step(grid, ant);

      const cell = grid.get(ant.cellX, ant.cellY);

      if (cell) {
        cell.ants++;
      }
    }
  }

  /*
   * Feromônio sob uma antena, interpolado bilinearmente entre os centros das
   * células — sem isso a diferença entre as antenas pula em degraus toda vez
   * que uma delas cruza a fronteira de uma célula. Fora do grid conta como 0.
   */
  private sense(grid: Grid, ant: Ant, offset: number): number {
    const angle = ant.heading + offset;
    const px = ant.x + this.settings.sensorDistance * Math.cos(angle) - 0.5;
    const py = ant.y + this.settings.sensorDistance * Math.sin(angle) - 0.5;

    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const fx = px - x0;
    const fy = py - y0;

    const g = (x: number, y: number) => grid.get(x, y)?.pheromone ?? 0;

    return (
      (1 - fx) * (1 - fy) * g(x0, y0) +
      fx * (1 - fy) * g(x0 + 1, y0) +
      (1 - fx) * fy * g(x0, y0 + 1) +
      fx * fy * g(x0 + 1, y0 + 1)
    );
  }

  /*
   * Anda `speed` células na direção atual. Paredes do grid e obstáculos são
   * retângulos alinhados aos eixos, então o choque é uma reflexão especular:
   * inverte a componente da direção que atravessaria a parede e mantém a
   * outra. A formiga se afasta da parede em vez de grudar nela — deslizar
   * rente às bordas produziria voltas em torno do obstáculo ou da arena que
   * não têm nada a ver com seguir trilha.
   */
  private step(grid: Grid, ant: Ant) {
    const { speed } = this.settings;

    let dx = Math.cos(ant.heading);
    let dy = Math.sin(ant.heading);

    if (!this.isBlocked(grid, ant.x + dx * speed, ant.y + dy * speed)) {
      ant.x += dx * speed;
      ant.y += dy * speed;
      return;
    }

    const blockedX = this.isBlocked(grid, ant.x + dx * speed, ant.y);
    const blockedY = this.isBlocked(grid, ant.x, ant.y + dy * speed);

    if (blockedX) dx = -dx;
    if (blockedY) dy = -dy;

    // bateu de quina: nenhum eixo sozinho está bloqueado, só a diagonal
    if (!blockedX && !blockedY) {
      dx = -dx;
      dy = -dy;
    }

    ant.heading = Math.atan2(dy, dx);

    if (!this.isBlocked(grid, ant.x + dx * speed, ant.y + dy * speed)) {
      ant.x += dx * speed;
      ant.y += dy * speed;
    }
  }

  private isBlocked(grid: Grid, x: number, y: number): boolean {
    return (
      x < 0 ||
      y < 0 ||
      x >= grid.rows ||
      y >= grid.cols ||
      this.obstacles.some((obstacle) => obstacle.contains(x, y))
    );
  }

  private depositPheromone(grid: Grid) {
    for (const row of grid.cells) {
      for (const cell of row) {
        cell.pheromone += this.settings.deposit * cell.ants;
      }
    }
  }

  /*
   * Integra ∂g/∂t = D∇²g − v·∇g − evaporation·g (o termo de depósito já
   * entrou em depositPheromone) com Euler explícito, dt = 1 tick e dx = 1
   * célula.
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
    const { diffusion, evaporation } = this.settings;
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

        let value = g + diffusion * laplacian - evaporation * g - advection;

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

import type { Ant } from "../models/ant.js";

export interface MillMetricsSettings {
  // a direção de cada formiga é a do seu deslocamento líquido nesses ticks
  displacementWindow: number;

  // velocidade líquida mínima (células/tick) para a direção contar
  minSpeed: number;

  // mudanças de direção maiores que isso num tick são inversões/ruído, não giro
  maxTurnPerTick: number;

  // janela (ticks, exponencial) em que o giro acumulado de cada formiga é medido
  windingWindow: number;

  // |giro líquido| / giro total mínimo: uma formiga dando voltas vira quase
  // sempre para o mesmo lado, um passeio aleatório vira para os dois
  minTurnConsistency: number;

  // estado rotacional: ≥ minParticipants formigas com uma volta completa na
  // janela, no mesmo sentido, e ≥ minAlignment delas girando nesse sentido
  // em torno do centroide comum (não em voltas isoladas espalhadas)
  minParticipants: number;
  minAlignment: number;

  // quanto o centro pode se deslocar por tick sem encerrar o episódio
  centerTolerance: number;
}

export interface MillSnapshot {
  // formigas que completaram ≥ 1 volta na janela, no sentido dominante
  participants: number;

  // +1: anti-horário na tela, −1: horário
  sense: number;

  // centroide dos participantes (linha, coluna)
  centerX: number;
  centerY: number;

  meanRadius: number;

  // parâmetro de ordem rotacional |média de r̂ × v̂| dos participantes em torno
  // do centroide: ~1 num mill circular, menor em voltas alongadas
  order: number;

  // fração dos participantes cujo momento angular em torno do centroide tem o
  // sentido do giro: ~1 num mill (de qualquer formato), ~0.5 para voltas
  // independentes espalhadas pelo grid
  alignment: number;

  // quanto a direção dos participantes gira por tick (rad/tick): 2π dividido
  // pelo tempo de uma volta, qualquer que seja o formato da volta
  angularVelocity: number;

  rotating: boolean;
  episodeTicks: number;
  episodeRotations: number;
}

export interface MillRunSummary {
  ticks: number;
  rotatingTicks: number;
  longestEpisodeTicks: number;
  maxEpisodeRotations: number;
  maxParticipants: number;
  meanOrder: number;
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/*
 * Detecta circulação coletiva a partir das trajetórias observadas, sem
 * nenhuma influência sobre a simulação.
 *
 * O parâmetro de ordem rotacional sozinho (média de r̂ × v̂ em torno de um
 * centro) não serve aqui: duas pistas paralelas em sentidos opostos — a
 * própria condição inicial do experimento — já têm momento angular alto sem
 * que ninguém esteja dando voltas. Por isso a participação exige que a
 * formiga de fato gire: a direção do seu deslocamento precisa acumular 2π
 * dentro da janela, virando de forma consistente para o mesmo lado.
 * Inversões bruscas (ir e voltar) são descartadas em vez de contadas como
 * ±π, que acumulariam como giro espúrio. O alinhamento em torno do centroide
 * só é calculado depois, entre esses participantes, para distinguir um mill
 * (todos em torno do mesmo centro) de voltas isoladas espalhadas pelo grid.
 */
export class MillMetrics {
  private historyX: number[] = [];
  private historyY: number[] = [];
  private velocityX: number[] = [];
  private velocityY: number[] = [];
  private heading: number[] = [];
  private lastTurn: number[] = [];
  private winding: number[] = [];
  private turning: number[] = [];
  private tick = 0;

  private episodeTicks = 0;
  private episodeAngle = 0;
  private episodeCenter: [number, number] | null = null;

  private rotatingTicks = 0;
  private longestEpisodeTicks = 0;
  private maxEpisodeAngle = 0;
  private maxParticipants = 0;
  private orderSum = 0;

  constructor(private settings: MillMetricsSettings) {}

  measure(ants: Ant[]): MillSnapshot {
    if (this.winding.length !== ants.length) {
      this.start(ants);
    }

    this.updateWinding(ants);

    const looping = this.winding.map((w, i) => {
      const consistent =
        Math.abs(w) >= this.settings.minTurnConsistency * this.turning[i];

      return consistent && Math.abs(w) >= 2 * Math.PI ? Math.sign(w) : 0;
    });

    const counterClockwise = looping.filter((s) => s > 0).length;
    const clockwise = looping.filter((s) => s < 0).length;
    const sense = counterClockwise >= clockwise ? 1 : -1;

    const participants: number[] = [];

    looping.forEach((s, i) => {
      if (s === sense) {
        participants.push(i);
      }
    });

    const snapshot = this.describe(ants, participants, sense);

    this.track(snapshot);

    return snapshot;
  }

  summary(): MillRunSummary {
    return {
      ticks: this.tick,
      rotatingTicks: this.rotatingTicks,
      longestEpisodeTicks: this.longestEpisodeTicks,
      maxEpisodeRotations: this.maxEpisodeAngle / (2 * Math.PI),
      maxParticipants: this.maxParticipants,
      meanOrder: this.tick > 0 ? this.orderSum / this.tick : 0,
    };
  }

  private start(ants: Ant[]) {
    const window = this.settings.displacementWindow;

    this.historyX = ants.flatMap((ant) =>
      new Array<number>(window).fill(ant.x),
    );
    this.historyY = ants.flatMap((ant) =>
      new Array<number>(window).fill(ant.y),
    );
    this.velocityX = ants.map(() => 0);
    this.velocityY = ants.map(() => 0);
    this.heading = ants.map(() => NaN);
    this.lastTurn = ants.map(() => 0);
    this.winding = ants.map(() => 0);
    this.turning = ants.map(() => 0);
    this.tick = 0;
  }

  private updateWinding(ants: Ant[]) {
    const { displacementWindow, minSpeed, maxTurnPerTick, windingWindow } =
      this.settings;

    const decay = 1 - 1 / windingWindow;
    const slot = this.tick % displacementWindow;

    ants.forEach((ant, i) => {
      const k = i * displacementWindow + slot;

      const dx = ant.x - this.historyX[k];
      const dy = ant.y - this.historyY[k];

      this.historyX[k] = ant.x;
      this.historyY[k] = ant.y;

      this.velocityX[i] = dx / displacementWindow;
      this.velocityY[i] = dy / displacementWindow;

      this.winding[i] *= decay;
      this.turning[i] *= decay;
      this.lastTurn[i] = 0;

      if (Math.hypot(dx, dy) < minSpeed * displacementWindow) {
        return;
      }

      const direction = Math.atan2(dy, dx);
      const turn = wrapAngle(direction - this.heading[i]);

      if (Math.abs(turn) <= maxTurnPerTick) {
        this.winding[i] += turn;
        this.turning[i] += Math.abs(turn);
        this.lastTurn[i] = turn;
      }

      this.heading[i] = direction;
    });

    this.tick++;
  }

  private describe(
    ants: Ant[],
    participants: number[],
    sense: number,
  ): MillSnapshot {
    const snapshot: MillSnapshot = {
      participants: participants.length,
      sense,
      centerX: 0,
      centerY: 0,
      meanRadius: 0,
      order: 0,
      alignment: 0,
      angularVelocity: 0,
      rotating: false,
      episodeTicks: 0,
      episodeRotations: 0,
    };

    if (participants.length === 0) {
      return snapshot;
    }

    for (const i of participants) {
      snapshot.centerX += ants[i].x / participants.length;
      snapshot.centerY += ants[i].y / participants.length;
      snapshot.angularVelocity +=
        (sense * this.lastTurn[i]) / participants.length;
    }

    let crossSum = 0;
    let radiusSum = 0;
    let aligned = 0;
    let counted = 0;

    for (const i of participants) {
      const vx = this.velocityX[i];
      const vy = this.velocityY[i];

      const dx = ants[i].x - snapshot.centerX;
      const dy = ants[i].y - snapshot.centerY;
      const radius = Math.hypot(dx, dy);
      const speed = Math.hypot(vx, vy);

      if (radius < 1 || speed === 0) {
        continue;
      }

      const cross = dx * vy - dy * vx;

      crossSum += cross / (radius * speed);
      radiusSum += radius;
      aligned += Math.sign(cross) === sense ? 1 : 0;
      counted++;
    }

    if (counted > 0) {
      snapshot.order = Math.abs(crossSum) / counted;
      snapshot.alignment = aligned / counted;
      snapshot.meanRadius = radiusSum / counted;
    }

    snapshot.rotating =
      snapshot.participants >= this.settings.minParticipants &&
      snapshot.alignment >= this.settings.minAlignment;

    return snapshot;
  }

  private track(snapshot: MillSnapshot) {
    this.orderSum += snapshot.order;

    if (!snapshot.rotating) {
      this.episodeTicks = 0;
      this.episodeAngle = 0;
      this.episodeCenter = null;
      return;
    }

    const continues =
      this.episodeCenter !== null &&
      Math.hypot(
        snapshot.centerX - this.episodeCenter[0],
        snapshot.centerY - this.episodeCenter[1],
      ) <= this.settings.centerTolerance;

    if (!continues) {
      this.episodeTicks = 0;
      this.episodeAngle = 0;
    }

    this.episodeTicks++;
    this.episodeAngle += Math.max(0, snapshot.angularVelocity);
    this.episodeCenter = [snapshot.centerX, snapshot.centerY];

    this.rotatingTicks++;
    this.longestEpisodeTicks = Math.max(
      this.longestEpisodeTicks,
      this.episodeTicks,
    );
    this.maxEpisodeAngle = Math.max(this.maxEpisodeAngle, this.episodeAngle);
    this.maxParticipants = Math.max(
      this.maxParticipants,
      snapshot.participants,
    );

    snapshot.episodeTicks = this.episodeTicks;
    snapshot.episodeRotations = this.episodeAngle / (2 * Math.PI);
  }
}

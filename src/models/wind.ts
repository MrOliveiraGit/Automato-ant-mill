/*
 * Vento uniforme que atua só sobre o campo de feromônio (termo de advecção
 * −v_wind·∇g em AntRules.diffusePheromone) — nunca sobre as formigas, que só
 * o percebem indiretamente pelo gradiente de feromônio deslocado.
 * `directionX`/`directionY` seguem a convenção do grid (x = linha, y = coluna)
 * e só definem a direção; `strength` é a velocidade em células por tick.
 */
export class Wind {
  constructor(
    public directionX: number,
    public directionY: number,
    public strength: number,
  ) {}

  velocity(): [number, number] {
    const length = Math.hypot(this.directionX, this.directionY);

    if (length === 0) {
      return [0, 0];
    }

    return [
      (this.directionX / length) * this.strength,
      (this.directionY / length) * this.strength,
    ];
  }
}

/*
 * Posição contínua (x = linha, y = coluna, em células): a formiga está na
 * célula (floor(x), floor(y)). O feromônio continua num grid, mas o
 * movimento não fica preso às 8 direções dos vizinhos — é isso que permite
 * curvas suaves e, portanto, trilhas circulares.
 */
export class Ant {
  // direção de deslocamento (rad): passo = (cos, sin) no referencial (x, y).
  // É a memória da formiga — só muda pela virada e pelo ruído de cada tick.
  public heading: number;

  constructor(
    public x: number,
    public y: number,
  ) {
    this.heading = Math.random() * Math.PI * 2;
  }

  get cellX(): number {
    return Math.floor(this.x);
  }

  get cellY(): number {
    return Math.floor(this.y);
  }
}

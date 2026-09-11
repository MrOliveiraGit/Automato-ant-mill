export class Ant {
  public levyRemainingSteps = 0;
  public levyDirectionX = 0;
  public levyDirectionY = 0;

  // direção de deslocamento memorizada (mistura memória + reforço)
  public dirX: number;
  public dirY: number;

  constructor(
    public x: number,
    public y: number,
  ) {
    const angle = Math.random() * Math.PI * 2;

    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
  }
}

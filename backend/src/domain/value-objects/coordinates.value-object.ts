export class Coordinates {
  private constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  static create(x: number, y: number): Coordinates {
    return new Coordinates(x, y);
  }

  equals(other: Coordinates): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

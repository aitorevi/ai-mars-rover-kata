import { Coordinates } from './coordinates.value-object';

export class GridDimensions {
  private constructor(
    public readonly width: number,
    public readonly height: number,
  ) {}

  static create(width: number, height: number): GridDimensions {
    if (width <= 0 || height <= 0) {
      throw new Error('Grid dimensions must be positive numbers');
    }
    return new GridDimensions(width, height);
  }

  contains(coordinates: Coordinates): boolean {
    return (
      coordinates.x >= 0 &&
      coordinates.x < this.width &&
      coordinates.y >= 0 &&
      coordinates.y < this.height
    );
  }
}

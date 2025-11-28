import { Coordinates } from './coordinates.value-object';

export class Obstacle {
  private constructor(public readonly position: Coordinates) {}

  static at(coordinates: Coordinates): Obstacle {
    return new Obstacle(coordinates);
  }

  blocksPosition(coordinates: Coordinates): boolean {
    return this.position.equals(coordinates);
  }
}

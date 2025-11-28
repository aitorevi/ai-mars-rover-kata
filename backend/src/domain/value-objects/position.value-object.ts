import { Coordinates } from './coordinates.value-object';
import { Direction } from './direction.value-object';

export class Position {
  private constructor(
    public readonly coordinates: Coordinates,
    public readonly direction: Direction,
  ) {}

  static at(coordinates: Coordinates, direction: Direction): Position {
    return new Position(coordinates, direction);
  }

  equals(other: Position): boolean {
    return (
      this.coordinates.equals(other.coordinates) &&
      this.direction.equals(other.direction)
    );
  }
}

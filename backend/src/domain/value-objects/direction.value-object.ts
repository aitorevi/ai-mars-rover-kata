import { Coordinates } from './coordinates.value-object';

export enum CardinalDirection {
  NORTH = 'NORTH',
  EAST = 'EAST',
  SOUTH = 'SOUTH',
  WEST = 'WEST',
}

export class Direction {
  private constructor(public readonly value: CardinalDirection) {}

  static north(): Direction {
    return new Direction(CardinalDirection.NORTH);
  }

  static east(): Direction {
    return new Direction(CardinalDirection.EAST);
  }

  static south(): Direction {
    return new Direction(CardinalDirection.SOUTH);
  }

  static west(): Direction {
    return new Direction(CardinalDirection.WEST);
  }

  equals(other: Direction): boolean {
    return this.value === other.value;
  }

  // Rotate 90 degrees counter-clockwise (left)
  rotateLeft(): Direction {
    const rotationMap: Record<CardinalDirection, CardinalDirection> = {
      [CardinalDirection.NORTH]: CardinalDirection.WEST,
      [CardinalDirection.WEST]: CardinalDirection.SOUTH,
      [CardinalDirection.SOUTH]: CardinalDirection.EAST,
      [CardinalDirection.EAST]: CardinalDirection.NORTH,
    };
    return new Direction(rotationMap[this.value]);
  }

  // Rotate 90 degrees clockwise (right)
  rotateRight(): Direction {
    const rotationMap: Record<CardinalDirection, CardinalDirection> = {
      [CardinalDirection.NORTH]: CardinalDirection.EAST,
      [CardinalDirection.EAST]: CardinalDirection.SOUTH,
      [CardinalDirection.SOUTH]: CardinalDirection.WEST,
      [CardinalDirection.WEST]: CardinalDirection.NORTH,
    };
    return new Direction(rotationMap[this.value]);
  }

  // Calculate next coordinates based on movement direction
  calculateNextCoordinates(
    current: Coordinates,
    moveForward: boolean,
  ): Coordinates {
    const delta = this.getMovementDelta(moveForward);
    return Coordinates.create(current.x + delta.x, current.y + delta.y);
  }

  private getMovementDelta(
    forward: boolean,
  ): { x: number; y: number } {
    const multiplier = forward ? 1 : -1;

    switch (this.value) {
      case CardinalDirection.NORTH:
        return { x: 0, y: 1 * multiplier };
      case CardinalDirection.EAST:
        return { x: 1 * multiplier, y: 0 };
      case CardinalDirection.SOUTH:
        return { x: 0, y: -1 * multiplier };
      case CardinalDirection.WEST:
        return { x: -1 * multiplier, y: 0 };
    }
  }
}

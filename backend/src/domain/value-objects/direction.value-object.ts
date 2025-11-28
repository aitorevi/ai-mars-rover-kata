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
}

import { Position } from '../value-objects/position.value-object';
import { Grid } from '../aggregates/grid.aggregate';

export type MovementCommand = 'F' | 'B';

export class Rover {
  private constructor(
    private readonly id: string,
    private _position: Position,
  ) {}

  static deploy(id: string, initialPosition: Position): Rover {
    return new Rover(id, initialPosition);
  }

  get position(): Position {
    return this._position;
  }

  getId(): string {
    return this.id;
  }

  // Move rover forward or backward
  move(command: MovementCommand, grid: Grid): void {
    const isForward = command === 'F';

    const nextCoordinates = this._position.direction.calculateNextCoordinates(
      this._position.coordinates,
      isForward,
    );

    grid.validateMovement(nextCoordinates);

    this._position = this._position.withCoordinates(nextCoordinates);
  }
}

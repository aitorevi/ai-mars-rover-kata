import { Position } from '../value-objects/position.value-object';

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
}

import { Rover } from '../entities/rover.entity';
import { Coordinates } from '../value-objects/coordinates.value-object';
import { Direction } from '../value-objects/direction.value-object';
import { GridDimensions } from '../value-objects/grid-dimensions.value-object';
import { Position } from '../value-objects/position.value-object';
import { OutOfBoundsException } from '../exceptions/out-of-bounds.exception';

export class Grid {
  private constructor(
    private readonly dimensions: GridDimensions,
    private readonly obstacles: any[],
  ) {}

  static create(dimensions: GridDimensions, obstacles: any[] = []): Grid {
    return new Grid(dimensions, obstacles);
  }

  deployRover(roverId: string, coordinates: Coordinates, direction: Direction): Rover {
    this.validateDeploymentPosition(coordinates);

    const position = Position.at(coordinates, direction);
    return Rover.deploy(roverId, position);
  }

  private validateDeploymentPosition(coordinates: Coordinates): void {
    if (!this.dimensions.contains(coordinates)) {
      throw new OutOfBoundsException(
        `Cannot deploy rover at (${coordinates.x},${coordinates.y}): coordinates out of grid bounds`,
      );
    }
  }
}

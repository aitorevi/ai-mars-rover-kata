import { Injectable, Inject } from '@nestjs/common';
import { DeployRoverCommand } from '../commands/deploy-rover.command';
import { RoverRepository } from '../../domain/port/rover.repository.port';
import { GridRepository } from '../../domain/port/grid.repository.port';
import { Coordinates } from '../../domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../domain/value-objects/direction.value-object';

@Injectable()
export class DeployRoverUseCase {
  constructor(
    @Inject('RoverRepository') private readonly roverRepository: RoverRepository,
    @Inject('GridRepository') private readonly gridRepository: GridRepository,
  ) {}

  async execute(command: DeployRoverCommand): Promise<void> {
    const grid = await this.gridRepository.getGrid();

    const coordinates = Coordinates.create(command.x, command.y);
    const direction = this.parseDirection(command.direction);

    const rover = grid.deployRover(command.roverId, coordinates, direction);

    await this.roverRepository.save(rover);
  }

  private parseDirection(direction: string): Direction {
    const directionMap = {
      NORTH: Direction.north(),
      EAST: Direction.east(),
      SOUTH: Direction.south(),
      WEST: Direction.west(),
    };
    return directionMap[direction as CardinalDirection];
  }
}

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { MoveRoverCommand } from '../commands/move-rover.command';
import { RoverRepository } from '../../domain/port/rover.repository.port';
import { GridRepository } from '../../domain/port/grid.repository.port';

@Injectable()
export class MoveRoverUseCase {
  constructor(
    @Inject('RoverRepository') private readonly roverRepository: RoverRepository,
    @Inject('GridRepository') private readonly gridRepository: GridRepository,
  ) {}

  async execute(command: MoveRoverCommand): Promise<void> {
    const rover = await this.roverRepository.findById(command.roverId);

    if (!rover) {
      throw new NotFoundException(
        `Rover with id ${command.roverId} not found`,
      );
    }

    const grid = await this.gridRepository.getGrid();

    rover.move(command.command, grid);

    await this.roverRepository.save(rover);
  }
}

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { RotateRoverCommand } from '../commands/rotate-rover.command';
import { RoverRepository } from '../../domain/port/rover.repository.port';

@Injectable()
export class RotateRoverUseCase {
  constructor(
    @Inject('RoverRepository') private readonly roverRepository: RoverRepository,
  ) {}

  async execute(command: RotateRoverCommand): Promise<void> {
    const rover = await this.roverRepository.findById(command.roverId);

    if (!rover) {
      throw new NotFoundException(
        `Rover with id ${command.roverId} not found`,
      );
    }

    rover.rotate(command.command);

    await this.roverRepository.save(rover);
  }
}

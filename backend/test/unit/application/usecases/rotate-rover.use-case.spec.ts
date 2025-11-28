import { RotateRoverUseCase } from '../../../../src/application/usecases/rotate-rover.use-case';
import { RotateRoverCommand } from '../../../../src/application/commands/rotate-rover.command';
import { InMemoryRoverRepository } from '../../../../src/infrastructure/persistence/in-memory-rover.repository';
import { Rover } from '../../../../src/domain/entities/rover.entity';
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { NotFoundException } from '@nestjs/common';

describe('RotateRoverUseCase', () => {
  let useCase: RotateRoverUseCase;
  let roverRepository: InMemoryRoverRepository;

  beforeEach(() => {
    roverRepository = new InMemoryRoverRepository();
    useCase = new RotateRoverUseCase(roverRepository);
  });

  describe('successful rotation', () => {
    it('should rotate rover left and persist new direction', async () => {
      // Arrange: deploy rover at (5,5) facing north
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new RotateRoverCommand('rover-1', 'L');

      // Act: execute rotation
      await useCase.execute(command);

      // Assert: rover now facing west, coordinates unchanged
      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover).toBeDefined();
      expect(updatedRover!.position.coordinates.x).toBe(5);
      expect(updatedRover!.position.coordinates.y).toBe(5);
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.WEST);
    });

    it('should rotate rover right and persist new direction', async () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new RotateRoverCommand('rover-1', 'R');

      await useCase.execute(command);

      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.EAST);
      // Coordinates unchanged
      expect(updatedRover!.position.coordinates.x).toBe(5);
      expect(updatedRover!.position.coordinates.y).toBe(5);
    });

    it('should handle multiple sequential rotations', async () => {
      const initialPosition = Position.at(
        Coordinates.create(3, 7),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      // Rotate left (WEST)
      await useCase.execute(new RotateRoverCommand('rover-1', 'L'));

      // Rotate left again (SOUTH)
      await useCase.execute(new RotateRoverCommand('rover-1', 'L'));

      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.SOUTH);
      // Still at original position
      expect(updatedRover!.position.coordinates.x).toBe(3);
      expect(updatedRover!.position.coordinates.y).toBe(7);
    });
  });

  describe('error scenarios', () => {
    it('should throw NotFoundException when rover does not exist', async () => {
      const command = new RotateRoverCommand('non-existent-rover', 'L');

      await expect(useCase.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should not modify repository when rover not found', async () => {
      // Arrange: deploy a different rover
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('existing-rover', initialPosition);
      await roverRepository.save(rover);

      // Act: try to rotate non-existent rover
      try {
        await useCase.execute(new RotateRoverCommand('other-rover', 'L'));
      } catch (e) {
        // Expected to throw
      }

      // Assert: existing rover unchanged
      const unchangedRover = await roverRepository.findById('existing-rover');
      expect(unchangedRover!.position.direction.value).toBe(CardinalDirection.NORTH);
    });
  });
});

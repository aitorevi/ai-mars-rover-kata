import { MoveRoverUseCase } from '../../../../src/application/usecases/move-rover.use-case';
import { MoveRoverCommand } from '../../../../src/application/commands/move-rover.command';
import { InMemoryRoverRepository } from '../../../../src/infrastructure/persistence/in-memory-rover.repository';
import { InMemoryGridRepository } from '../../../../src/infrastructure/persistence/in-memory-grid.repository';
import { Rover } from '../../../../src/domain/entities/rover.entity';
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { GridDimensions } from '../../../../src/domain/value-objects/grid-dimensions.value-object';
import { Obstacle } from '../../../../src/domain/value-objects/obstacle.value-object';
import { NotFoundException } from '@nestjs/common';
import { OutOfBoundsException } from '../../../../src/domain/exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../../../../src/domain/exceptions/obstacle-detected.exception';

describe('MoveRoverUseCase', () => {
  let useCase: MoveRoverUseCase;
  let roverRepository: InMemoryRoverRepository;
  let gridRepository: InMemoryGridRepository;

  beforeEach(() => {
    roverRepository = new InMemoryRoverRepository();
    gridRepository = new InMemoryGridRepository();
    useCase = new MoveRoverUseCase(roverRepository, gridRepository);

    // Setup default 10x10 grid
    const dimensions = GridDimensions.create(10, 10);
    gridRepository.setGrid(dimensions, []);
  });

  describe('successful movement', () => {
    it('should move rover forward and persist new position', async () => {
      // Arrange: deploy rover at (5,5) facing north
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'F');

      // Act: execute movement
      await useCase.execute(command);

      // Assert: rover moved to (5,6)
      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover).toBeDefined();
      expect(updatedRover!.position.coordinates.x).toBe(5);
      expect(updatedRover!.position.coordinates.y).toBe(6);
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.NORTH);
    });

    it('should move rover backward and persist new position', async () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'B');

      await useCase.execute(command);

      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover!.position.coordinates.y).toBe(4); // moved backward
    });
  });

  describe('error scenarios', () => {
    it('should throw NotFoundException when rover does not exist', async () => {
      const command = new MoveRoverCommand('non-existent-rover', 'F');

      await expect(useCase.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should propagate OutOfBoundsException from domain', async () => {
      // Arrange: rover at north edge (5,9)
      const edgePosition = Position.at(
        Coordinates.create(5, 9),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', edgePosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'F');

      // Act & Assert: attempt to exit bounds
      await expect(useCase.execute(command)).rejects.toThrow(OutOfBoundsException);

      // Rover should not have changed
      const unchangedRover = await roverRepository.findById('rover-1');
      expect(unchangedRover!.position.coordinates.y).toBe(9);
    });

    it('should propagate ObstacleDetectedException from domain', async () => {
      // Arrange: grid with obstacle at (5,6)
      const dimensions = GridDimensions.create(10, 10);
      const obstaclePosition = Coordinates.create(5, 6);
      gridRepository.setGrid(dimensions, [Obstacle.at(obstaclePosition)]);

      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'F');

      // Act & Assert: obstacle blocks movement
      await expect(useCase.execute(command)).rejects.toThrow(ObstacleDetectedException);

      // Rover should remain at original position
      const unchangedRover = await roverRepository.findById('rover-1');
      expect(unchangedRover!.position.coordinates.y).toBe(5);
    });
  });
});

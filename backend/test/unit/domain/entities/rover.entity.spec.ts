import { Rover, MovementCommand } from '../../../../src/domain/entities/rover.entity';
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { Grid } from '../../../../src/domain/aggregates/grid.aggregate';
import { GridDimensions } from '../../../../src/domain/value-objects/grid-dimensions.value-object';
import { Obstacle } from '../../../../src/domain/value-objects/obstacle.value-object';
import { OutOfBoundsException } from '../../../../src/domain/exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../../../../src/domain/exceptions/obstacle-detected.exception';

describe('Rover Entity', () => {
  let grid: Grid;

  beforeEach(() => {
    const dimensions = GridDimensions.create(10, 10);
    grid = Grid.create(dimensions, []);
  });

  describe('moving forward', () => {
    it('should move one cell north when facing north', () => {
      // Arrange: rover at (5,5) facing north
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      // Act: move forward
      rover.move('F', grid);

      // Assert: rover now at (5,6)
      expect(rover.position.coordinates.x).toBe(5);
      expect(rover.position.coordinates.y).toBe(6);
      expect(rover.position.direction.value).toBe(CardinalDirection.NORTH);
    });

    it('should move one cell east when facing east', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.east(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('F', grid);

      expect(rover.position.coordinates.x).toBe(6);
      expect(rover.position.coordinates.y).toBe(5);
    });

    it('should move one cell south when facing south', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.south(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('F', grid);

      expect(rover.position.coordinates.x).toBe(5);
      expect(rover.position.coordinates.y).toBe(4);
    });

    it('should move one cell west when facing west', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.west(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('F', grid);

      expect(rover.position.coordinates.x).toBe(4);
      expect(rover.position.coordinates.y).toBe(5);
    });
  });

  describe('moving backward', () => {
    it('should move one cell south when facing north', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('B', grid);

      expect(rover.position.coordinates.x).toBe(5);
      expect(rover.position.coordinates.y).toBe(4); // moving backward
    });

    it('should move one cell west when facing east', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.east(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('B', grid);

      expect(rover.position.coordinates.x).toBe(4);
      expect(rover.position.coordinates.y).toBe(5);
    });
  });

  describe('encountering obstacles', () => {
    it('should stop and throw exception when obstacle blocks forward movement', () => {
      // Arrange: obstacle at (5,6), rover at (5,5) facing north
      const obstaclePosition = Coordinates.create(5, 6);
      const dimensions = GridDimensions.create(10, 10);
      const gridWithObstacle = Grid.create(dimensions, [
        Obstacle.at(obstaclePosition),
      ]);

      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      // Act & Assert: move attempt should fail
      expect(() => {
        rover.move('F', gridWithObstacle);
      }).toThrow(ObstacleDetectedException);

      // Rover should NOT have moved
      expect(rover.position.coordinates.x).toBe(5);
      expect(rover.position.coordinates.y).toBe(5);
    });

    it('should stop and throw exception when obstacle blocks backward movement', () => {
      const obstaclePosition = Coordinates.create(5, 4);
      const dimensions = GridDimensions.create(10, 10);
      const gridWithObstacle = Grid.create(dimensions, [
        Obstacle.at(obstaclePosition),
      ]);

      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      expect(() => {
        rover.move('B', gridWithObstacle);
      }).toThrow(ObstacleDetectedException);

      // Rover should remain at original position
      expect(rover.position.coordinates.x).toBe(5);
      expect(rover.position.coordinates.y).toBe(5);
    });
  });

  describe('respecting grid boundaries', () => {
    it('should throw exception when moving beyond north boundary', () => {
      // Arrange: rover at (5,9) in 10x10 grid, facing north
      const initialPosition = Position.at(
        Coordinates.create(5, 9),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      // Act & Assert: move beyond bounds
      expect(() => {
        rover.move('F', grid);
      }).toThrow(OutOfBoundsException);

      // Rover should NOT have moved
      expect(rover.position.coordinates.y).toBe(9);
    });

    it('should throw exception when moving beyond east boundary', () => {
      const initialPosition = Position.at(
        Coordinates.create(9, 5),
        Direction.east(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      expect(() => {
        rover.move('F', grid);
      }).toThrow(OutOfBoundsException);

      expect(rover.position.coordinates.x).toBe(9);
    });

    it('should throw exception when moving beyond south boundary', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 0),
        Direction.south(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      expect(() => {
        rover.move('F', grid);
      }).toThrow(OutOfBoundsException);

      expect(rover.position.coordinates.y).toBe(0);
    });

    it('should throw exception when moving beyond west boundary', () => {
      const initialPosition = Position.at(
        Coordinates.create(0, 5),
        Direction.west(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      expect(() => {
        rover.move('F', grid);
      }).toThrow(OutOfBoundsException);

      expect(rover.position.coordinates.x).toBe(0);
    });
  });
});

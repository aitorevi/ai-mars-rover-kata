import { Rover, MovementCommand, RotationCommand } from '../../../../src/domain/entities/rover.entity';
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

  describe('edge cases with corner positions', () => {
    it('should move correctly from origin (0,0) facing east', () => {
      const initialPosition = Position.at(
        Coordinates.create(0, 0),
        Direction.east(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('F', grid);

      expect(rover.position.coordinates.x).toBe(1);
      expect(rover.position.coordinates.y).toBe(0);
    });

    it('should move correctly from origin (0,0) facing north', () => {
      const initialPosition = Position.at(
        Coordinates.create(0, 0),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('F', grid);

      expect(rover.position.coordinates.x).toBe(0);
      expect(rover.position.coordinates.y).toBe(1);
    });

    it('should move correctly from boundary (9,9) facing west', () => {
      const initialPosition = Position.at(
        Coordinates.create(9, 9),
        Direction.west(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('F', grid);

      expect(rover.position.coordinates.x).toBe(8);
      expect(rover.position.coordinates.y).toBe(9);
    });

    it('should move correctly from boundary (9,9) facing south', () => {
      const initialPosition = Position.at(
        Coordinates.create(9, 9),
        Direction.south(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.move('F', grid);

      expect(rover.position.coordinates.x).toBe(9);
      expect(rover.position.coordinates.y).toBe(8);
    });

    it('should throw exception when moving backward from (0,0) facing north', () => {
      const initialPosition = Position.at(
        Coordinates.create(0, 0),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      expect(() => {
        rover.move('B', grid);
      }).toThrow(OutOfBoundsException);

      expect(rover.position.coordinates.x).toBe(0);
      expect(rover.position.coordinates.y).toBe(0);
    });

    it('should throw exception when moving backward from (9,9) facing south', () => {
      const initialPosition = Position.at(
        Coordinates.create(9, 9),
        Direction.south(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      expect(() => {
        rover.move('B', grid);
      }).toThrow(OutOfBoundsException);

      expect(rover.position.coordinates.x).toBe(9);
      expect(rover.position.coordinates.y).toBe(9);
    });
  });

  describe('rotating left', () => {
    it('should face west when rotating left from north', () => {
      // Arrange: rover at (5,5) facing north
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      // Act: rotate left
      rover.rotate('L');

      // Assert: rover now facing west, coordinates unchanged
      expect(rover.position.coordinates.x).toBe(5);
      expect(rover.position.coordinates.y).toBe(5);
      expect(rover.position.direction.value).toBe(CardinalDirection.WEST);
    });

    it('should face south when rotating left from west', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.west(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('L');

      expect(rover.position.direction.value).toBe(CardinalDirection.SOUTH);
      expect(rover.position.coordinates.x).toBe(5); // unchanged
      expect(rover.position.coordinates.y).toBe(5); // unchanged
    });

    it('should face east when rotating left from south', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.south(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('L');

      expect(rover.position.direction.value).toBe(CardinalDirection.EAST);
    });

    it('should face north when rotating left from east', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.east(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('L');

      expect(rover.position.direction.value).toBe(CardinalDirection.NORTH);
    });
  });

  describe('rotating right', () => {
    it('should face east when rotating right from north', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('R');

      expect(rover.position.coordinates.x).toBe(5); // unchanged
      expect(rover.position.coordinates.y).toBe(5); // unchanged
      expect(rover.position.direction.value).toBe(CardinalDirection.EAST);
    });

    it('should face south when rotating right from east', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.east(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('R');

      expect(rover.position.direction.value).toBe(CardinalDirection.SOUTH);
    });

    it('should face west when rotating right from south', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.south(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('R');

      expect(rover.position.direction.value).toBe(CardinalDirection.WEST);
    });

    it('should face north when rotating right from west', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.west(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('R');

      expect(rover.position.direction.value).toBe(CardinalDirection.NORTH);
    });
  });

  describe('multiple rotations', () => {
    it('should return to original direction after four left rotations', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('L');
      rover.rotate('L');
      rover.rotate('L');
      rover.rotate('L');

      expect(rover.position.direction.value).toBe(CardinalDirection.NORTH);
      expect(rover.position.coordinates.x).toBe(5); // still at same position
      expect(rover.position.coordinates.y).toBe(5);
    });

    it('should return to original direction after four right rotations', () => {
      const initialPosition = Position.at(
        Coordinates.create(3, 7),
        Direction.east(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('R');
      rover.rotate('R');
      rover.rotate('R');
      rover.rotate('R');

      expect(rover.position.direction.value).toBe(CardinalDirection.EAST);
    });

    it('should handle alternating rotations', () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('L');  // WEST
      rover.rotate('R');  // NORTH
      rover.rotate('R');  // EAST
      rover.rotate('L');  // NORTH

      expect(rover.position.direction.value).toBe(CardinalDirection.NORTH);
    });
  });

  describe('coordinates remain unchanged during rotation', () => {
    it('should keep rover at same position regardless of rotations', () => {
      const initialPosition = Position.at(
        Coordinates.create(3, 7),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      rover.rotate('L');
      rover.rotate('R');
      rover.rotate('R');
      rover.rotate('L');
      rover.rotate('L');

      // Position unchanged after any number of rotations
      expect(rover.position.coordinates.x).toBe(3);
      expect(rover.position.coordinates.y).toBe(7);
    });
  });
});

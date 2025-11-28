import { Grid } from '../../../../src/domain/aggregates/grid.aggregate';
import { GridDimensions } from '../../../../src/domain/value-objects/grid-dimensions.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction } from '../../../../src/domain/value-objects/direction.value-object';
import { CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { OutOfBoundsException } from '../../../../src/domain/exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../../../../src/domain/exceptions/obstacle-detected.exception';
import { Obstacle } from '../../../../src/domain/value-objects/obstacle.value-object';

describe('Grid Aggregate', () => {
  describe('deploying rover', () => {
    it('should deploy rover at valid position', () => {
      // Arrange: cuadrícula 10x10 sin obstáculos en (3,5)
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const validCoordinates = Coordinates.create(3, 5);

      // Act: desplegar en posición válida
      const rover = grid.deployRover('rover-1', validCoordinates, Direction.north());

      // Assert: rover creado correctamente
      expect(rover).toBeDefined();
      expect(rover.position.coordinates.x).toBe(3);
      expect(rover.position.coordinates.y).toBe(5);
      expect(rover.position.direction.value).toBe(CardinalDirection.NORTH);
    });

    it('should reject deployment when X coordinate exceeds grid width', () => {
      // Arrange: cuadrícula 10x10
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(15, 5);

      // Act & Assert: intento desplegar en (15,5) debe fallar
      expect(() => {
        grid.deployRover('rover-1', invalidCoordinates, Direction.north());
      }).toThrow(OutOfBoundsException);
    });

    it('should reject deployment when Y coordinate exceeds grid height', () => {
      // Arrange
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(5, 20);

      // Act & Assert
      expect(() => {
        grid.deployRover('rover-1', invalidCoordinates, Direction.north());
      }).toThrow(OutOfBoundsException);
    });

    it('should reject deployment when coordinates are negative', () => {
      // Arrange
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(-1, 5);

      // Act & Assert
      expect(() => {
        grid.deployRover('rover-1', invalidCoordinates, Direction.north());
      }).toThrow(OutOfBoundsException);
    });

    it('should reject deployment when Y coordinate is negative', () => {
      // Arrange
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(5, -1);

      // Act & Assert
      expect(() => {
        grid.deployRover('rover-1', invalidCoordinates, Direction.north());
      }).toThrow(OutOfBoundsException);
    });

    it('should reject deployment when obstacle blocks position', () => {
      // Arrange: cuadrícula con obstáculo en (4,4)
      const dimensions = GridDimensions.create(10, 10);
      const obstaclePosition = Coordinates.create(4, 4);
      const obstacles = [Obstacle.at(obstaclePosition)];
      const grid = Grid.create(dimensions, obstacles);

      // Act & Assert: desplegar en (4,4) debe fallar
      expect(() => {
        grid.deployRover('rover-1', obstaclePosition, Direction.north());
      }).toThrow(ObstacleDetectedException);
    });

    it('should allow deployment adjacent to obstacle', () => {
      // Arrange: cuadrícula con obstáculo en (4,4)
      const dimensions = GridDimensions.create(10, 10);
      const obstaclePosition = Coordinates.create(4, 4);
      const obstacles = [Obstacle.at(obstaclePosition)];
      const grid = Grid.create(dimensions, obstacles);
      const adjacentCoordinates = Coordinates.create(5, 4);

      // Act: desplegar en (5,4) debe ser permitido
      const rover = grid.deployRover('rover-1', adjacentCoordinates, Direction.north());

      // Assert
      expect(rover).toBeDefined();
      expect(rover.position.coordinates.equals(adjacentCoordinates)).toBe(true);
    });

    it('should deploy rover at origin (0,0)', () => {
      // Arrange: grid 10x10
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const originCoordinates = Coordinates.create(0, 0);

      // Act: desplegar en origen
      const rover = grid.deployRover('rover-1', originCoordinates, Direction.south());

      // Assert
      expect(rover).toBeDefined();
      expect(rover.position.coordinates.x).toBe(0);
      expect(rover.position.coordinates.y).toBe(0);
      expect(rover.position.direction.value).toBe(CardinalDirection.SOUTH);
    });

    it('should deploy rover at grid boundary (9,9)', () => {
      // Arrange: grid 10x10 - (9,9) es el límite máximo
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const boundaryCoordinates = Coordinates.create(9, 9);

      // Act: desplegar en límite
      const rover = grid.deployRover('rover-1', boundaryCoordinates, Direction.east());

      // Assert
      expect(rover).toBeDefined();
      expect(rover.position.coordinates.x).toBe(9);
      expect(rover.position.coordinates.y).toBe(9);
      expect(rover.position.direction.value).toBe(CardinalDirection.EAST);
    });

    it('should reject deployment when trying to exceed boundary on both axes', () => {
      // Arrange
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(10, 10);

      // Act & Assert
      expect(() => {
        grid.deployRover('rover-1', invalidCoordinates, Direction.west());
      }).toThrow(OutOfBoundsException);
    });
  });

  describe('validating movement', () => {
    it('should allow movement to valid position within bounds', () => {
      // Arrange
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const targetCoordinates = Coordinates.create(5, 5);

      // Act & Assert: should not throw
      expect(() => {
        grid.validateMovement(targetCoordinates);
      }).not.toThrow();
    });

    it('should reject movement outside grid boundaries (X too large)', () => {
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(10, 5);

      expect(() => {
        grid.validateMovement(invalidCoordinates);
      }).toThrow(OutOfBoundsException);
    });

    it('should reject movement outside grid boundaries (Y too large)', () => {
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(5, 15);

      expect(() => {
        grid.validateMovement(invalidCoordinates);
      }).toThrow(OutOfBoundsException);
    });

    it('should reject movement to position with obstacle', () => {
      const dimensions = GridDimensions.create(10, 10);
      const obstaclePosition = Coordinates.create(4, 4);
      const obstacles = [Obstacle.at(obstaclePosition)];
      const grid = Grid.create(dimensions, obstacles);

      expect(() => {
        grid.validateMovement(obstaclePosition);
      }).toThrow(ObstacleDetectedException);
    });

    it('should allow movement to grid edge (boundary case)', () => {
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const edgeCoordinates = Coordinates.create(9, 9);

      expect(() => {
        grid.validateMovement(edgeCoordinates);
      }).not.toThrow();
    });
  });
});

import { Grid } from '../../../../src/domain/aggregates/grid.aggregate';
import { GridDimensions } from '../../../../src/domain/value-objects/grid-dimensions.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction } from '../../../../src/domain/value-objects/direction.value-object';
import { CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { OutOfBoundsException } from '../../../../src/domain/exceptions/out-of-bounds.exception';

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
  });
});

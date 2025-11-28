import { Grid } from '../../../../src/domain/aggregates/grid.aggregate';
import { GridDimensions } from '../../../../src/domain/value-objects/grid-dimensions.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction } from '../../../../src/domain/value-objects/direction.value-object';
import { CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';

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
  });
});

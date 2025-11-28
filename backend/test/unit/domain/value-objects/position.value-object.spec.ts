import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction } from '../../../../src/domain/value-objects/direction.value-object';

describe('Position Value Object', () => {
  describe('updating coordinates', () => {
    it('should create new position with updated coordinates keeping direction', () => {
      // Arrange
      const originalCoordinates = Coordinates.create(5, 5);
      const direction = Direction.north();
      const position = Position.at(originalCoordinates, direction);
      const newCoordinates = Coordinates.create(5, 6);

      // Act
      const newPosition = position.withCoordinates(newCoordinates);

      // Assert
      expect(newPosition.coordinates.x).toBe(5);
      expect(newPosition.coordinates.y).toBe(6);
      expect(newPosition.direction.equals(direction)).toBe(true);
      // Verify original position is unchanged (immutability)
      expect(position.coordinates.x).toBe(5);
      expect(position.coordinates.y).toBe(5);
    });
  });
});

import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';

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

  describe('creating new position with different direction', () => {
    it('should create new position with updated direction keeping same coordinates', () => {
      // Arrange: position at (5,5) facing North
      const originalPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const newDirection = Direction.west();

      // Act: create new position with different direction
      const newPosition = originalPosition.withDirection(newDirection);

      // Assert: coordinates unchanged, direction changed
      expect(newPosition.coordinates.x).toBe(5);
      expect(newPosition.coordinates.y).toBe(5);
      expect(newPosition.direction.value).toBe(CardinalDirection.WEST);
    });

    it('should not mutate original position when creating new one', () => {
      const originalPosition = Position.at(
        Coordinates.create(3, 7),
        Direction.east(),
      );
      const originalDirection = originalPosition.direction.value;

      const newPosition = originalPosition.withDirection(Direction.south());

      // Original position unchanged (immutability)
      expect(originalPosition.direction.value).toBe(originalDirection);
      expect(originalPosition.direction.value).toBe(CardinalDirection.EAST);
    });
  });

  describe('symmetry with withCoordinates', () => {
    it('should allow chaining withCoordinates and withDirection', () => {
      const original = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );

      const modified = original
        .withCoordinates(Coordinates.create(7, 9))
        .withDirection(Direction.south());

      expect(modified.coordinates.x).toBe(7);
      expect(modified.coordinates.y).toBe(9);
      expect(modified.direction.value).toBe(CardinalDirection.SOUTH);
    });
  });
});

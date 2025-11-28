import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';

describe('Direction Value Object', () => {
  describe('calculating next coordinates', () => {
    describe('when moving forward', () => {
      it('should move one cell north when facing north', () => {
        // Arrange
        const direction = Direction.north();
        const current = Coordinates.create(5, 5);

        // Act
        const next = direction.calculateNextCoordinates(current, true);

        // Assert
        expect(next.x).toBe(5);
        expect(next.y).toBe(6); // y increases north
      });

      it('should move one cell east when facing east', () => {
        const direction = Direction.east();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, true);

        expect(next.x).toBe(6); // x increases east
        expect(next.y).toBe(5);
      });

      it('should move one cell south when facing south', () => {
        const direction = Direction.south();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, true);

        expect(next.x).toBe(5);
        expect(next.y).toBe(4); // y decreases south
      });

      it('should move one cell west when facing west', () => {
        const direction = Direction.west();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, true);

        expect(next.x).toBe(4); // x decreases west
        expect(next.y).toBe(5);
      });
    });

    describe('when moving backward', () => {
      it('should move one cell south when facing north', () => {
        const direction = Direction.north();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, false);

        expect(next.x).toBe(5);
        expect(next.y).toBe(4); // opposite of forward
      });

      it('should move one cell west when facing east', () => {
        const direction = Direction.east();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, false);

        expect(next.x).toBe(4);
        expect(next.y).toBe(5);
      });

      it('should move one cell north when facing south', () => {
        const direction = Direction.south();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, false);

        expect(next.x).toBe(5);
        expect(next.y).toBe(6);
      });

      it('should move one cell east when facing west', () => {
        const direction = Direction.west();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, false);

        expect(next.x).toBe(6);
        expect(next.y).toBe(5);
      });
    });
  });
});

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

  describe('rotating left (counter-clockwise)', () => {
    it('should face west when rotating left from north', () => {
      // Arrange
      const direction = Direction.north();

      // Act
      const rotated = direction.rotateLeft();

      // Assert
      expect(rotated.value).toBe(CardinalDirection.WEST);
    });

    it('should face south when rotating left from west', () => {
      const direction = Direction.west();

      const rotated = direction.rotateLeft();

      expect(rotated.value).toBe(CardinalDirection.SOUTH);
    });

    it('should face east when rotating left from south', () => {
      const direction = Direction.south();

      const rotated = direction.rotateLeft();

      expect(rotated.value).toBe(CardinalDirection.EAST);
    });

    it('should face north when rotating left from east', () => {
      const direction = Direction.east();

      const rotated = direction.rotateLeft();

      expect(rotated.value).toBe(CardinalDirection.NORTH);
    });

    it('should return to original direction after four left rotations', () => {
      const original = Direction.north();

      const afterFourRotations = original
        .rotateLeft()
        .rotateLeft()
        .rotateLeft()
        .rotateLeft();

      expect(afterFourRotations.value).toBe(original.value);
    });
  });

  describe('rotating right (clockwise)', () => {
    it('should face east when rotating right from north', () => {
      const direction = Direction.north();

      const rotated = direction.rotateRight();

      expect(rotated.value).toBe(CardinalDirection.EAST);
    });

    it('should face south when rotating right from east', () => {
      const direction = Direction.east();

      const rotated = direction.rotateRight();

      expect(rotated.value).toBe(CardinalDirection.SOUTH);
    });

    it('should face west when rotating right from south', () => {
      const direction = Direction.south();

      const rotated = direction.rotateRight();

      expect(rotated.value).toBe(CardinalDirection.WEST);
    });

    it('should face north when rotating right from west', () => {
      const direction = Direction.west();

      const rotated = direction.rotateRight();

      expect(rotated.value).toBe(CardinalDirection.NORTH);
    });

    it('should return to original direction after four right rotations', () => {
      const original = Direction.south();

      const afterFourRotations = original
        .rotateRight()
        .rotateRight()
        .rotateRight()
        .rotateRight();

      expect(afterFourRotations.value).toBe(original.value);
    });
  });

  describe('symmetry of rotations', () => {
    it('should cancel out when rotating left then right', () => {
      const original = Direction.north();

      const result = original.rotateLeft().rotateRight();

      expect(result.value).toBe(original.value);
    });

    it('should cancel out when rotating right then left', () => {
      const original = Direction.east();

      const result = original.rotateRight().rotateLeft();

      expect(result.value).toBe(original.value);
    });
  });
});

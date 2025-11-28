# Mars Rover Backend

A backend implementation of the Mars Rover kata using NestJS, TypeScript, and Domain-Driven Design with hexagonal architecture.

## Project Description

This backend provides APIs to control a rover on a Martian grid. The rover can be deployed to a specific location and direction, then commanded to move forward or backward while respecting grid boundaries and detecting obstacles.

## Architecture

The project follows **hexagonal architecture** (ports and adapters) with **Domain-Driven Design** principles:

```
src/
├── domain/                 # Core business logic (no external dependencies)
│   ├── aggregates/         # Grid aggregate
│   ├── entities/           # Rover entity
│   ├── exceptions/         # Domain-specific exceptions
│   ├── port/               # Interfaces (contracts)
│   └── value-objects/      # Direction, Position, Coordinates, etc.
├── application/            # Use cases and commands
│   ├── commands/           # DeployRoverCommand, MoveRoverCommand
│   └── usecases/           # DeployRoverUseCase, MoveRoverUseCase
└── infrastructure/         # Adapters and external implementations
    ├── config/             # NestJS module configuration
    ├── http/               # REST controllers
    └── persistence/        # In-memory repositories
```

## Features

### Deployed Features

#### 1. Deploy Rover
Deploy a rover to the grid at a specific location and orientation.

**Endpoint:**
```
POST /rovers/deploy
```

**Request:**
```json
{
  "roverId": "rover-1",
  "x": 5,
  "y": 5,
  "direction": "NORTH"
}
```

**Response:**
```json
{
  "roverId": "rover-1",
  "x": 5,
  "y": 5,
  "direction": "NORTH"
}
```

**Errors:**
- 400 Bad Request: Position outside grid bounds or occupied by obstacle
- 409 Conflict: Position blocked by obstacle

#### 2. Move Rover (Forward/Backward)
Move a rover forward or backward in its current direction.

**Endpoint:**
```
POST /rovers/:id/move
```

**Request:**
```json
{
  "command": "F"
}
```

Where `command` is:
- `F` - Move forward (in current direction)
- `B` - Move backward (opposite to current direction)

**Response:**
```json
{
  "roverId": "rover-1",
  "x": 5,
  "y": 6,
  "direction": "NORTH"
}
```

**Errors:**
- 404 Not Found: Rover does not exist
- 400 Bad Request: Movement would exceed grid boundaries
- 409 Conflict: Movement blocked by obstacle

### Supported Directions
- `NORTH` - Positive Y direction
- `EAST` - Positive X direction
- `SOUTH` - Negative Y direction
- `WEST` - Negative X direction

### Grid Configuration
- Default grid: 10x10 (coordinates 0-9 on both axes)
- Boundaries: Movement beyond grid limits throws OutOfBoundsException
- Obstacles: Static obstacles block movement (detectable before collision)

## Setup

### Installation

```bash
npm install
```

### Development

```bash
# Start development server with hot reload
npm run start:dev

# Server runs on http://localhost:3000
```

### Production

```bash
npm run build
npm run start:prod
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run specific test file
npm run test -- rover.entity.spec.ts

# Run tests matching pattern
npm run test -- --testNamePattern="moving forward"

# Run with coverage
npm run test:cov
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E test
npm run test:e2e -- move-rover.e2e-spec.ts
```

### Test Coverage

```bash
npm run test:cov
```

Current coverage:
- **Domain Layer:** 98% (core business logic)
- **Application Layer:** 100% (use cases)
- **Infrastructure:** 0% for HTTP (covered by E2E), 100% for repositories

## API Examples

### Deploy a Rover

```bash
curl -X POST http://localhost:3000/rovers/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "roverId": "rover-1",
    "x": 5,
    "y": 5,
    "direction": "NORTH"
  }'
```

### Move Rover Forward

```bash
curl -X POST http://localhost:3000/rovers/rover-1/move \
  -H "Content-Type: application/json" \
  -d '{"command": "F"}'
```

### Move Rover Backward

```bash
curl -X POST http://localhost:3000/rovers/rover-1/move \
  -H "Content-Type: application/json" \
  -d '{"command": "B"}'
```

### Sequential Movements

```bash
# Move forward 3 times
for i in {1..3}; do
  curl -X POST http://localhost:3000/rovers/rover-1/move \
    -H "Content-Type: application/json" \
    -d '{"command": "F"}'
done
```

## Implemented Tests

### Domain Layer Tests (51 unit tests)
- **Direction Value Object** (8 tests)
  - Forward movement in all 4 directions
  - Backward movement in all 4 directions

- **Position Value Object** (1 test)
  - Creating new position with updated coordinates

- **Grid Aggregate** (15 tests)
  - Deployment validation (bounds and obstacles)
  - Movement validation (bounds and obstacles)

- **Rover Entity** (18 tests)
  - Forward movement in 4 directions
  - Backward movement in 2 directions
  - Obstacle detection and blocking
  - Boundary respect in 4 directions
  - Corner cases (origin and boundary positions)

- **MoveRoverUseCase** (5 tests)
  - Successful forward/backward movements
  - Error handling (rover not found, out of bounds, obstacle)
  - State persistence

- **DeployRoverUseCase** (4 tests)
  - Successful deployment
  - Error handling

### E2E Tests (12 tests)
- **Move Rover API** (5 tests)
  - Forward movement
  - Backward movement
  - Non-existent rover (404)
  - Boundary exceeding (400)
  - Sequential movements

- **Deploy Rover API** (1 test)
  - Successful deployment

- **Health Check** (1 test)
  - Server health status

## Architecture Decisions

### Why Direction Calculates Movement
The `Direction` value object is responsible for calculating next coordinates because:
- It's the expert on cardinal movement semantics
- Encapsulates knowledge of how directions map to coordinate changes
- Follows "Tell Don't Ask" principle

### Why Grid Validates, Not Rover
The `Grid` aggregate validates movements because:
- Grid is the expert on boundaries and obstacles
- Rover is responsible for executing movements
- Separation of concerns: Rover moves, Grid validates legality

### Why Grid Parameter is Method Argument
The `Rover.move()` method receives Grid as parameter because:
- Avoids tight coupling (no stored reference)
- Maintains aggregate boundaries
- Enables dependency injection at use case level

### No Wrapping Grid
Boundaries throw exceptions rather than wrap around because:
- YAGNI principle: Not in current requirements
- Explicit error handling is better than silent wrapping
- Easy to extend with wrapping strategy if needed

## Extending the System

### Future Features (Architectural Foundation Ready)

1. **Rotation Commands (L/R)**
   - Add `rotateLeft()` and `rotateRight()` to Direction
   - Add 'L' | 'R' to MovementCommand type
   - Update Rover to handle rotation
   - Create RotateRoverUseCase

2. **Command Sequences**
   - Create ExecuteCommandSequenceUseCase
   - Accept "FFRFFLB" format
   - Execute each command with error handling

3. **Get Rover Position**
   - Create GetRoverPositionUseCase
   - Implement GET /rovers/:id/position
   - Eliminates inline query in MoveRoverController

4. **Grid Configuration**
   - Create ConfigureGridUseCase
   - Implement POST /grid/configure
   - Allow runtime obstacle setup for testing

5. **Multiple Rovers with Collision Detection**
   - Add RoverCollisionException
   - Track all rover positions in Grid
   - Validate movements don't collide with other rovers

6. **Toroidal (Wrapping) Grid**
   - Create WrappingGridDimensions class
   - Implement wrap() strategy
   - Make boundary behavior pluggable

## Code Quality Standards

- **TypeScript Strict Mode:** Enabled
- **Linting:** ESLint (via NestJS defaults)
- **Formatting:** Prettier (via NestJS defaults)
- **Testing Framework:** Jest
- **Test Strategy:** TDD (Red-Green-Refactor)
- **Test Coverage:** >90% for domain and application layers

## Project Structure Highlights

### Pure Domain (Zero Infrastructure Dependencies)
```typescript
// src/domain/entities/rover.entity.ts
export class Rover {
  move(command: MovementCommand, grid: Grid): void {
    // Pure business logic
    const nextCoordinates = this._position.direction
      .calculateNextCoordinates(this._position.coordinates, isForward);
    grid.validateMovement(nextCoordinates);
    this._position = this._position.withCoordinates(nextCoordinates);
  }
}
```

### Use Case Orchestration
```typescript
// src/application/usecases/move-rover.use-case.ts
@Injectable()
export class MoveRoverUseCase {
  async execute(command: MoveRoverCommand): Promise<void> {
    const rover = await this.roverRepository.findById(command.roverId);
    const grid = await this.gridRepository.getGrid();
    rover.move(command.command, grid);
    await this.roverRepository.save(rover);
  }
}
```

### HTTP Error Mapping
```typescript
// Infrastructure layer translates domain exceptions to HTTP status codes
if (error instanceof OutOfBoundsException) {
  throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
}
if (error instanceof ObstacleDetectedException) {
  throw new HttpException({...}, HttpStatus.CONFLICT);
}
```

## Development Notes

### Useful npm Commands

```bash
# Start development with watch
npm run start:dev

# Run tests in watch mode
npm run test -- --watch

# Run tests with coverage and watch
npm run test:cov -- --watch

# Run specific test file in watch
npm run test -- --watch rover.entity.spec.ts

# Format code
npm run format

# Lint code
npm run lint
```

### Test Naming Convention
Tests use business-readable names describing behavior, not implementation:
- Good: "should move one cell north when facing north"
- Bad: "should increment y coordinate by 1"

### Debug Logging
Enable debug logging in development:
```bash
DEBUG=* npm run start:dev
```

## References

- [NestJS Documentation](https://docs.nestjs.com)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [Domain-Driven Design](https://en.wikipedia.org/wiki/Domain-driven_design)
- [Jest Testing Framework](https://jestjs.io/)

## License

This project is part of the Leanmind Mars Rover Kata training.

# Plan Arquitectónico: User Story "Mover Rover (Forward/Backward)"

## Resumen Ejecutivo

Esta funcionalidad representa el **segundo vertical slice** del sistema Mars Rover, construyendo sobre la arquitectura fundacional del despliegue. Implementaremos comandos de movimiento (Forward/Backward) que permiten al rover navegar la superficie marciana respetando límites de cuadrícula y detectando obstáculos. Esta funcionalidad introduce **lógica de negocio rica** en los Value Objects (Direction calcula movimientos) y demuestra cómo la arquitectura hexagonal facilita la extensión sin modificar los cimientos.

---

## 1. Análisis de Arquitectura

### Encaje en la Arquitectura Hexagonal Existente

```
┌──────────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                          │
│  ┌─────────────────────┐      ┌──────────────────────────┐  │
│  │  HTTP Adapter       │      │  In-Memory Adapter       │  │
│  │  DeployRoverCtrl    │      │  RoverRepository         │  │
│  │  MoveRoverCtrl ★NEW │      │  GridRepository          │  │
│  └──────────┬──────────┘      └─────────┬────────────────┘  │
│             │                           │                    │
│             │  ┌──────────────────────┐ │                    │
│             └─▶│  NestJS Module       │◀┘                    │
│                └──────────┬───────────┘                       │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│               APPLICATION LAYER                               │
│                ┌──────────▼──────────┐                        │
│                │ DeployRoverUseCase  │                        │
│                │ MoveRoverUseCase ★NEW                        │
│                └──────────┬──────────┘                        │
│                           │                                   │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│                  DOMAIN LAYER (Core)                          │
│                           │                                   │
│  ┌───────────────────┐    │    ┌────────────────────────┐   │
│  │  Grid (Agg)       │◀───┴───▶│  Rover (Entity)        │   │
│  │  - deployRover()  │          │  - move(cmd) ★NEW     │   │
│  │  - validateMove() │          │  - position            │   │
│  │    ★NEW           │          └────────────────────────┘   │
│  └───────────────────┘                                       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Value Objects                           │   │
│  │  - Direction: calculateNextCoordinates() ★ENHANCED   │   │
│  │  - Position: withCoordinates() ★NEW                  │   │
│  │  - Coordinates (unchanged)                           │   │
│  │  - GridDimensions: wrap() ★NEW (si se elige wrapping)│   │
│  │  - Obstacle (unchanged)                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Exceptions                               │   │
│  │  - OutOfBoundsException (reutilizar)                 │   │
│  │  - ObstacleDetectedException (reutilizar)            │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### Flujo de Movimiento (Sequence Diagram)

```
Cliente HTTP → Controller → UseCase → Rover → Direction → Grid → Repository

POST /rovers/{id}/move
   { command: "F" }
        │
        ├─▶ MoveRoverController
        │       │
        │       ├─▶ MoveRoverUseCase.execute(roverId, "F")
        │       │       │
        │       │       ├─▶ roverRepo.findById(roverId)
        │       │       │       └─▶ Rover
        │       │       │
        │       │       ├─▶ gridRepo.getGrid()
        │       │       │       └─▶ Grid
        │       │       │
        │       │       ├─▶ rover.move("F", grid)
        │       │       │       │
        │       │       │       ├─▶ direction.calculateNext(current, "F")
        │       │       │       │       └─▶ nextCoordinates
        │       │       │       │
        │       │       │       ├─▶ grid.validateMovement(nextCoords)
        │       │       │       │       │
        │       │       │       │       ├─▶ contains() ✓
        │       │       │       │       └─▶ hasObstacleAt() ✗
        │       │       │       │
        │       │       │       └─▶ rover._position = newPosition
        │       │       │
        │       │       └─▶ roverRepo.save(rover)
        │       │
        │       └─▶ return { position: {...} }
```

### Componentes a Reutilizar vs. Crear

**REUTILIZAR (sin modificar):**
- `Coordinates` - ya encapsula (x, y)
- `GridDimensions.contains()` - validación de límites
- `Grid.hasObstacleAt()` - detección de obstáculos
- `OutOfBoundsException` - para límites sin wrapping
- `ObstacleDetectedException` - cuando se detecta obstáculo
- Repositorios (RoverRepository, GridRepository) - los métodos existentes son suficientes

**EXTENDER (enhancements):**
- `Direction` - agregar lógica de cálculo de coordenadas siguientes
- `Position` - agregar método factory para crear nueva posición con coordenadas diferentes
- `Rover` - agregar método `move()`
- `Grid` - agregar método `validateMovement()`

**CREAR NUEVO:**
- `MoveRoverCommand` - DTO para el caso de uso
- `MoveRoverUseCase` - orquestación del movimiento
- `MoveRoverController` - adaptador HTTP
- Tests correspondientes

---

## 2. Modelo de Dominio (DDD)

### 2.1 Value Objects: Enhancements

#### `/src/domain/value-objects/direction.value-object.ts` (ENHANCED)

```typescript
export enum CardinalDirection {
  NORTH = 'NORTH',
  EAST = 'EAST',
  SOUTH = 'SOUTH',
  WEST = 'WEST',
}

export class Direction {
  private constructor(public readonly value: CardinalDirection) {}

  static north(): Direction {
    return new Direction(CardinalDirection.NORTH);
  }

  static east(): Direction {
    return new Direction(CardinalDirection.EAST);
  }

  static south(): Direction {
    return new Direction(CardinalDirection.SOUTH);
  }

  static west(): Direction {
    return new Direction(CardinalDirection.WEST);
  }

  equals(other: Direction): boolean {
    return this.value === other.value;
  }

  // ★ NEW: Calculate next coordinates based on movement direction
  calculateNextCoordinates(
    current: Coordinates,
    moveForward: boolean,
  ): Coordinates {
    const delta = this.getMovementDelta(moveForward);
    return Coordinates.create(current.x + delta.x, current.y + delta.y);
  }

  private getMovementDelta(
    forward: boolean,
  ): { x: number; y: number } {
    const multiplier = forward ? 1 : -1;

    switch (this.value) {
      case CardinalDirection.NORTH:
        return { x: 0, y: 1 * multiplier };
      case CardinalDirection.EAST:
        return { x: 1 * multiplier, y: 0 };
      case CardinalDirection.SOUTH:
        return { x: 0, y: -1 * multiplier };
      case CardinalDirection.WEST:
        return { x: -1 * multiplier, y: 0 };
    }
  }
}
```

**Por qué:** Direction es el experto en cómo calcular la siguiente posición según orientación. Encapsula la lógica de movimiento cardinal. El parámetro `moveForward` permite usar el mismo método para Forward (true) y Backward (false). Esto sigue el principio Tell Don't Ask: le decimos a Direction que calcule, no le preguntamos su valor para calcularlo fuera.

---

#### `/src/domain/value-objects/position.value-object.ts` (ENHANCED)

```typescript
import { Coordinates } from './coordinates.value-object';
import { Direction } from './direction.value-object';

export class Position {
  private constructor(
    public readonly coordinates: Coordinates,
    public readonly direction: Direction,
  ) {}

  static at(coordinates: Coordinates, direction: Direction): Position {
    return new Position(coordinates, direction);
  }

  equals(other: Position): boolean {
    return (
      this.coordinates.equals(other.coordinates) &&
      this.direction.equals(other.direction)
    );
  }

  // ★ NEW: Create new position with updated coordinates
  withCoordinates(newCoordinates: Coordinates): Position {
    return new Position(newCoordinates, this.direction);
  }
}
```

**Por qué:** Position es inmutable. Para "mover" el rover, necesitamos crear una nueva Position con las nuevas coordenadas. El método `withCoordinates()` es un factory method que preserva la dirección y solo cambia las coordenadas. Esto mantiene la inmutabilidad de los Value Objects.

---

### 2.2 Entidad: Rover (ENHANCED)

#### `/src/domain/entities/rover.entity.ts` (ENHANCED)

```typescript
import { Position } from '../value-objects/position.value-object';
import { Grid } from '../aggregates/grid.aggregate';

export type MovementCommand = 'F' | 'B';

export class Rover {
  private constructor(
    private readonly id: string,
    private _position: Position,
  ) {}

  static deploy(id: string, initialPosition: Position): Rover {
    return new Rover(id, initialPosition);
  }

  get position(): Position {
    return this._position;
  }

  getId(): string {
    return this.id;
  }

  // ★ NEW: Move rover forward or backward
  move(command: MovementCommand, grid: Grid): void {
    const isForward = command === 'F';

    const nextCoordinates = this._position.direction.calculateNextCoordinates(
      this._position.coordinates,
      isForward,
    );

    grid.validateMovement(nextCoordinates);

    this._position = this._position.withCoordinates(nextCoordinates);
  }
}
```

**Por qué:** El Rover es responsable de cambiar su propia posición, pero delega:
1. Al Direction: cálculo de las siguientes coordenadas
2. Al Grid: validación de que la nueva posición es legal

El Rover NO valida límites ni obstáculos directamente (eso crearía acoplamiento con Grid). El Grid actúa como guardian que puede lanzar excepciones si la posición es inválida. Si Grid no lanza excepción, Rover actualiza su posición.

**Decisión arquitectónica clave:** `move()` recibe el Grid como parámetro (inyección de dependencia en método). Esto evita que Rover guarde referencia al Grid (rompería encapsulación), pero permite al Rover pedir validación cuando la necesita.

---

### 2.3 Agregado: Grid (ENHANCED)

#### `/src/domain/aggregates/grid.aggregate.ts` (ENHANCED)

```typescript
import { Rover } from '../entities/rover.entity';
import { Coordinates } from '../value-objects/coordinates.value-object';
import { Direction } from '../value-objects/direction.value-object';
import { GridDimensions } from '../value-objects/grid-dimensions.value-object';
import { Position } from '../value-objects/position.value-object';
import { OutOfBoundsException } from '../exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../exceptions/obstacle-detected.exception';
import { Obstacle } from '../value-objects/obstacle.value-object';

export class Grid {
  private constructor(
    private readonly dimensions: GridDimensions,
    private readonly obstacles: Obstacle[],
  ) {}

  static create(dimensions: GridDimensions, obstacles: Obstacle[] = []): Grid {
    return new Grid(dimensions, obstacles);
  }

  deployRover(roverId: string, coordinates: Coordinates, direction: Direction): Rover {
    this.validateDeploymentPosition(coordinates);

    const position = Position.at(coordinates, direction);
    return Rover.deploy(roverId, position);
  }

  // ★ NEW: Validate movement to target coordinates
  validateMovement(targetCoordinates: Coordinates): void {
    if (!this.dimensions.contains(targetCoordinates)) {
      throw new OutOfBoundsException(
        `Cannot move to (${targetCoordinates.x},${targetCoordinates.y}): coordinates out of grid bounds`,
      );
    }

    if (this.hasObstacleAt(targetCoordinates)) {
      throw new ObstacleDetectedException(
        `Cannot move to (${targetCoordinates.x},${targetCoordinates.y}): obstacle detected`,
      );
    }
  }

  private validateDeploymentPosition(coordinates: Coordinates): void {
    if (!this.dimensions.contains(coordinates)) {
      throw new OutOfBoundsException(
        `Cannot deploy rover at (${coordinates.x},${coordinates.y}): coordinates out of grid bounds`,
      );
    }

    if (this.hasObstacleAt(coordinates)) {
      throw new ObstacleDetectedException(
        `Cannot deploy rover at (${coordinates.x},${coordinates.y}): obstacle detected`,
      );
    }
  }

  private hasObstacleAt(coordinates: Coordinates): boolean {
    return this.obstacles.some((obstacle) => obstacle.blocksPosition(coordinates));
  }
}
```

**Por qué:** Agregamos `validateMovement()` como método público que el Rover puede invocar. Es casi idéntico a `validateDeploymentPosition()` pero con mensaje diferente (mejor UX). Reutiliza las mismas validaciones: `contains()` y `hasObstacleAt()`.

**Nota sobre refactoring futuro:** Si queremos eliminar duplicación, podríamos extraer un método privado `validatePosition(coordinates, context)`, pero YAGNI por ahora. Los mensajes de error diferentes tienen valor de negocio.

---

### 2.4 Excepciones de Dominio (REUTILIZAR)

Las excepciones existentes son perfectas para movimiento:
- `OutOfBoundsException` - cuando el movimiento sale del grid
- `ObstacleDetectedException` - cuando el movimiento choca con obstáculo

No necesitamos nuevas excepciones. Esto es un buen ejemplo de diseño reutilizable: las excepciones hablan de conceptos de dominio, no de operaciones específicas.

---

## 3. Puertos (Interfaces del Dominio)

### No se requieren nuevos puertos

Los puertos existentes son suficientes:

```typescript
// RoverRepository.port.ts - REUTILIZAR
export interface RoverRepository {
  save(rover: Rover): Promise<void>;          // ✓ Para actualizar posición
  findById(id: string): Promise<Rover | null>; // ✓ Para recuperar rover
}

// GridRepository.port.ts - REUTILIZAR
export interface GridRepository {
  getGrid(): Promise<Grid>; // ✓ Para obtener grid con obstáculos
}
```

**Por qué no necesitamos nuevos puertos:** El movimiento modifica el estado del Rover, que ya tiene un método `save()`. El Grid se obtiene de forma read-only para validación. La arquitectura hexagonal nos permite agregar funcionalidad sin cambiar contratos.

---

## 4. Capa de Aplicación (Casos de Uso)

### 4.1 Command DTO

#### `/src/application/commands/move-rover.command.ts` (NEW)

```typescript
import { MovementCommand } from '../../domain/entities/rover.entity';

export class MoveRoverCommand {
  constructor(
    public readonly roverId: string,
    public readonly command: MovementCommand, // 'F' | 'B'
  ) {}
}
```

**Por qué:** DTO simple que transporta el ID del rover y el comando de movimiento. Usa el tipo `MovementCommand` del dominio para seguridad de tipos.

---

### 4.2 Use Case

#### `/src/application/usecases/move-rover.use-case.ts` (NEW)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { MoveRoverCommand } from '../commands/move-rover.command';
import { RoverRepository } from '../../domain/port/rover.repository.port';
import { GridRepository } from '../../domain/port/grid.repository.port';

@Injectable()
export class MoveRoverUseCase {
  constructor(
    private readonly roverRepository: RoverRepository,
    private readonly gridRepository: GridRepository,
  ) {}

  async execute(command: MoveRoverCommand): Promise<void> {
    const rover = await this.roverRepository.findById(command.roverId);

    if (!rover) {
      throw new NotFoundException(
        `Rover with id ${command.roverId} not found`,
      );
    }

    const grid = await this.gridRepository.getGrid();

    rover.move(command.command, grid);

    await this.roverRepository.save(rover);
  }
}
```

**Por qué:** El caso de uso orquesta pero no contiene lógica de negocio:
1. Recupera el Rover (lanza excepción si no existe)
2. Recupera el Grid
3. Delega al Rover el movimiento (quien valida con Grid)
4. Persiste el Rover con nueva posición

**Decisión:** `NotFoundException` es de NestJS porque es un error de aplicación (rover no encontrado), no de dominio. Las validaciones de negocio (obstáculos, límites) están en el dominio y lanzan excepciones de dominio.

---

## 5. Adaptadores (Infraestructura)

### 5.1 Repository Adapters (REUTILIZAR)

Los adaptadores existentes NO necesitan cambios:
- `InMemoryRoverRepository` - el método `save()` sobrescribe el rover existente, perfecto para actualizar posición
- `InMemoryGridRepository` - el método `getGrid()` devuelve el grid configurado

**Esto demuestra el poder de la arquitectura hexagonal:** agregamos funcionalidad sin tocar la infraestructura.

---

### 5.2 HTTP Adapter (Controller)

#### `/src/infrastructure/http/move-rover.controller.ts` (NEW)

```typescript
import {
  Body,
  Controller,
  Param,
  Post,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { MoveRoverUseCase } from '../../application/usecases/move-rover.use-case';
import { MoveRoverCommand } from '../../application/commands/move-rover.command';
import { OutOfBoundsException } from '../../domain/exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../../domain/exceptions/obstacle-detected.exception';

class MoveRoverRequestDto {
  command: 'F' | 'B';
}

class MoveRoverResponseDto {
  roverId: string;
  x: number;
  y: number;
  direction: string;
}

@Controller('rovers')
export class MoveRoverController {
  constructor(private readonly moveRoverUseCase: MoveRoverUseCase) {}

  @Post(':id/move')
  @HttpCode(200)
  async moveRover(
    @Param('id') roverId: string,
    @Body() dto: MoveRoverRequestDto,
  ): Promise<MoveRoverResponseDto> {
    try {
      const command = new MoveRoverCommand(roverId, dto.command);

      await this.moveRoverUseCase.execute(command);

      // Query the rover again to get updated position
      // (En futuro: extraer a GetRoverUseCase)
      const rover = await this.getRoverById(roverId);

      return {
        roverId: rover.getId(),
        x: rover.position.coordinates.x,
        y: rover.position.coordinates.y,
        direction: rover.position.direction.value,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error instanceof OutOfBoundsException) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      if (error instanceof ObstacleDetectedException) {
        throw new HttpException(
          {
            message: error.message,
            obstacleDetected: true,
          },
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  // Temporal: inline query (future: inject GetRoverUseCase)
  private async getRoverById(roverId: string) {
    // This will be injected properly, for now inline
    // In real implementation: inject RoverRepository
    throw new Error('Not implemented: inject RoverRepository');
  }
}
```

**Por qué:**
- Endpoint RESTful: `POST /rovers/:id/move` con body `{ command: "F" }` o `{ command: "B" }`
- Mapea excepciones de dominio a códigos HTTP:
  - `NotFoundException` → 404 (rover no existe)
  - `OutOfBoundsException` → 400 (movimiento inválido)
  - `ObstacleDetectedException` → 409 Conflict (obstáculo detectado)
- Retorna la posición actualizada del rover

**Nota temporal:** El controlador necesita devolver la posición actualizada. Por simplicidad, se consulta el repositorio inline. En un sistema real, crearíamos un `GetRoverPositionUseCase` (query) separado del comando. Por ahora, YAGNI.

---

### 5.3 NestJS Module (ACTUALIZAR)

#### `/src/infrastructure/config/rover.module.ts` (ENHANCED)

```typescript
import { Module } from '@nestjs/common';
import { DeployRoverController } from '../http/deploy-rover.controller';
import { MoveRoverController } from '../http/move-rover.controller'; // ★ NEW
import { DeployRoverUseCase } from '../../application/usecases/deploy-rover.use-case';
import { MoveRoverUseCase } from '../../application/usecases/move-rover.use-case'; // ★ NEW
import { InMemoryRoverRepository } from '../persistence/in-memory-rover.repository';
import { InMemoryGridRepository } from '../persistence/in-memory-grid.repository';

@Module({
  controllers: [
    DeployRoverController,
    MoveRoverController, // ★ NEW
  ],
  providers: [
    DeployRoverUseCase,
    MoveRoverUseCase, // ★ NEW
    {
      provide: 'RoverRepository',
      useClass: InMemoryRoverRepository,
    },
    {
      provide: 'GridRepository',
      useClass: InMemoryGridRepository,
    },
  ],
  exports: ['RoverRepository', 'GridRepository'],
})
export class RoverModule {}
```

**Por qué:** Registramos el nuevo controlador y caso de uso. Los repositorios se reutilizan (inyección de dependencias).

---

## 6. Estrategia de Testing (TDD/BDD)

### Filosofía de Tests

Nombres de tests en **lenguaje de negocio**, siguiendo BDD:
- ✅ "should move one cell north when commanded forward facing north"
- ❌ "should increment y coordinate by 1 when direction is NORTH and command is F"

### Estructura de Tests (Orden Outside-In TDD)

---

### Fase 1: Tests de Dominio (Unit Tests)

#### **Test Suite 1: Direction calculates next coordinates**

`/test/unit/domain/value-objects/direction.value-object.spec.ts` (NEW)

```typescript
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
        expect(next.y).toBe(6); // y aumenta
      });

      it('should move one cell east when facing east', () => {
        const direction = Direction.east();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, true);

        expect(next.x).toBe(6); // x aumenta
        expect(next.y).toBe(5);
      });

      it('should move one cell south when facing south', () => {
        const direction = Direction.south();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, true);

        expect(next.x).toBe(5);
        expect(next.y).toBe(4); // y disminuye
      });

      it('should move one cell west when facing west', () => {
        const direction = Direction.west();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, true);

        expect(next.x).toBe(4); // x disminuye
        expect(next.y).toBe(5);
      });
    });

    describe('when moving backward', () => {
      it('should move one cell south when facing north', () => {
        const direction = Direction.north();
        const current = Coordinates.create(5, 5);

        const next = direction.calculateNextCoordinates(current, false);

        expect(next.x).toBe(5);
        expect(next.y).toBe(4); // opuesto a forward
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
```

---

#### **Test Suite 2: Grid validates movement**

`/test/unit/domain/aggregates/grid.aggregate.spec.ts` (ENHANCED - agregar nuevos tests)

```typescript
describe('Grid Aggregate', () => {
  // ... tests existentes de deployment ...

  describe('validating movement', () => {
    it('should allow movement to valid position within bounds', () => {
      // Arrange
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const targetCoordinates = Coordinates.create(5, 5);

      // Act & Assert: no debe lanzar excepción
      expect(() => {
        grid.validateMovement(targetCoordinates);
      }).not.toThrow();
    });

    it('should reject movement outside grid boundaries (X too large)', () => {
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(10, 5); // fuera de 0-9

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
      const edgeCoordinates = Coordinates.create(9, 9); // límite válido

      expect(() => {
        grid.validateMovement(edgeCoordinates);
      }).not.toThrow();
    });
  });
});
```

---

#### **Test Suite 3: Rover moves**

`/test/unit/domain/entities/rover.entity.spec.ts` (NEW)

```typescript
import { Rover, MovementCommand } from '../../../../src/domain/entities/rover.entity';
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction } from '../../../../src/domain/value-objects/direction.value-object';
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
      // Arrange: rover en (5,5) mirando al norte
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      // Act: mover hacia adelante
      rover.move('F', grid);

      // Assert: rover ahora en (5,6)
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
      expect(rover.position.coordinates.y).toBe(4); // retrocede
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
      // Arrange: obstáculo en (5,6), rover en (5,5) mirando norte
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

      // Act & Assert: intento de mover debe fallar
      expect(() => {
        rover.move('F', gridWithObstacle);
      }).toThrow(ObstacleDetectedException);

      // Rover NO se movió
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

      // Rover permanece en posición original
      expect(rover.position.coordinates.x).toBe(5);
      expect(rover.position.coordinates.y).toBe(5);
    });
  });

  describe('respecting grid boundaries', () => {
    it('should throw exception when moving beyond north boundary', () => {
      // Arrange: rover en (5,9) en grid 10x10, mirando norte
      const initialPosition = Position.at(
        Coordinates.create(5, 9),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);

      // Act & Assert: mover fuera de límites
      expect(() => {
        rover.move('F', grid);
      }).toThrow(OutOfBoundsException);

      // Rover NO se movió
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
```

---

### Fase 2: Tests de Aplicación (Use Case Tests)

#### **Test Suite 4: MoveRoverUseCase orchestration**

`/test/unit/application/usecases/move-rover.use-case.spec.ts` (NEW)

```typescript
import { MoveRoverUseCase } from '../../../../src/application/usecases/move-rover.use-case';
import { MoveRoverCommand } from '../../../../src/application/commands/move-rover.command';
import { InMemoryRoverRepository } from '../../../../src/infrastructure/persistence/in-memory-rover.repository';
import { InMemoryGridRepository } from '../../../../src/infrastructure/persistence/in-memory-grid.repository';
import { Rover } from '../../../../src/domain/entities/rover.entity';
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { GridDimensions } from '../../../../src/domain/value-objects/grid-dimensions.value-object';
import { Obstacle } from '../../../../src/domain/value-objects/obstacle.value-object';
import { NotFoundException } from '@nestjs/common';
import { OutOfBoundsException } from '../../../../src/domain/exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../../../../src/domain/exceptions/obstacle-detected.exception';

describe('MoveRoverUseCase', () => {
  let useCase: MoveRoverUseCase;
  let roverRepository: InMemoryRoverRepository;
  let gridRepository: InMemoryGridRepository;

  beforeEach(() => {
    roverRepository = new InMemoryRoverRepository();
    gridRepository = new InMemoryGridRepository();
    useCase = new MoveRoverUseCase(roverRepository, gridRepository);

    // Setup default 10x10 grid
    const dimensions = GridDimensions.create(10, 10);
    gridRepository.setGrid(dimensions, []);
  });

  describe('successful movement', () => {
    it('should move rover forward and persist new position', async () => {
      // Arrange: desplegar rover en (5,5) norte
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'F');

      // Act: ejecutar movimiento
      await useCase.execute(command);

      // Assert: rover movido a (5,6)
      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover).toBeDefined();
      expect(updatedRover!.position.coordinates.x).toBe(5);
      expect(updatedRover!.position.coordinates.y).toBe(6);
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.NORTH);
    });

    it('should move rover backward and persist new position', async () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'B');

      await useCase.execute(command);

      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover!.position.coordinates.y).toBe(4); // retrocedió
    });
  });

  describe('error scenarios', () => {
    it('should throw NotFoundException when rover does not exist', async () => {
      const command = new MoveRoverCommand('non-existent-rover', 'F');

      await expect(useCase.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should propagate OutOfBoundsException from domain', async () => {
      // Arrange: rover en borde norte (5,9)
      const edgePosition = Position.at(
        Coordinates.create(5, 9),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', edgePosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'F');

      // Act & Assert: intento de salir de límites
      await expect(useCase.execute(command)).rejects.toThrow(OutOfBoundsException);

      // Rover no debe haber cambiado
      const unchangedRover = await roverRepository.findById('rover-1');
      expect(unchangedRover!.position.coordinates.y).toBe(9);
    });

    it('should propagate ObstacleDetectedException from domain', async () => {
      // Arrange: grid con obstáculo en (5,6)
      const dimensions = GridDimensions.create(10, 10);
      const obstaclePosition = Coordinates.create(5, 6);
      gridRepository.setGrid(dimensions, [Obstacle.at(obstaclePosition)]);

      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new MoveRoverCommand('rover-1', 'F');

      // Act & Assert: obstáculo bloquea
      await expect(useCase.execute(command)).rejects.toThrow(ObstacleDetectedException);

      // Rover permanece en posición original
      const unchangedRover = await roverRepository.findById('rover-1');
      expect(unchangedRover!.position.coordinates.y).toBe(5);
    });
  });
});
```

---

### Fase 3: Tests E2E (API Tests)

#### **Test Suite 5: Move Rover API**

`/test/e2e/move-rover.e2e-spec.ts` (NEW)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Move Rover (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Deploy a rover first for testing movement
    await request(app.getHttpServer())
      .post('/rovers/deploy')
      .send({
        roverId: 'test-rover',
        x: 5,
        y: 5,
        direction: 'NORTH',
      })
      .expect(201);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /rovers/:id/move', () => {
    it('should move rover forward successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'F' })
        .expect(200)
        .expect((res) => {
          expect(res.body.roverId).toBe('test-rover');
          expect(res.body.x).toBe(5);
          expect(res.body.y).toBe(6); // moved north
          expect(res.body.direction).toBe('NORTH');
        });
    });

    it('should move rover backward successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'B' })
        .expect(200)
        .expect((res) => {
          expect(res.body.y).toBe(4); // moved south (backward)
        });
    });

    it('should return 404 when rover does not exist', () => {
      return request(app.getHttpServer())
        .post('/rovers/non-existent/move')
        .send({ command: 'F' })
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });

    it('should return 400 when movement exceeds grid boundaries', async () => {
      // Deploy rover at north edge
      await request(app.getHttpServer())
        .post('/rovers/deploy')
        .send({
          roverId: 'edge-rover',
          x: 5,
          y: 9,
          direction: 'NORTH',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/rovers/edge-rover/move')
        .send({ command: 'F' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('out of grid bounds');
        });
    });

    it('should return 409 when obstacle blocks movement', async () => {
      // TODO: Implement grid configuration endpoint first
      // For now, this test is pending obstacle setup
      // Future: POST /grid/obstacles to configure
    });

    it('should handle multiple sequential movements', async () => {
      // Move forward
      await request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'F' })
        .expect(200);

      // Move forward again
      await request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'F' })
        .expect(200);

      // Move backward
      const response = await request(app.getHttpServer())
        .post('/rovers/test-rover/move')
        .send({ command: 'B' })
        .expect(200);

      expect(response.body.x).toBe(5);
      expect(response.body.y).toBe(6); // 5 + 2 - 1 = 6
    });
  });
});
```

---

## 7. Orden de Implementación (Vertical Slicing)

### Iteración 1: Happy Path - Movimiento Básico (Forward)

**Objetivo:** Rover puede moverse hacia adelante en espacio vacío.

1. **TDD Ciclo 1: Direction calcula siguientes coordenadas**
   - Crear test: `direction.value-object.spec.ts` - solo forward, una dirección (Norte)
   - Implementar: `Direction.calculateNextCoordinates()` - caso Norte
   - Red → Green → Refactor
   - Extender test: las 4 direcciones forward
   - Implementar: casos Este, Sur, Oeste

2. **TDD Ciclo 2: Position con nuevas coordenadas**
   - Crear test: `position.value-object.spec.ts` - método `withCoordinates()`
   - Implementar: `Position.withCoordinates()`

3. **TDD Ciclo 3: Grid valida movimiento**
   - Crear test: `grid.aggregate.spec.ts` - `validateMovement()` happy path
   - Implementar: `Grid.validateMovement()` solo verificando límites (sin obstáculos aún)

4. **TDD Ciclo 4: Rover mueve forward**
   - Crear test: `rover.entity.spec.ts` - `move('F')` en las 4 direcciones
   - Implementar: `Rover.move()` método completo
   - Tipo: `MovementCommand = 'F' | 'B'`

5. **TDD Ciclo 5: Use Case orquesta**
   - Crear test: `move-rover.use-case.spec.ts` - caso exitoso forward
   - Crear: `MoveRoverCommand.ts`
   - Implementar: `MoveRoverUseCase.execute()`

6. **TDD Ciclo 6: HTTP Endpoint**
   - Crear: `MoveRoverController.ts` - endpoint `POST /rovers/:id/move`
   - Actualizar: `RoverModule` - registrar controlador y caso de uso
   - Crear test: `move-rover.e2e-spec.ts` - caso exitoso

**Checkpoint:** Rover se mueve forward en todas direcciones en espacio vacío.
**Commit:** `feat: implement forward movement for rover`

**Tests passing:**
- Direction calcula coordenadas siguientes (4 direcciones forward)
- Grid valida movimiento (solo happy path por ahora)
- Rover mueve forward (4 direcciones)
- Use Case orquesta movimiento forward
- E2E: POST /rovers/:id/move con F retorna nueva posición

---

### Iteración 2: Movimiento Backward

**Objetivo:** Rover puede retroceder.

7. **TDD Ciclo 7: Direction calcula backward**
   - Agregar tests: backward en las 4 direcciones
   - Implementar: lógica backward en `calculateNextCoordinates()` con parámetro `moveForward`

8. **TDD Ciclo 8: Rover mueve backward**
   - Agregar tests: `rover.entity.spec.ts` - `move('B')` en las 4 direcciones
   - Verificar: la implementación ya soporta 'B' (usa mismo método que 'F')

9. **TDD Ciclo 9: Use Case backward**
   - Agregar test: `move-rover.use-case.spec.ts` - caso backward
   - Verificar: ya funciona (sin cambios necesarios)

10. **TDD Ciclo 10: E2E backward**
    - Agregar test: `move-rover.e2e-spec.ts` - movimiento backward
    - Verificar: endpoint soporta 'B'

**Checkpoint:** Rover se mueve forward y backward en todas direcciones.
**Commit:** `feat: implement backward movement for rover`

**Tests passing:**
- Direction calcula backward (4 direcciones)
- Rover mueve backward (4 direcciones)
- Use Case backward
- E2E: comando 'B' retorna nueva posición

---

### Iteración 3: Detección de Obstáculos

**Objetivo:** Movimiento detecta obstáculos y se detiene.

11. **TDD Ciclo 11: Grid detecta obstáculos en movimiento**
    - Agregar test: `grid.aggregate.spec.ts` - `validateMovement()` con obstáculo
    - Verificar: `validateMovement()` ya llama a `hasObstacleAt()` (reutilización)
    - Si no está, implementar: agregar verificación de obstáculos

12. **TDD Ciclo 12: Rover se detiene ante obstáculo**
    - Agregar tests: `rover.entity.spec.ts` - obstáculo bloquea forward y backward
    - Verificar: Rover NO se mueve (posición permanece igual)
    - Verificar: excepción `ObstacleDetectedException` se lanza

13. **TDD Ciclo 13: Use Case propaga excepción de obstáculo**
    - Agregar test: `move-rover.use-case.spec.ts` - obstáculo causa excepción
    - Verificar: excepción se propaga, rover no cambia en repositorio

14. **TDD Ciclo 14: Controller mapea a HTTP 409**
    - Actualizar: `MoveRoverController` - catch `ObstacleDetectedException` → 409 Conflict
    - Agregar test E2E: obstáculo retorna 409 con mensaje
    - **Nota:** Este test requiere configurar grid con obstáculos. Temporal: skip o mock.

**Checkpoint:** Obstáculos bloquean movimiento correctamente.
**Commit:** `feat: detect obstacles during rover movement`

**Tests passing:**
- Grid rechaza movimiento a coordenadas con obstáculo
- Rover lanza excepción al intentar moverse sobre obstáculo
- Rover permanece en posición original tras detectar obstáculo
- Use Case propaga excepción
- E2E: 409 cuando obstáculo bloquea (pendiente configuración de grid)

---

### Iteración 4: Validación de Límites (Boundaries)

**Objetivo:** Movimiento respeta límites de cuadrícula.

15. **TDD Ciclo 15: Grid rechaza movimiento fuera de límites**
    - Agregar tests: `grid.aggregate.spec.ts` - coordenadas fuera de límites en validateMovement
    - Verificar: `validateMovement()` ya usa `dimensions.contains()` (reutilización)

16. **TDD Ciclo 16: Rover se detiene en límites**
    - Agregar tests: `rover.entity.spec.ts` - movimiento en bordes norte, este, sur, oeste
    - Verificar: excepción `OutOfBoundsException` se lanza
    - Verificar: Rover NO se mueve

17. **TDD Ciclo 17: Use Case propaga excepción de límites**
    - Agregar test: `move-rover.use-case.spec.ts` - movimiento fuera de límites causa excepción
    - Verificar: rover no cambia en repositorio

18. **TDD Ciclo 18: Controller mapea a HTTP 400**
    - Actualizar: `MoveRoverController` - catch `OutOfBoundsException` → 400 Bad Request
    - Agregar test E2E: intento de salir de límites retorna 400

**Checkpoint:** Límites de cuadrícula respetados en todos los casos.
**Commit:** `feat: respect grid boundaries during movement`

**Tests passing:**
- Grid rechaza coordenadas fuera de límites
- Rover lanza excepción en los 4 bordes
- Use Case propaga excepción de límites
- E2E: 400 cuando se intenta salir de límites

---

### Iteración 5: Casos Edge y Refinamiento

**Objetivo:** Cubrir casos límite y mejorar UX.

19. **TDD Ciclo 19: Rover inexistente**
    - Agregar test: `move-rover.use-case.spec.ts` - comando para rover que no existe
    - Implementar: validación en `MoveRoverUseCase` - lanzar `NotFoundException`
    - Agregar test E2E: 404 cuando rover no existe

20. **TDD Ciclo 20: Movimientos secuenciales**
    - Agregar test E2E: múltiples comandos seguidos (F, F, B)
    - Verificar: repositorio persiste correctamente entre comandos

21. **TDD Ciclo 21: Casos edge de posición**
    - Agregar tests: rover en (0,0), rover en (9,9) en grid 10x10
    - Verificar: movimientos válidos funcionan, inválidos lanzan excepción

22. **Refinamiento de mensajes**
    - Revisar mensajes de excepción: claridad y contexto
    - Revisar response DTO del controller: incluir toda la info necesaria

**Checkpoint:** Todos los casos edge cubiertos, mensajes claros.
**Commit:** `test: add edge cases and improve error messages for movement`

**Tests passing:**
- Comando a rover inexistente retorna 404
- Movimientos secuenciales funcionan correctamente
- Casos edge de posición (esquinas, bordes)

---

### Iteración 6: Integración y Documentación

23. **Validación de integración**
    - Ejecutar suite completa de tests: `npm run test`
    - Ejecutar tests E2E: `npm run test:e2e`
    - Verificar cobertura: `npm run test:cov`

24. **Actualizar documentación**
    - Actualizar README: agregar endpoints de movimiento
    - Agregar ejemplos de uso curl/Postman
    - Documentar códigos de error

**Checkpoint:** Feature completa y documentada.
**Commit:** `docs: add movement feature documentation`

---

## 8. Estructura Final de Archivos

```
src/
├── domain/
│   ├── aggregates/
│   │   └── grid.aggregate.ts                      [ENHANCED]
│   ├── entities/
│   │   └── rover.entity.ts                        [ENHANCED]
│   ├── exceptions/
│   │   ├── obstacle-detected.exception.ts         [UNCHANGED]
│   │   └── out-of-bounds.exception.ts             [UNCHANGED]
│   ├── port/
│   │   ├── grid.repository.port.ts                [UNCHANGED]
│   │   └── rover.repository.port.ts               [UNCHANGED]
│   └── value-objects/
│       ├── coordinates.value-object.ts            [UNCHANGED]
│       ├── direction.value-object.ts              [ENHANCED] ★
│       ├── grid-dimensions.value-object.ts        [UNCHANGED]
│       ├── obstacle.value-object.ts               [UNCHANGED]
│       └── position.value-object.ts               [ENHANCED] ★
├── application/
│   ├── commands/
│   │   ├── deploy-rover.command.ts                [UNCHANGED]
│   │   └── move-rover.command.ts                  [NEW] ★
│   └── usecases/
│       ├── deploy-rover.use-case.ts               [UNCHANGED]
│       └── move-rover.use-case.ts                 [NEW] ★
├── infrastructure/
│   ├── config/
│   │   └── rover.module.ts                        [ENHANCED] ★
│   ├── http/
│   │   ├── deploy-rover.controller.ts             [UNCHANGED]
│   │   └── move-rover.controller.ts               [NEW] ★
│   └── persistence/
│       ├── in-memory-grid.repository.ts           [UNCHANGED]
│       └── in-memory-rover.repository.ts          [UNCHANGED]
├── app.module.ts                                   [UNCHANGED]
└── main.ts                                         [UNCHANGED]

test/
├── unit/
│   ├── domain/
│   │   ├── aggregates/
│   │   │   └── grid.aggregate.spec.ts             [ENHANCED]
│   │   ├── entities/
│   │   │   └── rover.entity.spec.ts               [NEW] ★
│   │   └── value-objects/
│   │       ├── direction.value-object.spec.ts     [NEW] ★
│   │       └── position.value-object.spec.ts      [NEW] ★
│   └── application/
│       └── usecases/
│           ├── deploy-rover.use-case.spec.ts      [UNCHANGED]
│           └── move-rover.use-case.spec.ts        [NEW] ★
└── e2e/
    ├── deploy-rover.e2e-spec.ts                   [UNCHANGED]
    └── move-rover.e2e-spec.ts                     [NEW] ★
```

**Leyenda:**
- `[NEW] ★` - Archivo nuevo a crear
- `[ENHANCED] ★` - Archivo existente a modificar
- `[UNCHANGED]` - Archivo sin cambios (reutilizado)

---

## 9. Criterios de Aceptación vs Tests

| Criterio de Aceptación | Tests Correspondientes |
|------------------------|------------------------|
| 1. Rover puede moverse forward (F) en dirección actual | `rover.entity.spec.ts`: "should move one cell north when facing north" (+ otras 3 direcciones)<br>`move-rover.e2e-spec.ts`: "should move rover forward successfully" |
| 2. Rover puede moverse backward (B) opuesto a dirección actual | `rover.entity.spec.ts`: "should move one cell south when facing north" (backward)<br>`direction.value-object.spec.ts`: todas las pruebas de backward<br>`move-rover.e2e-spec.ts`: "should move rover backward successfully" |
| 3. Movimiento respeta límites de cuadrícula | `grid.aggregate.spec.ts`: "should reject movement outside grid boundaries"<br>`rover.entity.spec.ts`: "should throw exception when moving beyond north boundary" (+ otros 3 bordes)<br>`move-rover.e2e-spec.ts`: "should return 400 when movement exceeds grid boundaries" |
| 4. Movimiento detecta obstáculos y se detiene ANTES de colisión | `grid.aggregate.spec.ts`: "should reject movement to position with obstacle"<br>`rover.entity.spec.ts`: "should stop and throw exception when obstacle blocks forward movement"<br>`move-rover.use-case.spec.ts`: "should propagate ObstacleDetectedException from domain" |
| 5. Cuando se detiene por obstáculo, rover reporta última posición válida | `rover.entity.spec.ts`: verifica que `rover.position` NO cambia tras excepción<br>`move-rover.use-case.spec.ts`: verifica que repositorio no guarda nueva posición tras obstáculo |
| 6. Todas las 4 direcciones cardinales manejan movimiento correctamente | `direction.value-object.spec.ts`: 8 tests (4 forward + 4 backward)<br>`rover.entity.spec.ts`: tests para NORTH, EAST, SOUTH, WEST |

---

## 10. Decisiones Arquitectónicas Clave

### Decisión 1: Quién calcula la siguiente posición

**ELEGIDA: Option A - Direction calcula**

```typescript
// ✅ Direction es el experto en movimiento cardinal
direction.calculateNextCoordinates(current, isForward)
```

**Alternativas descartadas:**
- **Option B (Rover calcula):** Crearía acoplamiento entre Rover y lógica cardinal. Rover no debe saber que "norte = +Y".
- **Option C (Grid calcula):** Grid no debe conocer semántica de direcciones. Grid valida, no calcula.

**Razones:**
- **Single Responsibility:** Direction encapsula conocimiento de orientaciones cardinales.
- **Tell Don't Ask:** Direction dice qué coordenadas resultan de un movimiento, no exponemos su valor para que otros calculen.
- **Extensibilidad:** Si agregamos nuevas direcciones (NE, NW...), solo cambia Direction.

---

### Decisión 2: Comportamiento en límites

**ELEGIDA: Option B - Lanzar OutOfBoundsException**

```typescript
// ✅ Movimiento fuera de límites es error de dominio
if (!this.dimensions.contains(targetCoordinates)) {
  throw new OutOfBoundsException(...);
}
```

**Alternativas descartadas:**
- **Option A (Wrapping):** Requeriría `GridDimensions.wrap()` y cambiaría semántica (¿rover en borde norte va al sur?). No está en los requisitos actuales.
- **Option C (Stop silently):** Oculta error. El cliente debe saber que el comando falló.

**Razones:**
- **Fail Fast:** Errores explícitos mejor que comportamiento silencioso.
- **YAGNI:** Wrapping no está en requisitos. Si se necesita en futuro, será fácil agregar método `GridDimensions.wrap()`.
- **Consistencia:** Mismo comportamiento que deployment (lanza excepción en límites).

**Extensibilidad futura:** Si se requiere wrapping, crear subclase `WrappingGridDimensions`:

```typescript
class WrappingGridDimensions extends GridDimensions {
  wrap(coordinates: Coordinates): Coordinates {
    return Coordinates.create(
      coordinates.x % this.width,
      coordinates.y % this.height,
    );
  }
}
```

---

### Decisión 3: Respuesta ante obstáculo

**ELEGIDA: Option A - Lanzar ObstacleDetectedException**

```typescript
// ✅ Reutilizar excepción existente de dominio
if (this.hasObstacleAt(targetCoordinates)) {
  throw new ObstacleDetectedException(...);
}
```

**Alternativas descartadas:**
- **Option B (Result object):** `{ success: false, position: current, obstacleAt: next }` - Requiere cambiar firma de `move()` a retornar result. Inconsistente con estilo del dominio actual (usa excepciones).
- **Option C (Domain event):** Over-engineering para esta fase. Los eventos tienen sentido cuando múltiples handlers necesitan reaccionar. Aquí solo necesitamos informar al cliente.

**Razones:**
- **Consistencia:** Todo el dominio usa excepciones para reglas de negocio violadas.
- **Simplicidad:** Exception handling es estándar, conocido, soportado por frameworks.
- **Fail Fast:** Excepción detiene la ejecución inmediatamente (rover NO se mueve).

**Mapeo HTTP:**
```typescript
// Controller traduce a 409 Conflict (recurso bloqueado)
if (error instanceof ObstacleDetectedException) {
  throw new HttpException({
    message: error.message,
    obstacleDetected: true,
  }, HttpStatus.CONFLICT);
}
```

---

### Decisión 4: Repository update

**ELEGIDA: Reutilizar `save()` existente**

```typescript
// ✅ save() sobrescribe el rover completo
await this.roverRepository.save(rover);
```

**Alternativas descartadas:**
- Crear `updatePosition(roverId, position)` - Innecesario. `save()` es suficiente para persistir entidades mutadas.

**Razones:**
- **Simplicidad:** El repository guarda la entidad completa. No necesitamos operaciones granulares.
- **Consistencia:** Mismo patrón que se usará para futuras modificaciones (rotación, etc.).
- **Aggregate integrity:** Guardar el agregado completo preserva invariantes.

**Implementación In-Memory:**
```typescript
async save(rover: Rover): Promise<void> {
  this.rovers.set(rover.getId(), rover); // ✓ Sobrescribe
}
```

---

### Decisión 5: Comando único vs. secuencia

**ELEGIDA: Comando único ('F' o 'B')**

```typescript
// ✅ POST /rovers/:id/move { command: "F" }
export type MovementCommand = 'F' | 'B';
```

**Alternativas descartadas:**
- **Secuencia:** `{ commands: "FFRFFLB" }` - No está en requisitos de esta user story. YAGNI.

**Razones:**
- **Vertical Slicing:** Esta historia es movimiento básico. Secuencias son otra historia futura.
- **Simplicidad:** Validación más simple (solo 'F' o 'B'), testing más simple.
- **Preparación para futuro:** Cuando implementemos secuencias, crearemos `ExecuteCommandSequenceUseCase` que internamente llamará a `move()` múltiples veces.

**Extensibilidad futura:**
```typescript
// Future: ExecuteCommandSequenceUseCase
async execute(command: CommandSequenceCommand) {
  for (const singleCommand of command.sequence.split('')) {
    if (singleCommand === 'F' || singleCommand === 'B') {
      await this.moveRoverUseCase.execute(
        new MoveRoverCommand(command.roverId, singleCommand)
      );
    } else if (singleCommand === 'L' || singleCommand === 'R') {
      // await this.rotateRoverUseCase.execute(...);
    }
  }
}
```

---

### Decisión 6: Rover recibe Grid en move()

**ELEGIDA: Inyectar Grid como parámetro de método**

```typescript
// ✅ Grid pasa como argumento
rover.move(command: MovementCommand, grid: Grid): void
```

**Alternativas descartadas:**
- **Option A:** Rover guarda referencia a Grid en constructor - Acoplamiento fuerte, rompe encapsulación.
- **Option B:** Rover no valida, Use Case valida antes de llamar a move() - Rover pierde responsabilidad sobre su movimiento, lógica de dominio en aplicación.

**Razones:**
- **Dependency Inversion:** Rover depende de la abstracción Grid (agregado del mismo dominio), no de infraestructura.
- **Tell Don't Ask:** Rover le dice al Grid "valida estas coordenadas", no le pregunta por obstáculos/límites para validar él mismo.
- **Single Call Site:** Solo el Use Case llama a `move()`, y el Use Case ya tiene el Grid. Pasar como parámetro es natural.

**Por qué no es acoplamiento problemático:**
- Rover y Grid están en el mismo dominio (Mars Rover).
- Grid es un agregado, no infraestructura.
- Rover NO guarda referencia al Grid (solo lo usa en el método).

---

## 11. Extensiones Futuras

Con esta arquitectura, las siguientes features se implementan naturalmente:

### 1. Rotación (L, R)

**Cambios necesarios:**
```typescript
// Direction.value-object.ts
rotateLeft(): Direction {
  const rotations = {
    [CardinalDirection.NORTH]: CardinalDirection.WEST,
    [CardinalDirection.WEST]: CardinalDirection.SOUTH,
    [CardinalDirection.SOUTH]: CardinalDirection.EAST,
    [CardinalDirection.EAST]: CardinalDirection.NORTH,
  };
  return new Direction(rotations[this.value]);
}

rotateRight(): Direction {
  const rotations = {
    [CardinalDirection.NORTH]: CardinalDirection.EAST,
    [CardinalDirection.EAST]: CardinalDirection.SOUTH,
    [CardinalDirection.SOUTH]: CardinalDirection.WEST,
    [CardinalDirection.WEST]: CardinalDirection.NORTH,
  };
  return new Direction(rotations[this.value]);
}

// Rover.entity.ts
rotate(command: 'L' | 'R'): void {
  const newDirection = command === 'L'
    ? this._position.direction.rotateLeft()
    : this._position.direction.rotateRight();

  this._position = Position.at(this._position.coordinates, newDirection);
}
```

**Nuevo Use Case:** `RotateRoverUseCase` - similar estructura a `MoveRoverUseCase`.

---

### 2. Secuencia de Comandos

**Nuevo Use Case:** `ExecuteCommandSequenceUseCase`

```typescript
async execute(command: CommandSequenceCommand) {
  const rover = await this.roverRepository.findById(command.roverId);
  const grid = await this.gridRepository.getGrid();

  for (const cmd of command.sequence.split('')) {
    switch (cmd) {
      case 'F':
      case 'B':
        rover.move(cmd, grid);
        break;
      case 'L':
      case 'R':
        rover.rotate(cmd);
        break;
      default:
        throw new InvalidCommandException(`Unknown command: ${cmd}`);
    }
  }

  await this.roverRepository.save(rover);
}
```

**Detalle importante:** Si un obstáculo se detecta a mitad de secuencia, la excepción detiene la ejecución. El rover permanece en la última posición válida (antes del obstáculo). Esto es correcto según los requisitos: "stops BEFORE collision".

---

### 3. Consulta de Posición (Query)

**Nuevo Use Case:** `GetRoverPositionUseCase`

```typescript
@Injectable()
export class GetRoverPositionUseCase {
  constructor(private readonly roverRepository: RoverRepository) {}

  async execute(roverId: string): Promise<RoverPositionDto> {
    const rover = await this.roverRepository.findById(roverId);
    if (!rover) {
      throw new NotFoundException(`Rover ${roverId} not found`);
    }

    return {
      roverId: rover.getId(),
      x: rover.position.coordinates.x,
      y: rover.position.coordinates.y,
      direction: rover.position.direction.value,
    };
  }
}
```

**Endpoint:** `GET /rovers/:id/position`

Esto eliminaría la necesidad de que `MoveRoverController` consulte el repositorio inline.

---

### 4. Configuración de Grid (Obstáculos)

Para testing E2E de obstáculos, necesitamos configurar el grid:

**Nuevo endpoint:** `POST /grid/configure`

```typescript
{
  "width": 10,
  "height": 10,
  "obstacles": [
    { "x": 3, "y": 4 },
    { "x": 5, "y": 7 }
  ]
}
```

**Use Case:** `ConfigureGridUseCase` - actualiza `InMemoryGridRepository`.

---

### 5. Múltiples Rovers (Colisiones entre rovers)

**Nuevo concepto de dominio:** `RoverCollisionException`

**Lógica:**
- `Grid` mantiene lista de rovers desplegados (no solo obstáculos estáticos).
- `Grid.validateMovement()` verifica si otro rover ocupa la posición objetivo.
- Lanzar `RoverCollisionException` si hay colisión.

**Cambio arquitectónico:** Grid necesitaría conocer posiciones de todos los rovers. Esto podría requerir que `GridRepository` también exponga `getAllRovers()`, o que el Use Case coordine validaciones entre múltiples rovers.

**Complejidad:** Este feature requiere pensar en concurrencia (¿qué pasa si dos rovers intentan moverse a la misma celda simultáneamente?). Podría necesitar transacciones o locks.

---

### 6. Wrapping (Grid toroidal)

Si se requiere wrapping:

**Opción 1: GridDimensions con estrategia**

```typescript
interface BoundaryStrategy {
  handle(coordinates: Coordinates, dimensions: GridDimensions): Coordinates;
}

class ThrowBoundaryStrategy implements BoundaryStrategy {
  handle(coords: Coordinates, dims: GridDimensions): Coordinates {
    if (!dims.contains(coords)) {
      throw new OutOfBoundsException(...);
    }
    return coords;
  }
}

class WrappingBoundaryStrategy implements BoundaryStrategy {
  handle(coords: Coordinates, dims: GridDimensions): Coordinates {
    return Coordinates.create(
      ((coords.x % dims.width) + dims.width) % dims.width,
      ((coords.y % dims.height) + dims.height) % dims.height,
    );
  }
}
```

**Opción 2: Configuración en Grid**

```typescript
Grid.create(dimensions, obstacles, { wrapping: true })
```

---

## 12. Diagramas de Flujo Detallados

### Flujo: Movimiento Exitoso

```
┌───────────┐
│ Client    │
└─────┬─────┘
      │ POST /rovers/rover-1/move { command: "F" }
      ▼
┌─────────────────────┐
│ MoveRoverController │
└─────┬───────────────┘
      │ execute(MoveRoverCommand("rover-1", "F"))
      ▼
┌───────────────────┐
│ MoveRoverUseCase  │
└─────┬─────────────┘
      │ findById("rover-1")
      ▼
┌────────────────────┐
│ RoverRepository    │ → Returns: Rover(position: (5,5) NORTH)
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ GridRepository    │ → Returns: Grid(10x10, no obstacles)
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ Rover.move("F", grid) │
└─────┬─────────────┘
      │ direction.calculateNextCoordinates((5,5), true)
      ▼
┌───────────────────┐
│ Direction.calculateNext │ → Returns: Coordinates(5, 6)
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ Grid.validateMovement((5,6)) │
└─────┬─────────────┘
      │ dimensions.contains((5,6))? → YES
      │ hasObstacleAt((5,6))? → NO
      │ → OK (no exception)
      ▼
┌───────────────────┐
│ Rover updates position to (5,6) │
└─────┬─────────────┘
      │ save(rover)
      ▼
┌────────────────────┐
│ RoverRepository    │ → Persists: Rover(position: (5,6) NORTH)
└────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Controller          │ → Returns: { roverId: "rover-1", x: 5, y: 6, direction: "NORTH" }
└─────────────────────┘
      │
      ▼
┌───────────┐
│ Client    │ ← 200 OK
└───────────┘
```

---

### Flujo: Detección de Obstáculo

```
┌───────────┐
│ Client    │
└─────┬─────┘
      │ POST /rovers/rover-1/move { command: "F" }
      ▼
┌─────────────────────┐
│ MoveRoverController │
└─────┬───────────────┘
      │ execute(MoveRoverCommand("rover-1", "F"))
      ▼
┌───────────────────┐
│ MoveRoverUseCase  │
└─────┬─────────────┘
      │ findById("rover-1")
      ▼
┌────────────────────┐
│ RoverRepository    │ → Returns: Rover(position: (5,5) NORTH)
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ GridRepository    │ → Returns: Grid(10x10, obstacle at (5,6))
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ Rover.move("F", grid) │
└─────┬─────────────┘
      │ direction.calculateNextCoordinates((5,5), true)
      ▼
┌───────────────────┐
│ Direction.calculateNext │ → Returns: Coordinates(5, 6)
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ Grid.validateMovement((5,6)) │
└─────┬─────────────┘
      │ dimensions.contains((5,6))? → YES
      │ hasObstacleAt((5,6))? → YES! 🚫
      │
      ▼ THROW ObstacleDetectedException
      ┌────────────────────────────┐
      │ Exception propagates up    │
      └─────┬──────────────────────┘
            │
            ▼
┌───────────────────┐
│ Rover.move() aborts │ → Rover position UNCHANGED (5,5)
└─────┬─────────────┘
      │ Exception continues up
      ▼
┌───────────────────┐
│ MoveRoverUseCase  │ → Exception propagates
└─────┬─────────────┘
      │
      ▼
┌─────────────────────┐
│ MoveRoverController │
└─────┬───────────────┘
      │ catch (ObstacleDetectedException)
      ▼
┌─────────────────────┐
│ throw HttpException(409) │
└─────┬───────────────┘
      │
      ▼
┌───────────┐
│ Client    │ ← 409 Conflict { message: "Cannot move to (5,6): obstacle detected" }
└───────────┘
```

---

## 13. Checklist de Implementación

### Pre-implementación
- [ ] Leer y entender el plan completo
- [ ] Revisar código existente (deployment feature)
- [ ] Configurar rama: `git checkout -b feature/move-rover`

### Iteración 1: Happy Path
- [ ] Test: Direction calcula next coords (Norte forward)
- [ ] Implementar: Direction.calculateNextCoordinates() (Norte)
- [ ] Test: Direction 4 direcciones forward
- [ ] Implementar: Direction casos Este, Sur, Oeste
- [ ] Test: Position.withCoordinates()
- [ ] Implementar: Position.withCoordinates()
- [ ] Test: Grid.validateMovement() happy path
- [ ] Implementar: Grid.validateMovement()
- [ ] Test: Rover.move('F') 4 direcciones
- [ ] Implementar: Rover.move() con tipo MovementCommand
- [ ] Test: MoveRoverUseCase exitoso
- [ ] Implementar: MoveRoverCommand
- [ ] Implementar: MoveRoverUseCase
- [ ] Implementar: MoveRoverController
- [ ] Actualizar: RoverModule
- [ ] Test E2E: movimiento forward exitoso
- [ ] **Commit:** `feat: implement forward movement for rover`

### Iteración 2: Backward
- [ ] Test: Direction calcula backward (4 direcciones)
- [ ] Implementar: lógica backward en calculateNextCoordinates
- [ ] Test: Rover.move('B') 4 direcciones
- [ ] Test: Use Case backward
- [ ] Test E2E: backward exitoso
- [ ] **Commit:** `feat: implement backward movement for rover`

### Iteración 3: Obstáculos
- [ ] Test: Grid.validateMovement() con obstáculo
- [ ] Test: Rover.move() obstáculo forward
- [ ] Test: Rover.move() obstáculo backward
- [ ] Test: Use Case propaga excepción obstáculo
- [ ] Actualizar: Controller mapea a 409
- [ ] Test E2E: obstáculo (temporal skip si no hay config)
- [ ] **Commit:** `feat: detect obstacles during rover movement`

### Iteración 4: Límites
- [ ] Test: Grid.validateMovement() fuera de límites
- [ ] Test: Rover.move() 4 bordes
- [ ] Test: Use Case propaga excepción límites
- [ ] Actualizar: Controller mapea a 400
- [ ] Test E2E: intento salir de límites
- [ ] **Commit:** `feat: respect grid boundaries during movement`

### Iteración 5: Edge Cases
- [ ] Test: Use Case rover inexistente
- [ ] Test E2E: 404 rover no existe
- [ ] Test E2E: movimientos secuenciales
- [ ] Test: casos edge posiciones (0,0), (9,9)
- [ ] Refinar mensajes de error
- [ ] **Commit:** `test: add edge cases and improve error messages for movement`

### Iteración 6: Integración
- [ ] Ejecutar: `npm run test` (todos los tests pasan)
- [ ] Ejecutar: `npm run test:e2e` (E2E pasa)
- [ ] Verificar: `npm run test:cov` (cobertura adecuada)
- [ ] Actualizar: README con endpoints de movimiento
- [ ] Agregar: ejemplos de uso curl
- [ ] **Commit:** `docs: add movement feature documentation`

### Post-implementación
- [ ] Code review (self o equipo)
- [ ] Merge a main
- [ ] Tag: `v0.2.0` (movimiento implementado)

---

## 14. Comandos Útiles Durante Implementación

```bash
# Ejecutar tests específicos en watch mode
npm run test -- --watch direction.value-object.spec.ts

# Ejecutar tests de un describe específico
npm run test -- --testNamePattern="calculating next coordinates"

# Ejecutar tests con cobertura de archivo específico
npm run test -- --coverage --collectCoverageFrom="src/domain/value-objects/direction.value-object.ts"

# Ejecutar E2E de movimiento
npm run test:e2e -- move-rover.e2e-spec.ts

# Ejecutar solo tests unitarios de dominio
npm run test -- test/unit/domain

# Ver cobertura completa
npm run test:cov

# Levantar server en desarrollo
npm run start:dev

# Probar endpoint manualmente
curl -X POST http://localhost:3000/rovers/rover-1/move \
  -H "Content-Type: application/json" \
  -d '{"command":"F"}'
```

---

## 15. Notas Finales

### Principios Seguidos

1. **TDD Estricto:** Cada funcionalidad comienza con un test fallando (Red), luego implementación mínima (Green), luego mejora (Refactor).

2. **Vertical Slicing:** Cada iteración atraviesa todas las capas (dominio → aplicación → infraestructura) y es deployable.

3. **YAGNI:** No implementamos wrapping, secuencias de comandos, o múltiples rovers hasta que sean requeridos.

4. **Lenguaje Ubicuo:** Tests y código usan términos del dominio Mars Rover (rover, grid, obstacle, forward, backward, direction).

5. **Arquitectura Hexagonal Estricta:** Dependencias apuntan hacia el dominio. Infraestructura es intercambiable.

6. **Inmutabilidad:** Value Objects son inmutables. Movimiento crea nueva Position, no modifica la existente.

### Métricas de Éxito

- **Cobertura de tests:** > 90% en dominio y aplicación
- **Tests E2E:** Todos los escenarios de aceptación cubiertos
- **Tiempo de ejecución tests:** < 5 segundos (unitarios), < 10 segundos (E2E)
- **Complejidad ciclomática:** < 10 en todos los métodos
- **Legibilidad:** Cualquier developer puede leer un test y entender el comportamiento sin ver la implementación

### Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Rover inexistente al intentar mover | Test y manejo de NotFoundException en Use Case |
| Grid no configurado | InMemoryGridRepository tiene grid por defecto (10x10 vacío) |
| Múltiples comandos simultáneos al mismo rover | Fuera de scope. Futuro: usar locks o queue |
| Obstáculos configurables en E2E | Temporal: skip test de obstáculo. Futuro: implementar ConfigureGridUseCase |

---

**Fin del Plan Arquitectónico**

Este plan establece una feature completa, testeada, y extensible que respeta los principios de XP, DDD, y arquitectura hexagonal. Cada paso está justificado arquitectónicamente y preparado para TDD.

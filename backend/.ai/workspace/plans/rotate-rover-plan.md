# Plan Arquitectónico: User Story "Rotar Rover (Left/Right)"

## Resumen Ejecutivo

Esta funcionalidad representa el **tercer vertical slice** del sistema Mars Rover, implementando rotaciones del rover sin cambio de posición. A diferencia del movimiento (que requiere validación de obstáculos y límites), la rotación es una operación **local y sin validaciones externas**: el rover simplemente cambia su orientación sin desplazarse. Esto demuestra cómo la arquitectura hexagonal permite implementar features simples con mínimo impacto, reutilizando la infraestructura existente y enriqueciendo el modelo de dominio con comportamiento nuevo.

**Simplicidad clave:** No se requieren validaciones de Grid, no se crean excepciones nuevas, y los repositorios existentes son suficientes. Esta es una feature **pura de dominio**.

---

## 1. Análisis de Arquitectura

### Encaje en la Arquitectura Hexagonal Existente

```
┌──────────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                          │
│  ┌─────────────────────┐      ┌──────────────────────────┐  │
│  │  HTTP Adapter       │      │  In-Memory Adapter       │  │
│  │  DeployRoverCtrl    │      │  RoverRepository         │  │
│  │  MoveRoverCtrl      │      │  GridRepository          │  │
│  │  RotateRoverCtrl★NEW│      │  (UNCHANGED)             │  │
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
│                │ MoveRoverUseCase    │                        │
│                │ RotateRoverUseCase★NEW                       │
│                └──────────┬──────────┘                        │
│                           │                                   │
└───────────────────────────┼───────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────┐
│                  DOMAIN LAYER (Core)                          │
│                           │                                   │
│  ┌───────────────────┐    │    ┌────────────────────────┐   │
│  │  Grid (Agg)       │    │    │  Rover (Entity)        │   │
│  │  (UNCHANGED)      │    └───▶│  - rotate(cmd) ★NEW   │   │
│  │                   │          │  - position            │   │
│  └───────────────────┘          └────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Value Objects                           │   │
│  │  - Direction: rotateLeft() ★NEW                      │   │
│  │              rotateRight() ★NEW                      │   │
│  │  - Position: withDirection() ★NEW                    │   │
│  │  - Coordinates (UNCHANGED)                           │   │
│  │  - GridDimensions (UNCHANGED)                        │   │
│  │  - Obstacle (UNCHANGED)                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Exceptions                               │   │
│  │  (NO NEW EXCEPTIONS NEEDED)                          │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### Flujo de Rotación (Sequence Diagram)

```
Cliente HTTP → Controller → UseCase → Rover → Direction → Repository

POST /rovers/{id}/rotate
   { command: "L" }
        │
        ├─▶ RotateRoverController
        │       │
        │       ├─▶ RotateRoverUseCase.execute(roverId, "L")
        │       │       │
        │       │       ├─▶ roverRepo.findById(roverId)
        │       │       │       └─▶ Rover (position: (5,5) NORTH)
        │       │       │
        │       │       ├─▶ rover.rotate("L")
        │       │       │       │
        │       │       │       ├─▶ direction.rotateLeft()
        │       │       │       │       └─▶ Direction(WEST)
        │       │       │       │
        │       │       │       └─▶ position.withDirection(WEST)
        │       │       │               └─▶ Position((5,5) WEST)
        │       │       │
        │       │       └─▶ roverRepo.save(rover)
        │       │
        │       └─▶ return { position: {...} }
```

### Componentes a Reutilizar vs. Crear

**REUTILIZAR (sin modificar):**
- `Coordinates` - las coordenadas NO cambian en rotación
- `Grid` - NO participa en rotación (no hay validaciones necesarias)
- `GridDimensions` - no se usa
- `Obstacle` - no se valida
- Excepciones existentes - no se requieren nuevas
- `RoverRepository` - método `save()` y `findById()` son suficientes
- `GridRepository` - NO se usa en rotación

**EXTENDER (enhancements):**
- `Direction` - agregar métodos `rotateLeft()` y `rotateRight()`
- `Position` - agregar método `withDirection()` (simétrico a `withCoordinates()`)
- `Rover` - agregar método `rotate()`

**CREAR NUEVO:**
- `RotateRoverCommand` - DTO para el caso de uso
- `RotateRoverUseCase` - orquestación de la rotación
- `RotateRoverController` - adaptador HTTP
- Tests correspondientes

---

## 2. Modelo de Dominio (DDD)

### 2.1 Value Objects: Enhancements

#### `/src/domain/value-objects/direction.value-object.ts` (ENHANCED)

```typescript
import { Coordinates } from './coordinates.value-object';

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

  // EXISTING: Calculate next coordinates based on movement direction
  calculateNextCoordinates(
    current: Coordinates,
    moveForward: boolean,
  ): Coordinates {
    const delta = this.getMovementDelta(moveForward);
    return Coordinates.create(current.x + delta.x, current.y + delta.y);
  }

  // ★ NEW: Rotate 90 degrees counter-clockwise (left)
  rotateLeft(): Direction {
    const rotationMap: Record<CardinalDirection, CardinalDirection> = {
      [CardinalDirection.NORTH]: CardinalDirection.WEST,
      [CardinalDirection.WEST]: CardinalDirection.SOUTH,
      [CardinalDirection.SOUTH]: CardinalDirection.EAST,
      [CardinalDirection.EAST]: CardinalDirection.NORTH,
    };
    return new Direction(rotationMap[this.value]);
  }

  // ★ NEW: Rotate 90 degrees clockwise (right)
  rotateRight(): Direction {
    const rotationMap: Record<CardinalDirection, CardinalDirection> = {
      [CardinalDirection.NORTH]: CardinalDirection.EAST,
      [CardinalDirection.EAST]: CardinalDirection.SOUTH,
      [CardinalDirection.SOUTH]: CardinalDirection.WEST,
      [CardinalDirection.WEST]: CardinalDirection.NORTH,
    };
    return new Direction(rotationMap[this.value]);
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

**Por qué:**
- **Single Responsibility:** Direction es el experto en orientaciones cardinales. Sabe cómo rotar.
- **Immutability:** `rotateLeft()` y `rotateRight()` retornan nueva instancia, no mutan.
- **Clarity:** Mapas explícitos de rotación son auto-documentados: cualquier developer entiende Norte→Oeste (izquierda).
- **Symmetry:** Dos métodos simétricos (left/right) mejor que un método `rotate(direction: 'L' | 'R')` con condicional interno.
- **Reusability:** Estos métodos serán usados en futuras features (secuencias de comandos).

**Alternativa descartada:** Un solo método `rotate(clockwise: boolean)` - menos expresivo en el código cliente (`direction.rotate(false)` vs `direction.rotateLeft()`).

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

  // EXISTING: Create new position with updated coordinates, keeping direction
  withCoordinates(newCoordinates: Coordinates): Position {
    return new Position(newCoordinates, this.direction);
  }

  // ★ NEW: Create new position with updated direction, keeping coordinates
  withDirection(newDirection: Direction): Position {
    return new Position(this.coordinates, newDirection);
  }
}
```

**Por qué:**
- **Symmetry:** `withDirection()` es simétrico a `withCoordinates()`. Mismo patrón, fácil de aprender.
- **Immutability:** Position sigue siendo inmutable. Crear nueva instancia preserva invariantes.
- **Expressiveness:** `position.withDirection(newDirection)` comunica claramente la intención.
- **Single Responsibility:** Position encapsula la lógica de crear variaciones de sí misma.

**Nota de diseño:** Podríamos haber hecho que Rover creara Position directamente con `Position.at(this._position.coordinates, newDirection)`, pero `withDirection()` es más expresivo y reutilizable.

---

### 2.2 Entidad: Rover (ENHANCED)

#### `/src/domain/entities/rover.entity.ts` (ENHANCED)

```typescript
import { Position } from '../value-objects/position.value-object';
import { Grid } from '../aggregates/grid.aggregate';

export type MovementCommand = 'F' | 'B';
export type RotationCommand = 'L' | 'R';

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

  // EXISTING: Move rover forward or backward
  move(command: MovementCommand, grid: Grid): void {
    const isForward = command === 'F';

    const nextCoordinates = this._position.direction.calculateNextCoordinates(
      this._position.coordinates,
      isForward,
    );

    grid.validateMovement(nextCoordinates);

    this._position = this._position.withCoordinates(nextCoordinates);
  }

  // ★ NEW: Rotate rover left or right (no grid validation needed)
  rotate(command: RotationCommand): void {
    const newDirection = command === 'L'
      ? this._position.direction.rotateLeft()
      : this._position.direction.rotateRight();

    this._position = this._position.withDirection(newDirection);
  }
}
```

**Por qué:**
- **Simplicity:** Rotación NO requiere Grid. El rover rota en su lugar, sin moverse.
- **Type Safety:** `RotationCommand = 'L' | 'R'` previene comandos inválidos.
- **Consistency:** Mismo patrón que `move()`: delega a Direction la lógica, luego actualiza Position.
- **No Validation:** Sin validaciones = método más simple, más rápido, menos tests.

**Decisión clave:** ¿Por qué `rotate()` NO recibe Grid?
- Rover no se mueve (coordenadas iguales) → No hay riesgo de colisión → No necesita validar obstáculos/límites
- Grid es el guardian del **espacio físico**, no de la **orientación**
- Esto hace la rotación más simple y eficiente

**Tipo de comando separado:** `RotationCommand` vs `MovementCommand` permite:
- Type safety en llamadas: `rover.rotate('L')` solo acepta 'L' o 'R'
- Claridad semántica: rotación ≠ movimiento
- Preparación para futura unificación: `type Command = MovementCommand | RotationCommand`

---

### 2.3 Agregado: Grid (UNCHANGED)

**NO se requieren cambios en Grid.**

La rotación es una operación puramente local del Rover. Grid no participa. Esto demuestra el principio de **separación de responsabilidades**:
- Grid: guarda espacio físico (límites, obstáculos)
- Rover: guarda orientación (dirección)

Si en el futuro agregamos restricciones de rotación (ej: "el rover no puede rotar si hay una pared cerca"), Grid participaría. Pero YAGNI por ahora.

---

### 2.4 Excepciones de Dominio (NO CHANGES)

**NO se requieren nuevas excepciones.**

La rotación no puede fallar desde el punto de vista del dominio:
- No sale de límites (coordenadas no cambian)
- No choca con obstáculos (no se mueve)
- Siempre hay una dirección válida para rotar

**Excepciones potenciales en aplicación:**
- `NotFoundException` (rover no existe) - ya existe en NestJS, se reutiliza en Use Case

---

## 3. Puertos (Interfaces del Dominio)

### No se requieren nuevos puertos

Los puertos existentes son suficientes:

```typescript
// RoverRepository.port.ts - REUTILIZAR
export interface RoverRepository {
  save(rover: Rover): Promise<void>;          // ✓ Para actualizar dirección
  findById(id: string): Promise<Rover | null>; // ✓ Para recuperar rover
}

// GridRepository.port.ts - NO SE USA en rotación
```

**Por qué no necesitamos GridRepository:** Rotación no valida contra Grid, por lo tanto no necesitamos obtenerlo del repositorio. El Use Case solo usa RoverRepository.

---

## 4. Capa de Aplicación (Casos de Uso)

### 4.1 Command DTO

#### `/src/application/commands/rotate-rover.command.ts` (NEW)

```typescript
import { RotationCommand } from '../../domain/entities/rover.entity';

export class RotateRoverCommand {
  constructor(
    public readonly roverId: string,
    public readonly command: RotationCommand, // 'L' | 'R'
  ) {}
}
```

**Por qué:** DTO simple que transporta el ID del rover y el comando de rotación. Usa el tipo `RotationCommand` del dominio para seguridad de tipos.

---

### 4.2 Use Case

#### `/src/application/usecases/rotate-rover.use-case.ts` (NEW)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { RotateRoverCommand } from '../commands/rotate-rover.command';
import { RoverRepository } from '../../domain/port/rover.repository.port';

@Injectable()
export class RotateRoverUseCase {
  constructor(
    private readonly roverRepository: RoverRepository,
  ) {}

  async execute(command: RotateRoverCommand): Promise<void> {
    const rover = await this.roverRepository.findById(command.roverId);

    if (!rover) {
      throw new NotFoundException(
        `Rover with id ${command.roverId} not found`,
      );
    }

    rover.rotate(command.command);

    await this.roverRepository.save(rover);
  }
}
```

**Por qué:**
- **Simplicity:** Más simple que `MoveRoverUseCase` - no necesita Grid
- **Single Responsibility:** Solo orquesta: recupera rover, ejecuta rotación, persiste
- **Error Handling:** `NotFoundException` si rover no existe (mismo patrón que movimiento)
- **No Business Logic:** Toda la lógica está en el dominio (Rover y Direction)

**Diferencia clave con MoveRoverUseCase:**
```typescript
// MoveRoverUseCase - requiere Grid
const rover = await this.roverRepository.findById(command.roverId);
const grid = await this.gridRepository.getGrid();  // ← necesario
rover.move(command.command, grid);                  // ← validación

// RotateRoverUseCase - NO requiere Grid
const rover = await this.roverRepository.findById(command.roverId);
rover.rotate(command.command);                      // ← sin validación
```

---

## 5. Adaptadores (Infraestructura)

### 5.1 Repository Adapters (REUTILIZAR)

Los adaptadores existentes NO necesitan cambios:
- `InMemoryRoverRepository.save()` - sobrescribe el rover con nueva dirección
- `InMemoryRoverRepository.findById()` - recupera rover

**GridRepository no se usa.**

---

### 5.2 HTTP Adapter (Controller)

#### `/src/infrastructure/http/rotate-rover.controller.ts` (NEW)

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
import { RotateRoverUseCase } from '../../application/usecases/rotate-rover.use-case';
import { RotateRoverCommand } from '../../application/commands/rotate-rover.command';

class RotateRoverRequestDto {
  command: 'L' | 'R';
}

class RotateRoverResponseDto {
  roverId: string;
  x: number;
  y: number;
  direction: string;
}

@Controller('rovers')
export class RotateRoverController {
  constructor(private readonly rotateRoverUseCase: RotateRoverUseCase) {}

  @Post(':id/rotate')
  @HttpCode(200)
  async rotateRover(
    @Param('id') roverId: string,
    @Body() dto: RotateRoverRequestDto,
  ): Promise<RotateRoverResponseDto> {
    try {
      const command = new RotateRoverCommand(roverId, dto.command);

      await this.rotateRoverUseCase.execute(command);

      // Query rover to return updated position
      // (Future: extract to GetRoverPositionUseCase)
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
      throw error;
    }
  }

  // Temporal: inline query (future: inject GetRoverPositionUseCase)
  private async getRoverById(roverId: string) {
    // This will be injected properly via RoverRepository
    // For now, inline implementation to be refined
    throw new Error('Not implemented: inject RoverRepository');
  }
}
```

**Por qué:**
- **RESTful Design:** `POST /rovers/:id/rotate` con body `{ command: "L" }` o `{ command: "R" }`
- **Consistency:** Misma estructura que `MoveRoverController`
- **Error Handling:** Solo `NotFoundException` → 404 (no hay errores de dominio como obstáculos/límites)
- **Response:** Retorna posición completa del rover (incluye dirección actualizada)

**HTTP Codes:**
- `200 OK` - rotación exitosa
- `404 NOT FOUND` - rover no existe
- `400 BAD REQUEST` - comando inválido (NestJS validation pipe lo maneja)

**Nota sobre response:**
Como rotación NO cambia coordenadas, el cliente recibirá:
```json
{
  "roverId": "rover-1",
  "x": 5,          // ← SIN cambio
  "y": 5,          // ← SIN cambio
  "direction": "WEST"  // ← CAMBIADO (antes era NORTH)
}
```

Esto es intuitivo y consistente con el endpoint de movimiento.

---

### 5.3 NestJS Module (ACTUALIZAR)

#### `/src/infrastructure/config/rover.module.ts` (ENHANCED)

```typescript
import { Module } from '@nestjs/common';
import { DeployRoverController } from '../http/deploy-rover.controller';
import { MoveRoverController } from '../http/move-rover.controller';
import { RotateRoverController } from '../http/rotate-rover.controller'; // ★ NEW
import { DeployRoverUseCase } from '../../application/usecases/deploy-rover.use-case';
import { MoveRoverUseCase } from '../../application/usecases/move-rover.use-case';
import { RotateRoverUseCase } from '../../application/usecases/rotate-rover.use-case'; // ★ NEW
import { InMemoryRoverRepository } from '../persistence/in-memory-rover.repository';
import { InMemoryGridRepository } from '../persistence/in-memory-grid.repository';

@Module({
  controllers: [
    DeployRoverController,
    MoveRoverController,
    RotateRoverController, // ★ NEW
  ],
  providers: [
    DeployRoverUseCase,
    MoveRoverUseCase,
    RotateRoverUseCase, // ★ NEW
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

**Por qué:** Solo agregamos el nuevo controlador y caso de uso. Los repositorios se reutilizan.

---

## 6. Estrategia de Testing (TDD/BDD)

### Filosofía de Tests

Nombres de tests en **lenguaje de negocio**, siguiendo BDD:
- ✅ "should face west when rotating left from north"
- ❌ "should set direction value to WEST when current is NORTH and command is L"

### Estructura de Tests (Orden Outside-In TDD)

---

### Fase 1: Tests de Dominio (Unit Tests)

#### **Test Suite 1: Direction rotations**

`/test/unit/domain/value-objects/direction.value-object.spec.ts` (ENHANCED - agregar nuevos tests)

```typescript
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';

describe('Direction Value Object', () => {
  // ... tests existentes de calculateNextCoordinates ...

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
```

**Cobertura de tests:**
- 4 tests para `rotateLeft()` (una por dirección cardinal)
- 4 tests para `rotateRight()` (una por dirección cardinal)
- 1 test de ciclo completo (4 rotaciones = vuelta completa)
- 2 tests de simetría (left/right se cancelan)

**Total:** 11 nuevos tests para Direction.

---

#### **Test Suite 2: Position with direction**

`/test/unit/domain/value-objects/position.value-object.spec.ts` (NEW)

```typescript
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';

describe('Position Value Object', () => {
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
```

---

#### **Test Suite 3: Rover rotates**

`/test/unit/domain/entities/rover.entity.spec.ts` (ENHANCED - agregar nuevos tests)

```typescript
import { Rover, RotationCommand } from '../../../../src/domain/entities/rover.entity';
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';

describe('Rover Entity', () => {
  // ... tests existentes de move() ...

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
```

**Cobertura de tests Rover:**
- 4 tests rotateLeft (una por dirección)
- 4 tests rotateRight (una por dirección)
- 3 tests de rotaciones múltiples
- 1 test de invariante (coordenadas no cambian)

**Total:** 12 nuevos tests para Rover.

---

### Fase 2: Tests de Aplicación (Use Case Tests)

#### **Test Suite 4: RotateRoverUseCase orchestration**

`/test/unit/application/usecases/rotate-rover.use-case.spec.ts` (NEW)

```typescript
import { RotateRoverUseCase } from '../../../../src/application/usecases/rotate-rover.use-case';
import { RotateRoverCommand } from '../../../../src/application/commands/rotate-rover.command';
import { InMemoryRoverRepository } from '../../../../src/infrastructure/persistence/in-memory-rover.repository';
import { Rover } from '../../../../src/domain/entities/rover.entity';
import { Position } from '../../../../src/domain/value-objects/position.value-object';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { NotFoundException } from '@nestjs/common';

describe('RotateRoverUseCase', () => {
  let useCase: RotateRoverUseCase;
  let roverRepository: InMemoryRoverRepository;

  beforeEach(() => {
    roverRepository = new InMemoryRoverRepository();
    useCase = new RotateRoverUseCase(roverRepository);
  });

  describe('successful rotation', () => {
    it('should rotate rover left and persist new direction', async () => {
      // Arrange: deploy rover at (5,5) facing north
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new RotateRoverCommand('rover-1', 'L');

      // Act: execute rotation
      await useCase.execute(command);

      // Assert: rover now facing west, coordinates unchanged
      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover).toBeDefined();
      expect(updatedRover!.position.coordinates.x).toBe(5);
      expect(updatedRover!.position.coordinates.y).toBe(5);
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.WEST);
    });

    it('should rotate rover right and persist new direction', async () => {
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      const command = new RotateRoverCommand('rover-1', 'R');

      await useCase.execute(command);

      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.EAST);
      // Coordinates unchanged
      expect(updatedRover!.position.coordinates.x).toBe(5);
      expect(updatedRover!.position.coordinates.y).toBe(5);
    });

    it('should handle multiple sequential rotations', async () => {
      const initialPosition = Position.at(
        Coordinates.create(3, 7),
        Direction.north(),
      );
      const rover = Rover.deploy('rover-1', initialPosition);
      await roverRepository.save(rover);

      // Rotate left (WEST)
      await useCase.execute(new RotateRoverCommand('rover-1', 'L'));

      // Rotate left again (SOUTH)
      await useCase.execute(new RotateRoverCommand('rover-1', 'L'));

      const updatedRover = await roverRepository.findById('rover-1');
      expect(updatedRover!.position.direction.value).toBe(CardinalDirection.SOUTH);
      // Still at original position
      expect(updatedRover!.position.coordinates.x).toBe(3);
      expect(updatedRover!.position.coordinates.y).toBe(7);
    });
  });

  describe('error scenarios', () => {
    it('should throw NotFoundException when rover does not exist', async () => {
      const command = new RotateRoverCommand('non-existent-rover', 'L');

      await expect(useCase.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should not modify repository when rover not found', async () => {
      // Arrange: deploy a different rover
      const initialPosition = Position.at(
        Coordinates.create(5, 5),
        Direction.north(),
      );
      const rover = Rover.deploy('existing-rover', initialPosition);
      await roverRepository.save(rover);

      // Act: try to rotate non-existent rover
      try {
        await useCase.execute(new RotateRoverCommand('other-rover', 'L'));
      } catch (e) {
        // Expected to throw
      }

      // Assert: existing rover unchanged
      const unchangedRover = await roverRepository.findById('existing-rover');
      expect(unchangedRover!.position.direction.value).toBe(CardinalDirection.NORTH);
    });
  });
});
```

**Cobertura de tests Use Case:**
- 2 tests de rotación exitosa (left/right)
- 1 test de rotaciones secuenciales
- 2 tests de error (rover no encontrado)

**Total:** 5 tests para Use Case.

---

### Fase 3: Tests E2E (API Tests)

#### **Test Suite 5: Rotate Rover API**

`/test/e2e/rotate-rover.e2e-spec.ts` (NEW)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Rotate Rover (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Deploy a rover first for testing rotation
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

  describe('POST /rovers/:id/rotate', () => {
    it('should rotate rover left successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200)
        .expect((res) => {
          expect(res.body.roverId).toBe('test-rover');
          expect(res.body.x).toBe(5);           // unchanged
          expect(res.body.y).toBe(5);           // unchanged
          expect(res.body.direction).toBe('WEST'); // rotated left from NORTH
        });
    });

    it('should rotate rover right successfully', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'R' })
        .expect(200)
        .expect((res) => {
          expect(res.body.roverId).toBe('test-rover');
          expect(res.body.x).toBe(5);
          expect(res.body.y).toBe(5);
          expect(res.body.direction).toBe('EAST'); // rotated right from NORTH
        });
    });

    it('should return 404 when rover does not exist', () => {
      return request(app.getHttpServer())
        .post('/rovers/non-existent/rotate')
        .send({ command: 'L' })
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });

    it('should handle multiple sequential rotations', async () => {
      // Rotate left (NORTH → WEST)
      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      // Rotate left again (WEST → SOUTH)
      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      // Rotate right (SOUTH → WEST)
      const response = await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'R' })
        .expect(200);

      expect(response.body.direction).toBe('WEST');
      // Coordinates still unchanged after 3 rotations
      expect(response.body.x).toBe(5);
      expect(response.body.y).toBe(5);
    });

    it('should return to original direction after 4 left rotations', async () => {
      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      expect(response.body.direction).toBe('NORTH'); // back to original
    });

    it('should keep rover at same position after rotations', async () => {
      // Deploy rover at specific position
      await request(app.getHttpServer())
        .post('/rovers/deploy')
        .send({
          roverId: 'position-test-rover',
          x: 3,
          y: 7,
          direction: 'SOUTH',
        })
        .expect(201);

      // Perform multiple rotations
      await request(app.getHttpServer())
        .post('/rovers/position-test-rover/rotate')
        .send({ command: 'L' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/rovers/position-test-rover/rotate')
        .send({ command: 'R' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post('/rovers/position-test-rover/rotate')
        .send({ command: 'R' })
        .expect(200);

      // Position unchanged
      expect(response.body.x).toBe(3);
      expect(response.body.y).toBe(7);
    });

    it('should return 400 when command is invalid', () => {
      return request(app.getHttpServer())
        .post('/rovers/test-rover/rotate')
        .send({ command: 'X' }) // invalid command
        .expect(400);
    });
  });
});
```

**Cobertura de tests E2E:**
- 2 tests de rotación exitosa (left/right)
- 1 test de rover no encontrado (404)
- 3 tests de rotaciones múltiples/secuenciales
- 1 test de comando inválido (400)

**Total:** 7 tests E2E.

---

## 7. Orden de Implementación (Vertical Slicing)

### Iteración 1: Happy Path - Rotación Left

**Objetivo:** Rover puede rotar a la izquierda desde cualquier dirección.

1. **TDD Ciclo 1: Direction rotateLeft()**
   - Crear test: `direction.value-object.spec.ts` - "should face west when rotating left from north"
   - Implementar: `Direction.rotateLeft()` - caso Norte
   - Red → Green → Refactor
   - Extender test: las 4 direcciones rotateLeft
   - Implementar: rotación completa con mapa

2. **TDD Ciclo 2: Position withDirection()**
   - Crear test: `position.value-object.spec.ts` - método `withDirection()`
   - Implementar: `Position.withDirection()`
   - Test: inmutabilidad (original no cambia)

3. **TDD Ciclo 3: Rover rotate() left**
   - Crear test: `rover.entity.spec.ts` - `rotate('L')` en las 4 direcciones
   - Implementar: `Rover.rotate()` método con tipo `RotationCommand`
   - Test: coordenadas no cambian

4. **TDD Ciclo 4: Use Case orquesta left**
   - Crear test: `rotate-rover.use-case.spec.ts` - caso exitoso left
   - Crear: `RotateRoverCommand.ts`
   - Implementar: `RotateRoverUseCase.execute()`

5. **TDD Ciclo 5: HTTP Endpoint left**
   - Crear: `RotateRoverController.ts` - endpoint `POST /rovers/:id/rotate`
   - Actualizar: `RoverModule` - registrar controlador y caso de uso
   - Crear test: `rotate-rover.e2e-spec.ts` - caso exitoso left

**Checkpoint:** Rover rota izquierda en todas direcciones.
**Commit:** `feat: implement left rotation for rover`

**Tests passing:**
- Direction rotateLeft (4 direcciones)
- Position withDirection
- Rover rotate('L') (4 direcciones)
- Use Case orquesta rotación left
- E2E: POST /rovers/:id/rotate con L retorna nueva dirección

---

### Iteración 2: Rotación Right

**Objetivo:** Rover puede rotar a la derecha.

6. **TDD Ciclo 6: Direction rotateRight()**
   - Agregar tests: rotateRight en las 4 direcciones
   - Implementar: `Direction.rotateRight()` con mapa

7. **TDD Ciclo 7: Rover rotate() right**
   - Agregar tests: `rover.entity.spec.ts` - `rotate('R')` en las 4 direcciones
   - Verificar: la implementación ya soporta 'R' (usa mismo método que 'L')

8. **TDD Ciclo 8: Use Case right**
   - Agregar test: `rotate-rover.use-case.spec.ts` - caso right
   - Verificar: ya funciona (sin cambios necesarios)

9. **TDD Ciclo 9: E2E right**
   - Agregar test: `rotate-rover.e2e-spec.ts` - rotación right
   - Verificar: endpoint soporta 'R'

**Checkpoint:** Rover rota izquierda y derecha en todas direcciones.
**Commit:** `feat: implement right rotation for rover`

**Tests passing:**
- Direction rotateRight (4 direcciones)
- Rover rotate('R') (4 direcciones)
- Use Case right
- E2E: comando 'R' retorna nueva dirección

---

### Iteración 3: Rotaciones Múltiples y Casos Edge

**Objetivo:** Verificar rotaciones secuenciales y casos límite.

10. **TDD Ciclo 10: Direction ciclo completo**
    - Agregar test: 4 rotaciones left vuelven al original
    - Agregar test: 4 rotaciones right vuelven al original
    - Agregar test: simetría (left + right se cancelan)

11. **TDD Ciclo 11: Rover rotaciones múltiples**
    - Agregar test: 4 rotaciones consecutivas
    - Agregar test: rotaciones alternadas (LRRL)
    - Agregar test: coordenadas invariantes tras múltiples rotaciones

12. **TDD Ciclo 12: Use Case rotaciones secuenciales**
    - Agregar test: ejecutar múltiples comandos seguidos
    - Verificar: persistencia correcta entre comandos

13. **TDD Ciclo 13: E2E casos edge**
    - Agregar test: 4 rotaciones vuelven al original
    - Agregar test: coordenadas no cambian tras rotaciones
    - Agregar test: comando inválido retorna 400

**Checkpoint:** Todos los casos edge cubiertos.
**Commit:** `test: add edge cases for rover rotation`

**Tests passing:**
- Ciclos completos (360°)
- Simetría de rotaciones
- Múltiples rotaciones secuenciales
- Invariante de posición

---

### Iteración 4: Manejo de Errores

**Objetivo:** Rover inexistente y comandos inválidos.

14. **TDD Ciclo 14: Rover inexistente**
    - Agregar test: `rotate-rover.use-case.spec.ts` - comando para rover que no existe
    - Implementar: validación en `RotateRoverUseCase` - lanzar `NotFoundException`
    - Agregar test E2E: 404 cuando rover no existe

15. **TDD Ciclo 15: Controller mapeo de errores**
    - Actualizar: `RotateRoverController` - catch `NotFoundException` → 404
    - Agregar test E2E: comando inválido retorna 400 (NestJS validation)

**Checkpoint:** Manejo de errores completo.
**Commit:** `feat: add error handling for rover rotation`

**Tests passing:**
- Comando a rover inexistente retorna 404
- Comando inválido retorna 400

---

### Iteración 5: Integración y Documentación

16. **Validación de integración**
    - Ejecutar suite completa de tests: `npm run test`
    - Ejecutar tests E2E: `npm run test:e2e`
    - Verificar cobertura: `npm run test:cov`

17. **Actualizar documentación**
    - Actualizar README: agregar endpoint de rotación
    - Agregar ejemplos de uso curl/Postman
    - Documentar códigos de error

**Checkpoint:** Feature completa y documentada.
**Commit:** `docs: add rotation feature documentation`

---

## 8. Estructura Final de Archivos

```
src/
├── domain/
│   ├── aggregates/
│   │   └── grid.aggregate.ts                      [UNCHANGED]
│   ├── entities/
│   │   └── rover.entity.ts                        [ENHANCED] ★
│   ├── exceptions/
│   │   ├── obstacle-detected.exception.ts         [UNCHANGED]
│   │   └── out-of-bounds.exception.ts             [UNCHANGED]
│   ├── port/
│   │   ├── grid.repository.port.ts                [UNUSED in rotation]
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
│   │   ├── move-rover.command.ts                  [UNCHANGED]
│   │   └── rotate-rover.command.ts                [NEW] ★
│   └── usecases/
│       ├── deploy-rover.use-case.ts               [UNCHANGED]
│       ├── move-rover.use-case.ts                 [UNCHANGED]
│       └── rotate-rover.use-case.ts               [NEW] ★
├── infrastructure/
│   ├── config/
│   │   └── rover.module.ts                        [ENHANCED] ★
│   ├── http/
│   │   ├── deploy-rover.controller.ts             [UNCHANGED]
│   │   ├── move-rover.controller.ts               [UNCHANGED]
│   │   └── rotate-rover.controller.ts             [NEW] ★
│   └── persistence/
│       ├── in-memory-grid.repository.ts           [UNUSED in rotation]
│       └── in-memory-rover.repository.ts          [UNCHANGED]
├── app.module.ts                                   [UNCHANGED]
└── main.ts                                         [UNCHANGED]

test/
├── unit/
│   ├── domain/
│   │   ├── aggregates/
│   │   │   └── grid.aggregate.spec.ts             [UNCHANGED]
│   │   ├── entities/
│   │   │   └── rover.entity.spec.ts               [ENHANCED] ★
│   │   └── value-objects/
│   │       ├── direction.value-object.spec.ts     [ENHANCED] ★
│   │       └── position.value-object.spec.ts      [ENHANCED] ★
│   └── application/
│       └── usecases/
│           ├── deploy-rover.use-case.spec.ts      [UNCHANGED]
│           ├── move-rover.use-case.spec.ts        [UNCHANGED]
│           └── rotate-rover.use-case.spec.ts      [NEW] ★
└── e2e/
    ├── deploy-rover.e2e-spec.ts                   [UNCHANGED]
    ├── move-rover.e2e-spec.ts                     [UNCHANGED]
    └── rotate-rover.e2e-spec.ts                   [NEW] ★
```

**Leyenda:**
- `[NEW] ★` - Archivo nuevo a crear
- `[ENHANCED] ★` - Archivo existente a modificar
- `[UNCHANGED]` - Archivo sin cambios (reutilizado)
- `[UNUSED in rotation]` - Archivo que NO se usa en esta feature

**Observación:** Grid y sus componentes (GridRepository, GridDimensions, Obstacle, excepciones relacionadas) NO participan en rotación. Esto demuestra el bajo acoplamiento de la arquitectura.

---

## 9. Criterios de Aceptación vs Tests

| Criterio de Aceptación | Tests Correspondientes |
|------------------------|------------------------|
| 1. Rover puede rotar left (L) 90° CCW | `direction.value-object.spec.ts`: "should face west when rotating left from north" (+ otras 3 direcciones)<br>`rover.entity.spec.ts`: "should face west when rotating left from north" (+ otras 3)<br>`rotate-rover.e2e-spec.ts`: "should rotate rover left successfully" |
| 2. North → West → South → East → North (L) | `direction.value-object.spec.ts`: tests individuales para cada transición<br>`rover.entity.spec.ts`: tests individuales para cada transición |
| 3. Rover puede rotar right (R) 90° CW | `direction.value-object.spec.ts`: "should face east when rotating right from north" (+ otras 3)<br>`rover.entity.spec.ts`: "should face east when rotating right from north" (+ otras 3)<br>`rotate-rover.e2e-spec.ts`: "should rotate rover right successfully" |
| 4. North → East → South → West → North (R) | `direction.value-object.spec.ts`: tests individuales para cada transición<br>`rover.entity.spec.ts`: tests individuales para cada transición |
| 5. Rotación NO cambia coordenadas (x, y) | `rover.entity.spec.ts`: "should keep rover at same position regardless of rotations"<br>`rotate-rover.e2e-spec.ts`: "should keep rover at same position after rotations" |
| 6. Todas las 4 direcciones cardinales soportan rotación | `direction.value-object.spec.ts`: 8 tests (4 left + 4 right)<br>`rover.entity.spec.ts`: 8 tests (4 left + 4 right) |
| 7. Rotaciones secuenciales funcionan correctamente | `rover.entity.spec.ts`: "should return to original direction after four left rotations"<br>`rotate-rover.use-case.spec.ts`: "should handle multiple sequential rotations"<br>`rotate-rover.e2e-spec.ts`: "should handle multiple sequential rotations" |

---

## 10. Decisiones Arquitectónicas Clave

### Decisión 1: ¿Dónde vive la lógica de rotación?

**ELEGIDA: Option A - Direction tiene rotateLeft() y rotateRight()**

```typescript
// ✅ Direction es el experto en orientaciones cardinales
direction.rotateLeft()  // → nueva Direction(WEST)
direction.rotateRight() // → nueva Direction(EAST)
```

**Alternativas descartadas:**
- **Option B (Rover calcula):** Rover tendría que conocer mapas de rotación. Violación de Single Responsibility.
- **Option C (RotationService):** Over-engineering. La rotación es comportamiento intrínseco de Direction, no una operación compleja que requiere servicio.

**Razones:**
- **Tell Don't Ask:** Direction dice cuál es su rotación, no exponemos su valor para que otros calculen.
- **Cohesión:** Lógica de direcciones cardinales está cohesionada en un solo lugar.
- **Reusabilidad:** En futuro (rotaciones de 45°, N-NE-E-SE...), solo cambia Direction.

---

### Decisión 2: ¿El Grid participa en rotación?

**ELEGIDA: Option A - Grid NO participa**

```typescript
// ✅ Rotación sin validación de Grid
rover.rotate(command: RotationCommand): void {
  // NO requiere grid como parámetro
  // Solo cambia dirección, no coordenadas
}
```

**Alternativas descartadas:**
- **Option B (Grid valida rotación):** No tiene sentido. El rover no se mueve, no puede chocar con nada ni salirse de límites.
- **Option C (Grid notificado):** En un sistema multi-rover futuro, Grid podría registrar orientaciones, pero YAGNI por ahora.

**Razones:**
- **YAGNI:** No hay validaciones necesarias. No implementar lo que no se necesita.
- **Performance:** Sin llamada a Grid = rotación más rápida.
- **Simplicidad:** Use Case más simple, menos dependencias.

**Extensibilidad futura:** Si agregamos restricciones de rotación (ej: "rover en pendiente no puede rotar"), Grid participaría:
```typescript
// Future: si se requiere validación
rover.rotate(command: RotationCommand, grid: Grid): void {
  // grid.validateRotation(this._position.coordinates) - validar terreno
  // ...
}
```

---

### Decisión 3: ¿Inmutabilidad de Position?

**ELEGIDA: Option A - Position.withDirection(newDirection)**

```typescript
// ✅ Simétrico con withCoordinates()
this._position = this._position.withDirection(newDirection);
```

**Alternativas descartadas:**
- **Option B (Crear Position directamente):** `this._position = Position.at(this._position.coordinates, newDirection)` - funciona, pero menos expresivo.

**Razones:**
- **Consistency:** Mismo patrón que `withCoordinates()` en movimiento.
- **Readability:** `withDirection()` comunica claramente que solo cambia dirección.
- **Encapsulation:** Position encapsula la lógica de crear variaciones de sí misma.

---

### Decisión 4: ¿Repository update?

**ELEGIDA: Reutilizar `save()` existente**

```typescript
// ✅ save() sobrescribe el rover con nueva dirección
await this.roverRepository.save(rover);
```

**Razones:**
- **Consistencia:** Mismo patrón que movimiento y despliegue.
- **Simplicidad:** No necesitamos método específico `updateDirection()`.

---

### Decisión 5: ¿Comando único vs. métodos separados?

**ELEGIDA: Option A - Comando único rotate(command: 'L' | 'R')**

```typescript
// ✅ Método único con parámetro
rover.rotate(command: RotationCommand): void
```

**Alternativas descartadas:**
- **Option B (Métodos separados):** `rover.rotateLeft()` y `rover.rotateRight()` - duplica código, dos endpoints HTTP.

**Razones:**
- **DRY:** Un solo método, un solo endpoint, un solo Use Case.
- **Consistency:** Mismo patrón que `move(command: 'F' | 'B')`.
- **Extensibility:** Fácil agregar 'U' (U-turn) o 'H' (half-turn) en futuro.

**Por qué es correcto tener dos métodos en Direction pero uno en Rover:**
- **Direction:** `rotateLeft()` y `rotateRight()` son **inmutables**, retornan nueva instancia. Simétricos y claros.
- **Rover:** `rotate(command)` es **mutación** de estado. Un método que decide según comando es más simple.

---

### Decisión 6: ¿Response del endpoint?

**ELEGIDA: Retornar posición completa (incluye dirección actualizada)**

```json
{
  "roverId": "rover-1",
  "x": 5,
  "y": 5,
  "direction": "WEST"  // ← actualizado
}
```

**Alternativas descartadas:**
- **Option A (Solo dirección):** `{ direction: "WEST" }` - incompleto, el cliente necesita saber posición completa.
- **Option B (Boolean success):** `{ success: true }` - poco informativo.

**Razones:**
- **Consistency:** Mismo formato que `MoveRoverController`.
- **Completeness:** Cliente obtiene toda la info del rover en una llamada.
- **Predictability:** API consistente facilita integración.

---

## 11. Extensiones Futuras

Con esta arquitectura, las siguientes features se implementan naturalmente:

### 1. Secuencia de Comandos (FFRFLB)

**Use Case:** `ExecuteCommandSequenceUseCase`

```typescript
async execute(command: CommandSequenceCommand) {
  const rover = await this.roverRepository.findById(command.roverId);
  const grid = await this.gridRepository.getGrid();

  for (const cmd of command.sequence.split('')) {
    switch (cmd) {
      case 'F':
      case 'B':
        rover.move(cmd, grid); // ← puede lanzar excepción si obstáculo
        break;
      case 'L':
      case 'R':
        rover.rotate(cmd);     // ← nunca falla
        break;
      default:
        throw new InvalidCommandException(`Unknown command: ${cmd}`);
    }
  }

  await this.roverRepository.save(rover);
}
```

**Ventaja de tener rotación separada:** En secuencias, si un movimiento falla (obstáculo), la rotación previa ya se ejecutó. El rover queda en la última posición válida con la última dirección válida.

---

### 2. Rotaciones de 45° (Direcciones intercardiales)

**Cambios necesarios:**

```typescript
// Expandir CardinalDirection
export enum Direction {
  NORTH = 'NORTH',
  NORTH_EAST = 'NORTH_EAST',
  EAST = 'EAST',
  SOUTH_EAST = 'SOUTH_EAST',
  SOUTH = 'SOUTH',
  SOUTH_WEST = 'SOUTH_WEST',
  WEST = 'WEST',
  NORTH_WEST = 'NORTH_WEST',
}

// Nuevos métodos en Direction
rotateLeft45(): Direction {
  // NORTH → NORTH_WEST → WEST → SOUTH_WEST → ...
}

rotateRight45(): Direction {
  // NORTH → NORTH_EAST → EAST → SOUTH_EAST → ...
}
```

**Comandos:** Agregar 'l' (left 45°) y 'r' (right 45°) además de 'L' y 'R'.

---

### 3. U-Turn (Giro de 180°)

**Nuevo método en Direction:**

```typescript
reverse(): Direction {
  const reverseMap: Record<CardinalDirection, CardinalDirection> = {
    [CardinalDirection.NORTH]: CardinalDirection.SOUTH,
    [CardinalDirection.EAST]: CardinalDirection.WEST,
    [CardinalDirection.SOUTH]: CardinalDirection.NORTH,
    [CardinalDirection.WEST]: CardinalDirection.EAST,
  };
  return new Direction(reverseMap[this.value]);
}
```

**Nuevo comando:** 'U' en `RotationCommand = 'L' | 'R' | 'U'`

---

### 4. Restricciones de Rotación (Terreno)

Si en futuro el Grid debe validar rotaciones (ej: "no rotar en pendiente"):

```typescript
// Grid.aggregate.ts
validateRotation(coordinates: Coordinates, newDirection: Direction): void {
  const terrain = this.getTerrainAt(coordinates);
  if (terrain.isSteep() && !terrain.allowsRotation()) {
    throw new RotationNotAllowedException(
      `Cannot rotate at (${coordinates.x},${coordinates.y}): steep terrain`
    );
  }
}

// Rover.entity.ts
rotate(command: RotationCommand, grid: Grid): void {
  const newDirection = command === 'L'
    ? this._position.direction.rotateLeft()
    : this._position.direction.rotateRight();

  grid.validateRotation(this._position.coordinates, newDirection); // ← nueva validación

  this._position = this._position.withDirection(newDirection);
}
```

**Nota:** Este cambio requeriría que `RotateRoverUseCase` también obtenga Grid, similar a `MoveRoverUseCase`.

---

### 5. Tracking de Orientaciones (Multi-Rover)

Si Grid necesita rastrear orientaciones de múltiples rovers (ej: evitar que dos rovers se topen al rotar):

```typescript
// Grid mantiene mapa de rovers con sus posiciones Y direcciones
private rovers: Map<string, Position> = new Map();

validateRotation(roverId: string, coordinates: Coordinates, newDirection: Direction): void {
  // Validar que al rotar, el rover no choque con otro rover
  // que esté justo al lado en la nueva dirección
}
```

**Complejidad:** Este escenario requiere que Grid conozca todos los rovers, lo que cambia significativamente la arquitectura. Probablemente necesitaríamos un `RoverFleet` aggregate.

---

### 6. Animaciones de Rotación (Frontend)

El endpoint actual retorna solo el estado final. Si el frontend necesita animar rotación:

**Opción A: Eventos de dominio**
```typescript
// Rover emite evento: RoverRotatedEvent
this.apply(new RoverRotatedEvent(this.id, oldDirection, newDirection));
```

**Opción B: Response enriquecido**
```json
{
  "roverId": "rover-1",
  "x": 5,
  "y": 5,
  "direction": "WEST",
  "previousDirection": "NORTH",  // ← para animación
  "rotationType": "LEFT"          // ← para animación
}
```

---

## 12. Diagramas de Flujo Detallados

### Flujo: Rotación Exitosa

```
┌───────────┐
│ Client    │
└─────┬─────┘
      │ POST /rovers/rover-1/rotate { command: "L" }
      ▼
┌─────────────────────────┐
│ RotateRoverController   │
└─────┬───────────────────┘
      │ execute(RotateRoverCommand("rover-1", "L"))
      ▼
┌───────────────────┐
│ RotateRoverUseCase│
└─────┬─────────────┘
      │ findById("rover-1")
      ▼
┌────────────────────┐
│ RoverRepository    │ → Returns: Rover(position: (5,5) NORTH)
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ Rover.rotate("L") │
└─────┬─────────────┘
      │ direction.rotateLeft()
      ▼
┌───────────────────┐
│ Direction.rotateLeft() │ → Returns: Direction(WEST)
└────────────────────┘
      │
      ▼
┌───────────────────┐
│ Position.withDirection(WEST) │ → Returns: Position((5,5) WEST)
└─────┬─────────────┘
      │ rover._position = newPosition
      ▼
┌────────────────────┐
│ RoverRepository.save(rover) │ → Persists: Rover(position: (5,5) WEST)
└────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Controller          │ → Returns: { roverId: "rover-1", x: 5, y: 5, direction: "WEST" }
└─────────────────────┘
      │
      ▼
┌───────────┐
│ Client    │ ← 200 OK
└───────────┘
```

**Observaciones:**
- **NO hay llamada a Grid** - flujo más simple que movimiento
- **NO hay validaciones** - flujo directo sin excepciones de dominio
- **Solo actualiza dirección** - coordenadas no cambian

---

### Flujo: Rover No Encontrado

```
┌───────────┐
│ Client    │
└─────┬─────┘
      │ POST /rovers/non-existent/rotate { command: "L" }
      ▼
┌─────────────────────────┐
│ RotateRoverController   │
└─────┬───────────────────┘
      │ execute(RotateRoverCommand("non-existent", "L"))
      ▼
┌───────────────────┐
│ RotateRoverUseCase│
└─────┬─────────────┘
      │ findById("non-existent")
      ▼
┌────────────────────┐
│ RoverRepository    │ → Returns: null
└────────────────────┘
      │
      ▼ THROW NotFoundException
      ┌────────────────────────────┐
      │ Exception propagates up    │
      └─────┬──────────────────────┘
            │
            ▼
┌───────────────────┐
│ RotateRoverUseCase│ → Exception propagates
└─────┬─────────────┘
      │
      ▼
┌─────────────────────────┐
│ RotateRoverController   │
└─────┬───────────────────┘
      │ catch (NotFoundException)
      ▼
┌─────────────────────┐
│ throw HttpException(404) │
└─────┬───────────────┘
      │
      ▼
┌───────────┐
│ Client    │ ← 404 Not Found { message: "Rover with id non-existent not found" }
└───────────┘
```

---

## 13. Checklist de Implementación

### Pre-implementación
- [ ] Leer y entender el plan completo
- [ ] Revisar código existente (movimiento feature)
- [ ] Configurar rama: `git checkout -b feature/rotate-rover`

### Iteración 1: Happy Path - Rotación Left
- [ ] Test: Direction.rotateLeft() (Norte)
- [ ] Implementar: Direction.rotateLeft() (Norte)
- [ ] Test: Direction.rotateLeft() (4 direcciones)
- [ ] Implementar: Direction.rotateLeft() completo con mapa
- [ ] Test: Position.withDirection()
- [ ] Implementar: Position.withDirection()
- [ ] Test: inmutabilidad Position
- [ ] Test: Rover.rotate('L') 4 direcciones
- [ ] Implementar: Rover.rotate() con tipo RotationCommand
- [ ] Test: coordenadas no cambian en rotación
- [ ] Test: RotateRoverUseCase exitoso left
- [ ] Implementar: RotateRoverCommand
- [ ] Implementar: RotateRoverUseCase
- [ ] Implementar: RotateRoverController
- [ ] Actualizar: RoverModule
- [ ] Test E2E: rotación left exitosa
- [ ] **Commit:** `feat: implement left rotation for rover`

### Iteración 2: Rotación Right
- [ ] Test: Direction.rotateRight() (4 direcciones)
- [ ] Implementar: Direction.rotateRight() con mapa
- [ ] Test: Rover.rotate('R') 4 direcciones
- [ ] Test: Use Case right
- [ ] Test E2E: rotación right exitosa
- [ ] **Commit:** `feat: implement right rotation for rover`

### Iteración 3: Rotaciones Múltiples y Edge Cases
- [ ] Test: 4 rotaciones left vuelven al original
- [ ] Test: 4 rotaciones right vuelven al original
- [ ] Test: simetría (left + right se cancelan)
- [ ] Test: Rover rotaciones múltiples
- [ ] Test: Rover coordenadas invariantes
- [ ] Test: Use Case rotaciones secuenciales
- [ ] Test E2E: ciclo completo
- [ ] Test E2E: coordenadas no cambian
- [ ] **Commit:** `test: add edge cases for rover rotation`

### Iteración 4: Manejo de Errores
- [ ] Test: Use Case rover inexistente
- [ ] Test E2E: 404 rover no existe
- [ ] Test E2E: 400 comando inválido
- [ ] Implementar: manejo de errores en Controller
- [ ] **Commit:** `feat: add error handling for rover rotation`

### Iteración 5: Integración
- [ ] Ejecutar: `npm run test` (todos los tests pasan)
- [ ] Ejecutar: `npm run test:e2e` (E2E pasa)
- [ ] Verificar: `npm run test:cov` (cobertura adecuada)
- [ ] Actualizar: README con endpoint de rotación
- [ ] Agregar: ejemplos de uso curl
- [ ] **Commit:** `docs: add rotation feature documentation`

### Post-implementación
- [ ] Code review (self o equipo)
- [ ] Merge a main
- [ ] Tag: `v0.3.0` (rotación implementada)

---

## 14. Comandos Útiles Durante Implementación

```bash
# Ejecutar tests específicos en watch mode
npm run test -- --watch direction.value-object.spec.ts

# Ejecutar tests de rotación
npm run test -- --testNamePattern="rotating"

# Ejecutar tests con cobertura de Direction
npm run test -- --coverage --collectCoverageFrom="src/domain/value-objects/direction.value-object.ts"

# Ejecutar E2E de rotación
npm run test:e2e -- rotate-rover.e2e-spec.ts

# Ejecutar solo tests de dominio
npm run test -- test/unit/domain

# Ver cobertura completa
npm run test:cov

# Levantar server en desarrollo
npm run start:dev

# Probar endpoint manualmente - Rotate Left
curl -X POST http://localhost:3000/rovers/rover-1/rotate \
  -H "Content-Type: application/json" \
  -d '{"command":"L"}'

# Probar endpoint manualmente - Rotate Right
curl -X POST http://localhost:3000/rovers/rover-1/rotate \
  -H "Content-Type: application/json" \
  -d '{"command":"R"}'

# Deploy + Rotate secuencia
curl -X POST http://localhost:3000/rovers/deploy \
  -H "Content-Type: application/json" \
  -d '{"roverId":"test","x":5,"y":5,"direction":"NORTH"}'

curl -X POST http://localhost:3000/rovers/test/rotate \
  -H "Content-Type: application/json" \
  -d '{"command":"L"}'
```

---

## 15. Métricas de Éxito

- **Cobertura de tests:** > 90% en dominio y aplicación (rotación es más simple que movimiento, debería llegar a ~95%)
- **Tests E2E:** Todos los escenarios de aceptación cubiertos (7 tests E2E)
- **Tiempo de ejecución tests:**
  - Unitarios: < 2 segundos (más rápido que movimiento, sin Grid)
  - E2E: < 8 segundos
- **Complejidad ciclomática:** < 5 en todos los métodos (rotación es simple)
- **Legibilidad:** Cualquier stakeholder puede leer test de rotación y entender que rover cambia dirección sin moverse

### Comparación con Movimiento

| Métrica | Movimiento | Rotación |
|---------|-----------|----------|
| Líneas de código (dominio) | ~80 | ~40 |
| Tests unitarios | ~30 | ~20 |
| Dependencias (Use Case) | RoverRepo + GridRepo | Solo RoverRepo |
| Validaciones | 2 (límites, obstáculos) | 0 |
| Excepciones de dominio | 2 (reutilizadas) | 0 (ninguna) |

**Conclusión:** Rotación es aproximadamente **50% más simple** que movimiento, demostrando que no todas las features tienen la misma complejidad.

---

## 16. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Rover inexistente al rotar | Media | Bajo | Test y manejo de NotFoundException |
| Comando inválido ('X') | Alta | Bajo | NestJS validation pipe automático |
| Confusión left/right (espejo) | Baja | Medio | Tests exhaustivos, nombrar según dominio (CCW/CW en docs) |
| Múltiples rotaciones secuenciales causan bug | Baja | Medio | Test de ciclo completo (4 rotaciones) |

**Riesgo NO presente (vs. movimiento):**
- Grid no configurado ✓ (no se usa)
- Obstáculos ✓ (no se validan)
- Límites ✓ (no se validan)
- Concurrencia ✓ (rotación es local al rover)

---

## 17. Notas Finales

### Principios Seguidos

1. **TDD Estricto:** Red → Green → Refactor en cada ciclo.

2. **YAGNI:** No implementamos rotaciones de 45°, U-turn, o validaciones de terreno hasta que sean requeridos.

3. **KISS (Keep It Simple):** Rotación es intrínsecamente simple. No la complicamos.

4. **DDD:** Direction es rico en comportamiento (rotateLeft, rotateRight, calculateNextCoordinates). No es un enum tonto.

5. **Immutability:** Todos los Value Objects son inmutables.

6. **Separation of Concerns:** Grid NO participa en rotación. Cada agregado tiene responsabilidades claras.

### Ventajas de Esta Arquitectura

**Reutilización máxima:**
- Repositorios: 100% reutilizados
- Excepciones: 0 nuevas
- Infraestructura: solo agregar Controller/UseCase

**Bajo acoplamiento:**
- Rotación NO depende de Grid
- Use Case más simple que movimiento

**Alta cohesión:**
- Toda la lógica de rotación está en Direction
- Rover solo orquesta

### Lecciones Aprendidas del Plan de Movimiento

1. **Symmetry Patterns:** `withCoordinates()` fue exitoso en movimiento, replicamos con `withDirection()`.

2. **Type Safety:** `MovementCommand` funcionó bien, aplicamos mismo patrón con `RotationCommand`.

3. **Use Case Simplicity:** Movimiento enseñó que Use Cases deben ser orchestration only. Rotación sigue este patrón.

4. **Test Naming:** Nombres en lenguaje de negocio funcionaron en movimiento, continuamos aquí.

### Preparación para Command Sequences

Esta implementación prepara perfectamente para la futura feature de secuencias:

```typescript
// Future: ExecuteCommandSequenceUseCase
async execute(command: CommandSequenceCommand) {
  for (const cmd of "FFRFLB".split('')) {
    if (cmd === 'F' || cmd === 'B') {
      rover.move(cmd, grid);      // ✓ ya implementado
    } else if (cmd === 'L' || cmd === 'R') {
      rover.rotate(cmd);          // ✓ implementado en este plan
    }
  }
}
```

**Ventaja:** Rotación y movimiento tienen interfaces consistentes (`rotate(cmd)` / `move(cmd, grid)`), fácil combinar.

---

**Fin del Plan Arquitectónico**

Este plan establece una feature **simple, elegante, y completa** que demuestra cómo la arquitectura hexagonal permite agregar funcionalidad con mínimo impacto. La rotación es un caso de uso perfecto para mostrar:
- Reutilización de infraestructura
- Separación de responsabilidades
- Diseño orientado a dominio rico
- Bajo acoplamiento entre agregados

Cada decisión está justificada arquitectónicamente y el plan está listo para implementación TDD rigurosa.

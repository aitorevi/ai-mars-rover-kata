# Plan Arquitectónico: User Story "Desplegar Rover"

## Resumen Ejecutivo

Esta funcionalidad representa el **vertical slice fundacional** del sistema Mars Rover. Establecerá los cimientos arquitectónicos (dominio, puertos, adaptadores, casos de uso) que todas las funcionalidades posteriores seguirán. El despliegue del rover es un **comando** (modifica estado) que valida reglas de negocio críticas: límites de cuadrícula y detección de obstáculos.

---

## 1. Análisis de Arquitectura

### Encaje en la Arquitectura Hexagonal

```
┌─────────────────────────────────────────────────────┐
│            INFRASTRUCTURE LAYER                      │
│  ┌──────────────────┐      ┌────────────────────┐  │
│  │  HTTP Adapter    │      │ In-Memory Adapter  │  │
│  │  (Controller)    │      │   (Repository)     │  │
│  └────────┬─────────┘      └─────────┬──────────┘  │
│           │                          │              │
│           │ ┌─────────────────────┐  │              │
│           └▶│  NestJS Module      │◀─┘              │
│             └──────────┬──────────┘                 │
└────────────────────────┼──────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────┐
│          APPLICATION LAYER                         │
│             ┌──────────▼──────────┐                │
│             │  DeployRoverUseCase │                │
│             │     (Command)       │                │
│             └──────────┬──────────┘                │
│                        │                            │
└────────────────────────┼────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────┐
│             DOMAIN LAYER (Core)                     │
│                        │                            │
│  ┌────────────────┐    │    ┌─────────────────┐   │
│  │  Grid (Agg)    │◀───┴───▶│  Rover (Entity) │   │
│  │                │          │                 │   │
│  │ - dimensions   │          │ - position      │   │
│  │ - obstacles    │          │ - direction     │   │
│  │ - deploy()     │          │                 │   │
│  └────────┬───────┘          └─────────────────┘   │
│           │                                         │
│  ┌────────▼───────────────────────────────────┐   │
│  │        Value Objects                       │   │
│  │  - Position (x, y)                         │   │
│  │  - Direction (North, East, South, West)    │   │
│  │  - Coordinates (x, y)                      │   │
│  │  - GridDimensions (width, height)          │   │
│  │  - Obstacle (position)                     │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │        Ports (Interfaces)                  │   │
│  │  - RoverRepository                         │   │
│  │  - GridRepository                          │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Principio Clave: El Agregado Grid es el Guardian

El **Grid** (cuadrícula) es un agregado que:
- Conoce sus dimensiones
- Mantiene la lista de obstáculos
- **Valida** si una posición es válida para despliegue
- **Factory method** `deployRover()` que crea el Rover solo si pasa todas las validaciones

Esto garantiza que NUNCA exista un Rover en una posición inválida (invariante de dominio).

---

## 2. Modelo de Dominio (DDD)

### 2.1 Value Objects (Conceptos sin identidad)

#### `/src/domain/value-objects/coordinates.value-object.ts`
```typescript
export class Coordinates {
  private constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  static create(x: number, y: number): Coordinates {
    return new Coordinates(x, y);
  }

  equals(other: Coordinates): boolean {
    return this.x === other.x && this.y === other.y;
  }
}
```

**Por qué:** Encapsula el concepto de coordenadas (x, y) como par indivisible. Inmutable. Reutilizable para posiciones y obstáculos.

---

#### `/src/domain/value-objects/direction.value-object.ts`
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
}
```

**Por qué:** Evita strings mágicos. Named constructors expresan el lenguaje del negocio. Las futuras rotaciones (L, R) se implementarán aquí.

---

#### `/src/domain/value-objects/position.value-object.ts`
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
}
```

**Por qué:** Combina coordenadas y dirección como concepto atómico. La posición del rover incluye AMBOS datos.

---

#### `/src/domain/value-objects/grid-dimensions.value-object.ts`
```typescript
export class GridDimensions {
  private constructor(
    public readonly width: number,
    public readonly height: number,
  ) {}

  static create(width: number, height: number): GridDimensions {
    if (width <= 0 || height <= 0) {
      throw new Error('Grid dimensions must be positive numbers');
    }
    return new GridDimensions(width, height);
  }

  contains(coordinates: Coordinates): boolean {
    return (
      coordinates.x >= 0 &&
      coordinates.x < this.width &&
      coordinates.y >= 0 &&
      coordinates.y < this.height
    );
  }
}
```

**Por qué:** Encapsula las dimensiones de la cuadrícula y la lógica de validación de límites. El método `contains()` es lenguaje del dominio.

---

#### `/src/domain/value-objects/obstacle.value-object.ts`
```typescript
import { Coordinates } from './coordinates.value-object';

export class Obstacle {
  private constructor(public readonly position: Coordinates) {}

  static at(coordinates: Coordinates): Obstacle {
    return new Obstacle(coordinates);
  }

  blocksPosition(coordinates: Coordinates): boolean {
    return this.position.equals(coordinates);
  }
}
```

**Por qué:** Un obstáculo es más que coordenadas: tiene semántica de "bloquear" una posición. Preparado para futura expansión (tipo de obstáculo, tamaño, etc.).

---

### 2.2 Entidad: Rover

#### `/src/domain/entities/rover.entity.ts`
```typescript
import { Position } from '../value-objects/position.value-object';

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
}
```

**Por qué:** El Rover tiene identidad (id). Su posición es mutable (futuro: se moverá con comandos). Constructor privado: solo se crea via factory method controlado por el agregado.

---

### 2.3 Agregado: Grid

#### `/src/domain/aggregates/grid.aggregate.ts`
```typescript
import { Rover } from '../entities/rover.entity';
import { Coordinates } from '../value-objects/coordinates.value-object';
import { Direction } from '../value-objects/direction.value-object';
import { GridDimensions } from '../value-objects/grid-dimensions.value-object';
import { Obstacle } from '../value-objects/obstacle.value-object';
import { Position } from '../value-objects/position.value-object';
import { OutOfBoundsException } from '../exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../exceptions/obstacle-detected.exception';

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

**Por qué:** El Grid es el **boundary transaccional**. Es responsable de garantizar que todo despliegue respete las reglas de negocio. Las excepciones son del dominio (explicitas, comunicativas).

---

### 2.4 Excepciones de Dominio

#### `/src/domain/exceptions/out-of-bounds.exception.ts`
```typescript
export class OutOfBoundsException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutOfBoundsException';
  }
}
```

#### `/src/domain/exceptions/obstacle-detected.exception.ts`
```typescript
export class ObstacleDetectedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObstacleDetectedException';
  }
}
```

**Por qué:** Excepciones con nombre del dominio, no genéricas. Comunican problemas de negocio claramente.

---

## 3. Puertos (Interfaces del Dominio)

### 3.1 Repository Ports

#### `/src/domain/port/rover.repository.port.ts`
```typescript
import { Rover } from '../entities/rover.entity';

export interface RoverRepository {
  save(rover: Rover): Promise<void>;
  findById(id: string): Promise<Rover | null>;
}
```

#### `/src/domain/port/grid.repository.port.ts`
```typescript
import { Grid } from '../aggregates/grid.aggregate';

export interface GridRepository {
  getGrid(): Promise<Grid>;
}
```

**Por qué:** El dominio define QUÉ necesita, no CÓMO se implementa. Los adaptadores (infraestructura) implementarán estos puertos.

---

## 4. Capa de Aplicación (Casos de Uso)

### 4.1 Command DTO

#### `/src/application/commands/deploy-rover.command.ts`
```typescript
export class DeployRoverCommand {
  constructor(
    public readonly roverId: string,
    public readonly x: number,
    public readonly y: number,
    public readonly direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
  ) {}
}
```

**Por qué:** DTO simple que transporta datos desde la infraestructura a la aplicación. Strings primitivos (fácil desde HTTP/JSON).

---

### 4.2 Use Case

#### `/src/application/usecases/deploy-rover.use-case.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { DeployRoverCommand } from '../commands/deploy-rover.command';
import { RoverRepository } from '../../domain/port/rover.repository.port';
import { GridRepository } from '../../domain/port/grid.repository.port';
import { Coordinates } from '../../domain/value-objects/coordinates.value-object';
import { Direction, CardinalDirection } from '../../domain/value-objects/direction.value-object';

@Injectable()
export class DeployRoverUseCase {
  constructor(
    private readonly roverRepository: RoverRepository,
    private readonly gridRepository: GridRepository,
  ) {}

  async execute(command: DeployRoverCommand): Promise<void> {
    const grid = await this.gridRepository.getGrid();

    const coordinates = Coordinates.create(command.x, command.y);
    const direction = this.parseDirection(command.direction);

    const rover = grid.deployRover(command.roverId, coordinates, direction);

    await this.roverRepository.save(rover);
  }

  private parseDirection(direction: string): Direction {
    const directionMap = {
      NORTH: Direction.north(),
      EAST: Direction.east(),
      SOUTH: Direction.south(),
      WEST: Direction.west(),
    };
    return directionMap[direction as CardinalDirection];
  }
}
```

**Por qué:** El caso de uso orquesta pero NO contiene lógica de negocio. Transforma DTOs primitivos en Value Objects ricos y delega al dominio (Grid) la validación y creación.

---

## 5. Adaptadores (Infraestructura)

### 5.1 Repository Adapters (In-Memory)

#### `/src/infrastructure/persistence/in-memory-rover.repository.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { RoverRepository } from '../../domain/port/rover.repository.port';
import { Rover } from '../../domain/entities/rover.entity';

@Injectable()
export class InMemoryRoverRepository implements RoverRepository {
  private rovers: Map<string, Rover> = new Map();

  async save(rover: Rover): Promise<void> {
    this.rovers.set(rover.getId(), rover);
  }

  async findById(id: string): Promise<Rover | null> {
    return this.rovers.get(id) || null;
  }
}
```

#### `/src/infrastructure/persistence/in-memory-grid.repository.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { GridRepository } from '../../domain/port/grid.repository.port';
import { Grid } from '../../domain/aggregates/grid.aggregate';
import { GridDimensions } from '../../domain/value-objects/grid-dimensions.value-object';
import { Obstacle } from '../../domain/value-objects/obstacle.value-object';
import { Coordinates } from '../../domain/value-objects/coordinates.value-object';

@Injectable()
export class InMemoryGridRepository implements GridRepository {
  private grid: Grid;

  constructor() {
    // Grid por defecto: 10x10 sin obstáculos (configurable luego)
    const dimensions = GridDimensions.create(10, 10);
    this.grid = Grid.create(dimensions, []);
  }

  async getGrid(): Promise<Grid> {
    return this.grid;
  }

  // Método auxiliar para tests: configurar grid
  setGrid(dimensions: GridDimensions, obstacles: Obstacle[] = []): void {
    this.grid = Grid.create(dimensions, obstacles);
  }
}
```

**Por qué:** Implementaciones en memoria para desarrollo rápido y tests. Cumplen los contratos definidos por el dominio.

---

### 5.2 HTTP Adapter (Controller)

#### `/src/infrastructure/http/deploy-rover.controller.ts`
```typescript
import { Body, Controller, Post, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { DeployRoverUseCase } from '../../application/usecases/deploy-rover.use-case';
import { DeployRoverCommand } from '../../application/commands/deploy-rover.command';
import { OutOfBoundsException } from '../../domain/exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../../domain/exceptions/obstacle-detected.exception';

class DeployRoverRequestDto {
  roverId: string;
  x: number;
  y: number;
  direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
}

@Controller('rovers')
export class DeployRoverController {
  constructor(private readonly deployRoverUseCase: DeployRoverUseCase) {}

  @Post('deploy')
  @HttpCode(201)
  async deployRover(@Body() dto: DeployRoverRequestDto): Promise<{ message: string }> {
    try {
      const command = new DeployRoverCommand(
        dto.roverId,
        dto.x,
        dto.y,
        dto.direction,
      );

      await this.deployRoverUseCase.execute(command);

      return {
        message: `Rover ${dto.roverId} deployed at (${dto.x},${dto.y}) facing ${dto.direction}`,
      };
    } catch (error) {
      if (error instanceof OutOfBoundsException) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      if (error instanceof ObstacleDetectedException) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      throw error;
    }
  }
}
```

**Por qué:** El controlador traduce excepciones de dominio a códigos HTTP semánticos (400 para bad request, 409 para conflicto). Es un **traductor** entre protocolos.

---

### 5.3 NestJS Module

#### `/src/infrastructure/config/rover.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { DeployRoverController } from '../http/deploy-rover.controller';
import { DeployRoverUseCase } from '../../application/usecases/deploy-rover.use-case';
import { InMemoryRoverRepository } from '../persistence/in-memory-rover.repository';
import { InMemoryGridRepository } from '../persistence/in-memory-grid.repository';

@Module({
  controllers: [DeployRoverController],
  providers: [
    DeployRoverUseCase,
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

#### Actualizar `/src/app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { RoverModule } from './infrastructure/config/rover.module';

@Module({
  imports: [RoverModule],
})
export class AppModule {}
```

**Por qué:** Inyección de dependencias. Los casos de uso dependen de interfaces (puertos), NestJS inyecta las implementaciones concretas (adaptadores).

---

## 6. Estrategia de Testing (TDD/BDD)

### Orden de Tests (Outside-In TDD)

Los nombres de tests usan **lenguaje de dominio**: "should deploy rover at valid position" NO "should return new Rover instance when coordinates within bounds".

#### Fase 1: Tests de Dominio (Unit Tests)

**Test 1: Grid rechaza coordenadas fuera de límites**
`/test/unit/domain/aggregates/grid.aggregate.spec.ts`

```typescript
describe('Grid Aggregate', () => {
  describe('deploying rover', () => {
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
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(5, 20);

      expect(() => {
        grid.deployRover('rover-1', invalidCoordinates, Direction.north());
      }).toThrow(OutOfBoundsException);
    });

    it('should reject deployment when coordinates are negative', () => {
      const dimensions = GridDimensions.create(10, 10);
      const grid = Grid.create(dimensions, []);
      const invalidCoordinates = Coordinates.create(-1, 5);

      expect(() => {
        grid.deployRover('rover-1', invalidCoordinates, Direction.north());
      }).toThrow(OutOfBoundsException);
    });
  });
});
```

**Test 2: Grid detecta obstáculos**
```typescript
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
```

**Test 3: Grid permite despliegue exitoso**
```typescript
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
```

---

#### Fase 2: Tests de Aplicación (Use Case Tests)

**Test 4: Use Case orquesta despliegue exitoso**
`/test/unit/application/usecases/deploy-rover.use-case.spec.ts`

```typescript
describe('DeployRoverUseCase', () => {
  let useCase: DeployRoverUseCase;
  let roverRepository: RoverRepository;
  let gridRepository: GridRepository;

  beforeEach(() => {
    roverRepository = new InMemoryRoverRepository();
    gridRepository = new InMemoryGridRepository();
    useCase = new DeployRoverUseCase(roverRepository, gridRepository);
  });

  it('should deploy rover and persist it', async () => {
    // Arrange: comando de despliegue en (3,5) Norte
    const command = new DeployRoverCommand('rover-1', 3, 5, 'NORTH');

    // Act: ejecutar caso de uso
    await useCase.execute(command);

    // Assert: rover guardado en repositorio
    const savedRover = await roverRepository.findById('rover-1');
    expect(savedRover).toBeDefined();
    expect(savedRover!.position.coordinates.x).toBe(3);
    expect(savedRover!.position.coordinates.y).toBe(5);
    expect(savedRover!.position.direction.value).toBe(CardinalDirection.NORTH);
  });

  it('should reject deployment outside grid boundaries', async () => {
    const command = new DeployRoverCommand('rover-1', 15, 5, 'NORTH');

    await expect(useCase.execute(command)).rejects.toThrow(OutOfBoundsException);
  });
});
```

---

#### Fase 3: Tests E2E (API Tests)

**Test 5: API responde correctamente**
`/test/e2e/deploy-rover.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Deploy Rover (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /rovers/deploy - should deploy rover successfully', () => {
    return request(app.getHttpServer())
      .post('/rovers/deploy')
      .send({
        roverId: 'rover-1',
        x: 3,
        y: 5,
        direction: 'NORTH',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.message).toContain('Rover rover-1 deployed');
      });
  });

  it('POST /rovers/deploy - should return 400 when coordinates out of bounds', () => {
    return request(app.getHttpServer())
      .post('/rovers/deploy')
      .send({
        roverId: 'rover-1',
        x: 15,
        y: 5,
        direction: 'NORTH',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('out of grid bounds');
      });
  });
});
```

---

## 7. Orden de Implementación (Vertical Slicing)

### Iteración 1: Camino Feliz (Despliegue Exitoso)

1. **Value Objects básicos**
   - `Coordinates.value-object.ts`
   - `Direction.value-object.ts`
   - `Position.value-object.ts`
   - `GridDimensions.value-object.ts`

2. **Entidad Rover (mínima)**
   - `Rover.entity.ts`

3. **Agregado Grid (solo camino feliz)**
   - `Grid.aggregate.ts` - método `deployRover()` sin validaciones

4. **Test: Despliegue exitoso en Grid**
   - `/test/unit/domain/aggregates/grid.aggregate.spec.ts`
   - Verificar que rover se crea con posición correcta

5. **Puertos**
   - `RoverRepository.port.ts`
   - `GridRepository.port.ts`

6. **Adaptadores (In-Memory)**
   - `InMemoryRoverRepository.ts`
   - `InMemoryGridRepository.ts`

7. **Use Case**
   - `DeployRoverCommand.ts`
   - `DeployRoverUseCase.ts`
   - Test: `/test/unit/application/usecases/deploy-rover.use-case.spec.ts`

8. **HTTP Controller**
   - `DeployRoverController.ts`

9. **NestJS Module & Wiring**
   - `RoverModule.ts`
   - Actualizar `AppModule.ts`

10. **Test E2E: Camino Feliz**
    - `/test/e2e/deploy-rover.e2e-spec.ts`
    - Solo el caso de despliegue exitoso

**Checkpoint:** Sistema funcional end-to-end con camino feliz.
**Commit:** `feat: deploy rover at valid position`

---

### Iteración 2: Validación de Límites (Out of Bounds)

11. **Excepción de Dominio**
    - `OutOfBoundsException.ts`

12. **Test: Grid valida límites**
    - Agregar tests en `grid.aggregate.spec.ts`
    - X fuera de límites
    - Y fuera de límites
    - Coordenadas negativas

13. **Implementar validación en Grid**
    - Método privado `validateDeploymentPosition()`
    - Usar `GridDimensions.contains()`

14. **Test Use Case: propagación de excepción**
    - Verificar que `OutOfBoundsException` se propaga

15. **Controller: Mapeo a HTTP 400**
    - Catch `OutOfBoundsException` → `HttpException(400)`

16. **Test E2E: Límites**
    - Casos de test para coordenadas inválidas

**Checkpoint:** Validación de límites completa.
**Commit:** `feat: validate grid boundaries on rover deployment`

---

### Iteración 3: Detección de Obstáculos

17. **Value Object Obstacle**
    - `Obstacle.value-object.ts`

18. **Test: Grid detecta obstáculos**
    - Agregar test en `grid.aggregate.spec.ts`

19. **Excepción de Dominio**
    - `ObstacleDetectedException.ts`

20. **Implementar detección en Grid**
    - Método privado `hasObstacleAt()`
    - Agregar validación en `validateDeploymentPosition()`

21. **InMemoryGridRepository: configurar obstáculos**
    - Método auxiliar `setGrid()` para tests

22. **Test Use Case: obstáculos**
    - Configurar grid con obstáculo y verificar excepción

23. **Controller: Mapeo a HTTP 409**
    - Catch `ObstacleDetectedException` → `HttpException(409)`

24. **Test E2E: Obstáculos**
    - Caso de test para despliegue sobre obstáculo

**Checkpoint:** Detección de obstáculos completa.
**Commit:** `feat: detect obstacles on rover deployment`

---

### Iteración 4: Casos Edge y Refinamiento

25. **Test: Despliegue en límite de cuadrícula**
    - Verificar que (9,9) en grid 10x10 es válido

26. **Test: Despliegue en origen (0,0)**
    - Caso edge

27. **Refinamiento de mensajes de error**
    - Mejorar claridad de excepciones

**Checkpoint:** Todos los escenarios de aceptación cubiertos.
**Commit:** `test: add edge cases for rover deployment`

---

## 8. Estructura Final de Archivos

```
src/
├── domain/
│   ├── aggregates/
│   │   └── grid.aggregate.ts
│   ├── entities/
│   │   └── rover.entity.ts
│   ├── exceptions/
│   │   ├── obstacle-detected.exception.ts
│   │   └── out-of-bounds.exception.ts
│   ├── port/
│   │   ├── grid.repository.port.ts
│   │   └── rover.repository.port.ts
│   └── value-objects/
│       ├── coordinates.value-object.ts
│       ├── direction.value-object.ts
│       ├── grid-dimensions.value-object.ts
│       ├── obstacle.value-object.ts
│       └── position.value-object.ts
├── application/
│   ├── commands/
│   │   └── deploy-rover.command.ts
│   └── usecases/
│       └── deploy-rover.use-case.ts
├── infrastructure/
│   ├── config/
│   │   └── rover.module.ts
│   ├── http/
│   │   └── deploy-rover.controller.ts
│   └── persistence/
│       ├── in-memory-grid.repository.ts
│       └── in-memory-rover.repository.ts
├── app.module.ts
└── main.ts

test/
├── unit/
│   ├── domain/
│   │   └── aggregates/
│   │       └── grid.aggregate.spec.ts
│   └── application/
│       └── usecases/
│           └── deploy-rover.use-case.spec.ts
└── e2e/
    └── deploy-rover.e2e-spec.ts
```

---

## 9. Criterios de Aceptación vs Tests

| Escenario | Test(s) Correspondiente(s) |
|-----------|---------------------------|
| 1. Despliegue exitoso | `grid.aggregate.spec.ts`: "should deploy rover at valid position"<br>`deploy-rover.e2e-spec.ts`: "should deploy rover successfully" |
| 2. Despliegue en origen | `grid.aggregate.spec.ts`: "should deploy rover at origin (0,0)" |
| 3. Fuera de límites (X) | `grid.aggregate.spec.ts`: "should reject deployment when X exceeds width"<br>`deploy-rover.e2e-spec.ts`: "should return 400 when X out of bounds" |
| 4. Fuera de límites (Y) | `grid.aggregate.spec.ts`: "should reject deployment when Y exceeds height" |
| 5. Coordenadas negativas | `grid.aggregate.spec.ts`: "should reject deployment when coordinates negative" |
| 6. Despliegue sobre obstáculo | `grid.aggregate.spec.ts`: "should reject deployment when obstacle blocks position"<br>`deploy-rover.e2e-spec.ts`: "should return 409 when obstacle detected" |
| 7. Despliegue en límite | `grid.aggregate.spec.ts`: "should deploy rover at grid boundary (9,9)" |

---

## 10. Decisiones Arquitectónicas Clave

### Por qué Grid es un Agregado y no un Servicio de Dominio?

El Grid tiene identidad conceptual (es "LA cuadrícula marciana"), mantiene estado (obstáculos), y actúa como boundary transaccional para el despliegue. Si fuera un servicio, necesitaríamos otro agregado para mantener los obstáculos. Al ser agregado, el Grid es el guardian de sus invariantes.

### Por qué el Rover NO valida su propia posición?

Dependency Rule. Si el Rover validara límites, necesitaría conocer el Grid. Eso crea dependencia dominio→dominio y acopla el Rover a un contexto (Grid). El Grid es el "lugar", el Rover es el "ocupante". El lugar valida quién puede entrar.

### Por qué usar In-Memory Repository y no directamente un Map en el Use Case?

Ports & Adapters. El Use Case depende de la abstracción (puerto), no de la implementación. Mañana podríamos cambiar a PostgreSQL sin tocar el Use Case. Además, facilita testing: podemos crear mocks del puerto sin modificar el dominio.

### Por qué separar Coordinates y Position?

Single Responsibility. `Coordinates` es un concepto reutilizable (obstáculos, límites). `Position` combina coordenadas + dirección, específico para objetos orientados en el espacio (rover). Composición > herencia.

---

## 11. Próximos Pasos (Futuras User Stories)

Con esta arquitectura, las siguientes funcionalidades seguirán el mismo patrón:

1. **"Mover Rover":** Agregar método `move()` a Rover, comando en Grid para validar movimiento, nuevo Use Case `MoveRoverUseCase`.

2. **"Rotar Rover":** Agregar métodos `rotateLeft()` / `rotateRight()` a Direction, caso de uso `RotateRoverUseCase`.

3. **"Consultar Posición":** Query (no comando), nuevo puerto `RoverQuery`, Use Case `GetRoverPositionUseCase`.

4. **"Configurar Grid":** Endpoint HTTP para definir dimensiones y obstáculos, comandos CRUD para Grid.
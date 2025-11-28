# Mars Rover Backend

## Descripción del Proyecto

Backend para la kata Mars Rover implementado con arquitectura hexagonal (ports & adapters) y Domain-Driven Design.

## Stack Tecnológico

- **Runtime:** Node.js
- **Lenguaje:** TypeScript 5.7.3 (strict mode)
- **Framework:** NestJS 11
- **Testing:** Jest 30

## Arquitectura

Seguimos arquitectura hexagonal con DDD y CQS. La estructura de carpetas refleja esta separación:
```
src/
├── domain/              # Núcleo del negocio, sin dependencias externas
│   ├── aggregates/      # Agregados de dominio
│   ├── dtos/            # DTOs de dominio
│   ├── entities/        # Entidades de dominio
│   ├── service/         # Servicios de dominio
│   ├── port/            # Interfaces (puertos) que define el dominio
│   └── value-objects/   # Value Objects de dominio
├── application/         # Casos de uso / servicios de aplicación
│   ├── commands/        # Comandos de aplicación
│   ├── queries/         # Consultas de aplicación
│   ├── usecases/        # Casos de uso
│   └── value-objects/   # Value Objects de dominio
├── infrastructure/      # Adaptadores (implementaciones de puertos)
│   ├── persistence/     # Repositorios concretos
│   ├── http/            # Controladores REST
│   └── config/          # Configuración de NestJS, módulos
└── main.ts
```

## Principios de Diseño

- **Dependency Rule:** Las dependencias apuntan hacia el dominio. El dominio no conoce la infraestructura.
- **Puertos y Adaptadores:** El dominio define interfaces (puertos). La infraestructura las implementa (adaptadores).
- **Value Objects:** Usar Value Objects para conceptos como `Position`, `Direction`, `Coordinates`.
- **Entidades:** El `Rover` es la entidad principal con identidad.
- **Inmutabilidad:** Preferir objetos inmutables en el dominio.

## Convenciones de Código

- Nombrar archivos en kebab-case: `mars-rover.entity.ts`, `move-rover.use-case.ts`
- Sufijos descriptivos: `.entity.ts`, `.value-object.ts`, `.port.ts`, `.adapter.ts`, `.use-case.ts`
- Una clase/interface por archivo
- Imports absolutos usando path aliases (`@domain/`, `@application/`, `@infrastructure/`)

## Testing

Practicamos TDD. Estructura de tests:
```
test/
├── unit/             # Tests unitarios del dominio y aplicación
├── integration/      # Tests de adaptadores con dependencias reales
└── e2e/              # Tests end-to-end de la API
```

Convenciones:
- Archivos de test junto al código o en carpeta `test/` espejando la estructura
- Nombrar tests: `*.spec.ts` para unitarios, `*.e2e-spec.ts` para e2e
- Usar el patrón AAA (Arrange, Act, Assert)
- Mocks solo en boundaries, no mockear el dominio

## Comandos Útiles
```bash
npm run test          # Ejecutar tests unitarios
npm run test:watch    # Tests en modo watch
npm run test:cov      # Tests con cobertura
npm run test:e2e      # Tests end-to-end
npm run start:dev     # Levantar en modo desarrollo
npm run lint          # Linter
npm run format        # Formatear código
```

## Dominio Mars Rover

El rover opera en una cuadrícula y responde a comandos:
- **Movimientos:** Forward (F), Backward (B)
- **Rotaciones:** Left (L), Right (R)
- **Direcciones:** North, East, South, West

El rover debe:
1. Conocer su posición (x, y) y orientación
2. Ejecutar secuencias de comandos
3. Detectar obstáculos y detenerse antes de colisionar
4. Reportar su posición final

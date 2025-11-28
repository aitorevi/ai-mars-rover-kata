import { DeployRoverUseCase } from '../../../../src/application/usecases/deploy-rover.use-case';
import { DeployRoverCommand } from '../../../../src/application/commands/deploy-rover.command';
import { InMemoryRoverRepository } from '../../../../src/infrastructure/persistence/in-memory-rover.repository';
import { InMemoryGridRepository } from '../../../../src/infrastructure/persistence/in-memory-grid.repository';
import { CardinalDirection } from '../../../../src/domain/value-objects/direction.value-object';
import { OutOfBoundsException } from '../../../../src/domain/exceptions/out-of-bounds.exception';

describe('DeployRoverUseCase', () => {
  let useCase: DeployRoverUseCase;
  let roverRepository: InMemoryRoverRepository;
  let gridRepository: InMemoryGridRepository;

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
    // Arrange
    const command = new DeployRoverCommand('rover-1', 15, 5, 'NORTH');

    // Act & Assert
    await expect(useCase.execute(command)).rejects.toThrow(OutOfBoundsException);
  });
});

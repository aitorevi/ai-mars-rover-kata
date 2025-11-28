import { Module } from '@nestjs/common';
import { DeployRoverController } from '../http/deploy-rover.controller';
import { MoveRoverController } from '../http/move-rover.controller';
import { DeployRoverUseCase } from '../../application/usecases/deploy-rover.use-case';
import { MoveRoverUseCase } from '../../application/usecases/move-rover.use-case';
import { InMemoryRoverRepository } from '../persistence/in-memory-rover.repository';
import { InMemoryGridRepository } from '../persistence/in-memory-grid.repository';

@Module({
  controllers: [
    DeployRoverController,
    MoveRoverController,
  ],
  providers: [
    DeployRoverUseCase,
    MoveRoverUseCase,
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

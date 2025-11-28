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

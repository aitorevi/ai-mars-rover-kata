import { Module } from '@nestjs/common';
import { RoverModule } from './infrastructure/config/rover.module';

@Module({
  imports: [RoverModule],
})
export class AppModule {}

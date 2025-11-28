import {
  Body,
  Controller,
  Param,
  Post,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { RotateRoverUseCase } from '../../application/usecases/rotate-rover.use-case';
import { RotateRoverCommand } from '../../application/commands/rotate-rover.command';
import { RoverRepository } from '../../domain/port/rover.repository.port';

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
  constructor(
    private readonly rotateRoverUseCase: RotateRoverUseCase,
    @Inject('RoverRepository')
    private readonly roverRepository: RoverRepository,
  ) {}

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
      const rover = await this.roverRepository.findById(roverId);

      return {
        roverId: rover!.getId(),
        x: rover!.position.coordinates.x,
        y: rover!.position.coordinates.y,
        direction: rover!.position.direction.value,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }
}

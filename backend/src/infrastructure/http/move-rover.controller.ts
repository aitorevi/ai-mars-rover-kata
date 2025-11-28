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
import { MoveRoverUseCase } from '../../application/usecases/move-rover.use-case';
import { MoveRoverCommand } from '../../application/commands/move-rover.command';
import { OutOfBoundsException } from '../../domain/exceptions/out-of-bounds.exception';
import { ObstacleDetectedException } from '../../domain/exceptions/obstacle-detected.exception';
import { RoverRepository } from '../../domain/port/rover.repository.port';

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
  constructor(
    private readonly moveRoverUseCase: MoveRoverUseCase,
    @Inject('RoverRepository')
    private readonly roverRepository: RoverRepository,
  ) {}

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
}

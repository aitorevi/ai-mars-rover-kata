import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { DeployRoverUseCase } from '../../application/usecases/deploy-rover.use-case';
import { DeployRoverCommand } from '../../application/commands/deploy-rover.command';

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
  }
}

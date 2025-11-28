import { RotationCommand } from '../../domain/entities/rover.entity';

export class RotateRoverCommand {
  constructor(
    public readonly roverId: string,
    public readonly command: RotationCommand,
  ) {}
}

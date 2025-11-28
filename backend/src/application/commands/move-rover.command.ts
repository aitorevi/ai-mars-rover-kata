import { MovementCommand } from '../../domain/entities/rover.entity';

export class MoveRoverCommand {
  constructor(
    public readonly roverId: string,
    public readonly command: MovementCommand, // 'F' | 'B'
  ) {}
}

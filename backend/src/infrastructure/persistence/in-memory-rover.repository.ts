import { Injectable } from '@nestjs/common';
import { RoverRepository } from '../../domain/port/rover.repository.port';
import { Rover } from '../../domain/entities/rover.entity';

@Injectable()
export class InMemoryRoverRepository implements RoverRepository {
  private rovers: Map<string, Rover> = new Map();

  async save(rover: Rover): Promise<void> {
    this.rovers.set(rover.getId(), rover);
  }

  async findById(id: string): Promise<Rover | null> {
    return this.rovers.get(id) || null;
  }
}

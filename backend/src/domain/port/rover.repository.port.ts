import { Rover } from '../entities/rover.entity';

export interface RoverRepository {
  save(rover: Rover): Promise<void>;
  findById(id: string): Promise<Rover | null>;
}

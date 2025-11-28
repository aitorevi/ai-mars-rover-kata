import { Injectable } from '@nestjs/common';
import { GridRepository } from '../../domain/port/grid.repository.port';
import { Grid } from '../../domain/aggregates/grid.aggregate';
import { GridDimensions } from '../../domain/value-objects/grid-dimensions.value-object';
import { Obstacle } from '../../domain/value-objects/obstacle.value-object';

@Injectable()
export class InMemoryGridRepository implements GridRepository {
  private grid: Grid;

  constructor() {
    // Grid por defecto: 10x10 sin obstáculos (configurable luego)
    const dimensions = GridDimensions.create(10, 10);
    this.grid = Grid.create(dimensions, []);
  }

  async getGrid(): Promise<Grid> {
    return this.grid;
  }

  // Método auxiliar para tests: configurar grid
  setGrid(dimensions: GridDimensions, obstacles: Obstacle[] = []): void {
    this.grid = Grid.create(dimensions, obstacles);
  }
}

import { Grid } from '../aggregates/grid.aggregate';

export interface GridRepository {
  getGrid(): Promise<Grid>;
}

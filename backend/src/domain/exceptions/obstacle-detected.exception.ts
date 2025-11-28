export class ObstacleDetectedException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObstacleDetectedException';
  }
}

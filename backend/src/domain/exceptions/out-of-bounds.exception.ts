export class OutOfBoundsException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutOfBoundsException';
  }
}

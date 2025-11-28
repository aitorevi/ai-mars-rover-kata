export class DeployRoverCommand {
  constructor(
    public readonly roverId: string,
    public readonly x: number,
    public readonly y: number,
    public readonly direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST',
  ) {}
}

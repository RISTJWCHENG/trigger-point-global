export class TradeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TradeError";
    this.status = status;
  }
}

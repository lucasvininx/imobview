export class DomainError extends Error {
  constructor(
    public code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

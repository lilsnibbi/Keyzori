export class DomainError extends Error {
	constructor(
		message: string,
		public statusCode: number = 400,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}
export class NotFoundError extends DomainError {
	constructor(resource: string) {
		super(`${resource} not found`, 404);
	}
}

export class InvariantError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "InvariantError";
	}
}

export function invariant(
	truthy: unknown,
	message: string,
	options?: ErrorOptions,
): asserts truthy {
	if (truthy) {
		return;
	}

	throw new Error(message, options);
}

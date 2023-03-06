/**
 * An error which may have a cause (but not necessarily).
 */
export class CausedError extends Error {
    cause: unknown;
    constructor(message: string, cause: unknown = undefined) {
        super(message);
        this.cause = cause;
    }
}

export function isCausedError(err: unknown): err is CausedError {
    // Note: instanceof does not work here in GAS
    return typeof (err as CausedError)?.cause !== "undefined";
}

/**
 * An error that has a message which can be shown to the chat user as is.
 */
export class ChatError extends CausedError {
    chatError = true;
    cause: unknown;
    constructor(message: string, name = "ChatError", cause: unknown = undefined) {
        super(message);
        this.cause = cause;
        this.name = name;
    }
}

export function isChatError(err: unknown): err is ChatError {
    // Note: instanceof does not work here in GAS
    return (err as ChatError)?.chatError === true;
}

/**
 * Logs the specified error.
 */
export function logError(err: unknown): void {
    console.error(toErrorMessage(err));
}

function toErrorMessage(err: unknown): string {
    const error = err as Error;
    const errorMessage = error?.stack ?? error?.message ?? "" + err;
    if (isCausedError(err) && err.cause) {
        return errorMessage + "\nCaused by " + toErrorMessage(err.cause);
    } else {
        return errorMessage;
    }
}

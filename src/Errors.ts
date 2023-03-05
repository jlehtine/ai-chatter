/**
 * An error that has a message which can be returned to the chat.
 */
export class ChatError extends Error {
    chatError = true;
    constructor(message: string, name = "ChatError") {
        super(message);
        this.name = name;
    }
}

export function isChatError(err: unknown): err is ChatError {
    return (err as ChatError)?.chatError === true;
}

/**
 * Logs the specified error.
 */
export function logError(err: unknown): void {
    const error = err as Error;
    console.error(error?.stack ?? error?.message ?? err);
}

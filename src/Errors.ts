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

/**
 * Checks and returns whether the specified erorr is a ChatError.
 */
export function isChatError(err: any): boolean {
    // TODO Why instanceof does not work with exceptions in GAS (using any for now)
    return typeof err === "object" && err.chatError === true;
}

/**
 * Logs the specified error.
 */
export function logError(err: any): void {
    // TODO Why instanceof does not work with exceptions in GAS (using any for now)
    console.error(err.stack || err.message || err);
}

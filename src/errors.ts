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

export function isChatError(err: any): boolean {
  return typeof err === "object" && err.chatError === true;
}

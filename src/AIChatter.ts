import { isChatError } from "./Errors";
import { checkProperties } from "./Properties";
import * as GoogleChat from "./GoogleChat";

/**
 * Responds to a received message.
 */
function onMessage(event: GoogleChat.OnMessageEvent): GoogleChat.BotResponse {
  try {
    // Check script properties
    checkProperties();

    // Store history

    const message = "Hello, " + event.user.displayName + "!";

    return responseMessage(message);
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Responds to being added into a space or chat.
 */
function onAddToSpace(event: GoogleChat.OnSpaceEvent): GoogleChat.BotResponse {
  try {
    // Check script properties
    checkProperties();
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Responds to being removed from a space or chat.
 */
function onRemoveFromSpace(event: GoogleChat.OnSpaceEvent): void {
  // TODO Purge history
}

/**
 * Returns a chat response with the specified text.
 */
function responseMessage(text: string): GoogleChat.ResponseMessage {
  return { text: text };
}

/**
 * Handles an error and returns a suitable chat response value.
 */
function errorResponse(err: any): GoogleChat.BotResponse {
  console.error(err.stack || err.message || err);
  if (isChatError(err)) {
    return responseMessage("ERROR: " + err.message);
  }
}

// Export required globals
declare global {
  function onMessage(event: GoogleChat.OnMessageEvent): GoogleChat.BotResponse;
  function onAddToSpace(event: GoogleChat.OnSpaceEvent): GoogleChat.BotResponse;
  function onRemoveFromSpace(event: GoogleChat.OnSpaceEvent): void;
}
globalThis.onMessage = onMessage;
globalThis.onAddToSpace = onAddToSpace;
globalThis.onRemoveFromSpace = onRemoveFromSpace;

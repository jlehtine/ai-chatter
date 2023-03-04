import { ChatError, isChatError, logError } from "./Errors";
import { checkProperties } from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { getHistory } from "./History";

/**
 * Responds to a received message.
 */
function onMessage(event: GoogleChat.OnMessageEvent): GoogleChat.BotResponse {
  try {
    // Check script properties
    checkProperties();

    // Store history
    const history = getHistory(event.message);
    console.log("history = " + JSON.stringify(history, null, 2));

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
function errorResponse(err: unknown): GoogleChat.BotResponse {
  logError(err);
  if (isChatError(err)) {
    const chatErr = err as ChatError;
    return responseMessage("ERROR: " + chatErr.message);
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

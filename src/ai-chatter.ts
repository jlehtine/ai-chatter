import { isChatError } from "./errors";
import { checkProperties } from "./properties";

/**
 * Responds to a received message.
 */
function onMessage(event: object): object | void {
  try {
    // Check script properties
    checkProperties();

    const message = "Hello, World!";

    return { text: message };
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Responds to being added into a space or chat.
 */
function onAddToSpace(event: object): object | void {
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
function onRemoveFromSpace(event: object): void {
  // TODO Purge history
}

/**
 * Handles an error and returns a suitable chat response value.
 */
function errorResponse(err: any): object | void {
  console.error(err.stack || err.message || err);
  if (isChatError(err)) {
    return {
      text: "ERROR: " + err.message,
    };
  }
}

// Export required globals
declare global {
  function onMessage(event: object): object | void;
  function onAddToSpace(event: object): object | void;
  function onRemoveFromSpace(event: object): void;
}
globalThis.onMessage = onMessage;
globalThis.onAddToSpace = onAddToSpace;
globalThis.onRemoveFromSpace = onRemoveFromSpace;

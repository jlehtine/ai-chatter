import * as props from "./properties";

/**
 * Responds to a received message.
 *
 * @param event event object
 */
function onMessage(event: object): object {
  console.info("onMessage with event:\n" + JSON.stringify(event, null, 2));

  const message = "Found " + Object.keys(props.getProperties()).length + " properties";

  return { text: message };
}

/**
 * Responds to being added into a space or chat.
 *
 * @param {Object} event event object
 */
/*
function onAddToSpace(event) {
}
*/

/**
 * Responds to being removed from a space or chat.
 *
 * @param {Object} event event object
 */
/*
function onRemoveFromSpace(event) {
}
*/

// Export required globals
declare global {
  function onMessage(event: object): object;
}
globalThis.onMessage = onMessage;

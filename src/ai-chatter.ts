import { getProperties } from "./properties";

/**
 * Responds to a received message.
 *
 * @param event event object
 */
function onMessage(event: GoogleAppsScript.Addons.EventObject): object {
  console.info("onMessage with event:\n" + JSON.stringify(event, null, 2));

  const message =
    "Found " + Object.keys(getProperties()).length + " properties";

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

/**
 * Responds to a received message.
 *
 * @param {Object} event event object
 */
function onMessage(event) {
  console.info("onMessage with event:\n" + JSON.stringify(event, null, 2));

  var message = "Found " + Object.keys(getProperties()).length + " properties";

  return { "text": message };
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


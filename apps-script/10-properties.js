/**
 * Returns the cached script properties.
 * 
 * @return {ScriptProperties} cached script properties
 */
const getScriptProperties = (() => {
  var scriptProperties;
  return () => {
    if (!scriptProperties) {
      scriptProperties = PropertiesService.getScriptProperties();
    }
    return scriptProperties;
  };
})();

/**
 * Returns cached (script) properties values.
 * 
 * @return {Object} cached (script) properties values
 */
const getProperties = (() => {
  var properties;
  return () => {
    if (!properties) {
      properties = getScriptProperties().getProperties();
    }
    return properties;
  };
})();

/**
 * Returns a string valued property.
 * 
 * @param {String} property property name
 * @return property value as a string, or undefined if not set
 */
function getStringProperty(property) {
  return getProperties()[property];
}

/**
 * Returns a JSON valued property.
 * 
 * @param {String} property property name
 * @return property value as JSON value, or undefined if not set
 */
function getJSONProperty(property) {
  const str = getStringProperty(property);
  return typeof str !== 'undefined' ? JSON.parse(str) : undefined;
}

/**
 * Sets a JSON valued property.
 * 
 * @param {String} property property name
 * @param {any} property value
 */
function setJSONProperty(property, value) {
  var jsonValue;
  if (typeof value !== 'undefined') {
    jsonValue = JSON.stringify(value);
  } else {
    getScriptProperties().setProperty(property, jsonValue);
  }
}

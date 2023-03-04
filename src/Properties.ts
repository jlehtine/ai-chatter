import { ChatError } from "./Errors";

/** Cached script properties */
let scriptProperties: GoogleAppsScript.Properties.Properties;

/** Cached properties */
let properties: { [key: string]: string };

/** Property keys */
enum PropertyKey {
  OPENAI_API_KEY = "OPENAI_API_KEY",
}

/**
 * Returns the cached script properties.
 *
 * @return cached script properties
 */
function getScriptProperties(): GoogleAppsScript.Properties.Properties {
  if (!scriptProperties) {
    scriptProperties = PropertiesService.getScriptProperties();
  }
  return scriptProperties;
}

/**
 * Returns cached (script) properties values.
 */
export function getProperties(): { [key: string]: string } {
  if (!properties) {
    properties = getScriptProperties().getProperties();
  }
  return properties;
}

/**
 * Returns a string valued property.
 *
 * @param property property name
 * @return property value as a string, or undefined if not set
 */
export function getStringProperty(property: string) {
  return getProperties()[property];
}

/**
 * Sets a string valued property.
 *
 * @param property property name
 * @param value property value
 */
export function setStringProperty(property: string, value: string) {
  getScriptProperties().setProperty(property, value);
  getProperties()[property] = value;
}

/**
 * Returns an object valued property.
 *
 * @param property property name
 * @return property value as an object, or undefined if not set
 */
export function getObjectProperty(property: string): object | undefined {
  const str = getStringProperty(property);
  return typeof str !== "undefined" ? JSON.parse(str) : undefined;
}

/**
 * Sets an object valued property.
 *
 * @param property property name
 * @param value property value
 */
export function setObjectProperty(property: string, value: object) {
  setStringProperty(property, JSON.stringify(value));
}

/**
 * Delete the specified property.
 *
 * @param property property name
 */
export function deleteProperty(property: string) {
  getScriptProperties().deleteProperty(property);
  delete getProperties()[property];
}

/**
 * Signals an error in script configuration.
 */
export class ScriptConfigurationError extends ChatError {
  constructor(message: string) {
    super(message, "ScriptConfigurationError");
  }
}

/**
 * Checks properties and throws an exception if there is a configuration issue.
 */
export function checkProperties(): void {
  if (typeof getStringProperty(PropertyKey.OPENAI_API_KEY) !== "string") {
    const errorMessage = "Mandatory script property missing: " + PropertyKey.OPENAI_API_KEY;
    throw new ScriptConfigurationError(errorMessage);
  }
}

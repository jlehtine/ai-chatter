import { ChatError } from "./Errors";

const PROPERTY_SAFE_LENGTH = 9000;

/** Property keys */
export enum PropertyKey {
  OPENAI_API_KEY = "OPENAI_API_KEY",
  HISTORY_MINUTES = "HISTORY_MINUTES",
}

/** Cached script properties */
let scriptProperties: GoogleAppsScript.Properties.Properties;

/** Cached properties */
let properties: { [key: string]: string };

/** Default properties */
const defaultProperties: { [key: string]: string } = {
  [PropertyKey.HISTORY_MINUTES]: "60",
};

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
export function getStringProperty(property: string): string | undefined {
  const str = getProperties()[property];
  if (typeof str === "string") {
    return str;
  } else {
    return defaultProperties[property];
  }
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
 * Returns a numeric property.
 *
 * @param property property name
 * @return property value as a number, or undefined if not set
 */
export function getNumberProperty(property: string): number | undefined {
  const str = getStringProperty(property);
  if (typeof str === "string") {
    return Number(str);
  } else {
    return undefined;
  }
}

/**
 * Returns an object valued property.
 *
 * @param property property name
 * @return property value as an object, or undefined if not set
 */
export function getObjectProperty(property: string): object | undefined {
  const str = getStringProperty(property);
  if (typeof str === "string") {
    return JSON.parse(str);
  } else {
    return undefined;
  }
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

import { ChatError } from "./Errors";

/** Cached script properties */
let scriptProperties: GoogleAppsScript.Properties.Properties;

/** Cached properties */
let properties: { [key: string]: string };

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
 * Returns a boolean property.
 */
export function getBooleanProperty(property: string): boolean | undefined {
    const str = getStringProperty(property);
    if (str === "true") {
        return true;
    } else if (str === "false") {
        return false;
    } else {
        return undefined;
    }
}

/**
 * Returns a JSON valued property.
 *
 * @param property property name
 * @return property value parsed from JSON, or undefined if not set
 */
export function getJSONProperty(property: string): unknown {
    const str = getStringProperty(property);
    if (str !== undefined) {
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
export function setJSONProperty(property: string, value: unknown) {
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

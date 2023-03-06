import { getStringProperty } from "./Properties";

/** Property name for the OpenAI API key (to be kept secret) */
export const PROP_OPENAI_API_KEY = "OPENAI_API_KEY";

class OpenAIConfigurationError extends Error {}

/**
 * Returns the OpenAI API key.
 * Throws an error if it has not been configured.
 */
export function getOpenAIAPIKey(): string {
    const apiKey = getStringProperty(PROP_OPENAI_API_KEY);
    if (apiKey) {
        return apiKey;
    } else {
        throw new OpenAIConfigurationError("Missing mandatory script property: " + PROP_OPENAI_API_KEY);
    }
}

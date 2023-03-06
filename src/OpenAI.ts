import { getStringProperty } from "./Properties";

export const PROP_OPENAI_API_KEY = "OPENAI_API_KEY";

class OpenAIConfigurationError extends Error {}

export function getOpenAIAPIKey(): string {
    const apiKey = getStringProperty(PROP_OPENAI_API_KEY);
    if (apiKey) {
        return apiKey;
    } else {
        throw new OpenAIConfigurationError("Missing mandatory script property: " + PROP_OPENAI_API_KEY);
    }
}

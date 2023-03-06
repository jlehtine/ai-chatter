import { CausedError, ChatError } from "./Errors";
import { getOpenAIAPIKey } from "./OpenAIAPI";
import { getBooleanProperty, getStringProperty } from "./Properties";

/** Moderation API request */
interface ModerationRequest {
    input: string;
    model?: string;
}

/** Moderation API response */
interface ModerationResponse {
    results: ModerationResult[];
}

/** Moderation result */
interface ModerationResult {
    flagged: boolean;
}

function isModerationResponse(obj: unknown): obj is ModerationResponse {
    const resp = obj as ModerationResponse;
    return (
        Array.isArray(resp?.results) &&
        resp.results.length > 0 &&
        resp.results.every((r) => {
            return r?.flagged === true || r?.flagged === false;
        })
    );
}

/** Signals an error on getting the moderation result */
class ModerationError extends CausedError {}

/** Signals that the specified input was flagged by moderation */
class ModerationFlaggedError extends ChatError {
    constructor(message: string) {
        super(message, "ModerationFlaggedError");
    }
}

/**
 * Checks moderation for the specified input string.
 * Throws an error if the input is flagged by moderation.
 * This can be used to check both API inputs and outputs.
 */
export function checkModeration(input: string): void {
    const url = getModerationUrl();
    const apiKey = getOpenAIAPIKey();
    const request: ModerationRequest = { input: input };
    const method: GoogleAppsScript.URL_Fetch.HttpMethod = "post";
    const params = {
        method: method,
        headers: {
            Authorization: "Bearer " + apiKey,
        },
        contentType: "application/json",
        payload: JSON.stringify(request),
    };
    if (getLogModeration()) {
        console.log("Moderation request:\n" + JSON.stringify(request));
    }

    // Make moderation request and parse response
    let response: ModerationResponse;
    try {
        const httpResponse = UrlFetchApp.fetch(url, params);
        response = toModerationResponse(httpResponse);
        if (getLogModeration()) {
            console.log("Moderation response:\n" + JSON.stringify(response, null, 2));
        }
    } catch (err) {
        throw new ModerationError("Error while doing moderation", err);
    }

    // Check moderation result
    if (!response.results.every((result) => result.flagged === false)) {
        throw new ModerationFlaggedError("Content was flagged by moderation");
    }
}

function getModerationUrl(): string {
    return getStringProperty("MODERATION_URL") ?? "https://api.openai.com/v1/moderations";
}

/**
 * Returns whether moderation requests and responses should be logged.
 */
function getLogModeration(): boolean {
    return getBooleanProperty("LOG_MODERATION") ?? false;
}

function toModerationResponse(httpResponse: GoogleAppsScript.URL_Fetch.HTTPResponse): ModerationResponse {
    if (!isOkResponse(httpResponse)) {
        throw new ModerationError(
            "Received an error response from the moderation API",
            "HTTP response code " + httpResponse.getResponseCode()
        );
    }
    const responseText = httpResponse.getContentText();
    try {
        const data = JSON.parse(responseText);
        if (isModerationResponse(data)) {
            return data;
        } else {
            throw new ModerationError("Response is not a moderation result");
        }
    } catch (err) {
        console.log("Moderation response was:\n" + responseText);
        throw err;
    }
}

function isOkResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): boolean {
    const code = response.getResponseCode();
    return code >= 200 && code < 300;
}

import { ChatError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getOpenAIAPIKey } from "./OpenAIAPI";
import { getBooleanProperty, getStringProperty } from "./Properties";

/** Image generation API request */
interface ImageGenerationRequest {
    prompt: string;
    n?: number;
    size?: ImageSize;
    response_format?: "url" | "b64_json";
    user?: string;
}

/** Allowed image sizes */
type ImageSize = "256x256" | "512x512" | "1024x1024";

/** Image generation API response */
interface ImageGenerationResponse {
    created: number;
    data: ImageGenerationResult[];
}

/** Image generation result for a single image */
interface ImageGenerationResult {
    url: string;
}

function isImageGenerationResponse(obj: unknown): obj is ImageGenerationResponse {
    const resp = obj as ImageGenerationResponse;
    return Array.isArray(resp?.data) && resp.data.every((d) => d.url);
}

class ImageGenerationError extends ChatError {
    constructor(message: string, cause: unknown = undefined) {
        super(message, "ImageGenerationError", cause);
    }
}

/**
 * Requests image generation for the specified prompt and the number of images.
 * Returns the resulting images as a chat response.
 */
export function requestImageGeneration(prompt: string, user: string, n = 1): GoogleChat.ResponseMessage {
    // Prepare image generation request
    if (n !== Math.round(n) || n < 1 || n > 10) {
        throw new ImageGenerationError("Option n must be an integer from 1 to 10");
    }
    const url = getImageGenerationUrl();
    const apiKey = getOpenAIAPIKey();
    const request = createImageGenerationRequest(prompt, user, n);
    const method: GoogleAppsScript.URL_Fetch.HttpMethod = "post";
    const params = {
        method: method,
        headers: {
            Authorization: "Bearer " + apiKey,
        },
        contentType: "application/json",
        payload: JSON.stringify(request),
    };
    if (getLogImage()) {
        console.log("Image generation request:\n" + JSON.stringify(request, null, 2));
    }

    // Make image generation request and parse response
    let response: ImageGenerationResponse;
    try {
        const httpResponse = UrlFetchApp.fetch(url, params);
        response = toImageGenerationResponse(httpResponse);
        if (getLogImage()) {
            console.log("Image generation response:\n" + JSON.stringify(response, null, 2));
        }
    } catch (err) {
        throw new ImageGenerationError("Error while doing image generation", err);
    }

    // Format results
    const chatResponse = GoogleChat.decoratedTextResponse("images", "Generated images", '"' + prompt + '"');
    const cardsV2 = chatResponse.cardsV2;
    const sections = cardsV2 ? cardsV2[0].card.sections : undefined;
    const widgets = sections ? sections[0].widgets : undefined;
    if (widgets) {
        response.data.forEach((img) => {
            widgets.push({
                image: {
                    imageUrl: img.url,
                },
            });
        });
    }
    return chatResponse;
}

function getImageGenerationUrl(): string {
    return getStringProperty("IMAGE_GENERATION_URL") ?? "https://api.openai.com/v1/images/generations";
}

function createImageGenerationRequest(prompt: string, user: string, n: number): ImageGenerationRequest {
    return {
        prompt: prompt,
        n: n,
        size: "512x512",
        user: user,
    };
}

/**
 * Returns whether image generation requests and responses should be logged.
 */
function getLogImage(): boolean {
    return getBooleanProperty("LOG_IMAGE") ?? false;
}

/**
 * Parses the specified HTTP response into an image generation response.
 * Throws an error if the response does not indicate success.
 */
function toImageGenerationResponse(httpResponse: GoogleAppsScript.URL_Fetch.HTTPResponse): ImageGenerationResponse {
    if (!isOkResponse(httpResponse)) {
        throw new ImageGenerationError(
            "Received an error response from the image generation API",
            "HTTP response code " + httpResponse.getResponseCode()
        );
    }
    const responseText = httpResponse.getContentText();
    try {
        const data = JSON.parse(responseText);
        if (isImageGenerationResponse(data)) {
            return data;
        } else {
            throw new Error("Response is not an image generation result");
        }
    } catch (err) {
        console.log("Image generation response was:\n" + responseText);
        throw err;
    }
}

function isOkResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): boolean {
    const code = response.getResponseCode();
    return code >= 200 && code < 300;
}

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

/** Allowed image sizes as data */
export const supportedImageSizes: ImageSize[] = ["256x256", "512x512", "1024x1024"];

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
export function requestImageGeneration(
    prompt: string,
    user: string,
    n = 1,
    imageSize?: ImageSize
): GoogleChat.ResponseMessage {
    // Prepare image generation request
    if (n !== Math.round(n) || n < 1 || n > 10) {
        throw new ImageGenerationError("Option n must be an integer from 1 to 10");
    }
    if (imageSize === undefined) {
        if (n > 4) {
            imageSize = "256x256";
        } else if (n > 1) {
            imageSize = "512x512";
        } else {
            imageSize = "1024x1024";
        }
    }
    const response = requestNativeImageGeneration(prompt, user, n, imageSize);

    // Format results
    const chatResponse = GoogleChat.decoratedTextResponse("images", "Generated images", '"' + prompt + '"');
    const widgets = chatResponse?.cardsV2?.[0]?.card?.sections?.[0]?.widgets;
    if (widgets) {
        response.data.forEach((img) => {
            widgets.push({
                image: {
                    imageUrl: img.url,
                },
            });
        });
        if (response.data.length > 0) {
            widgets.push({
                buttonList: {
                    buttons: response.data.map((img, index) => ({
                        text:
                            response.data.length == 1
                                ? "High quality image (valid for one hour)"
                                : "Image " + (index + 1),
                        onClick: {
                            openLink: {
                                url: img.url,
                            },
                        },
                    })),
                },
            });
        }
    }
    return chatResponse;
}

/**
 * Requests image generation and returns the native response.
 */
export function requestNativeImageGeneration(
    prompt: string,
    user?: string,
    n = 1,
    imageSize?: ImageSize
): ImageGenerationResponse {
    const url = getImageGenerationUrl();
    const apiKey = getOpenAIAPIKey();
    const request = createImageGenerationRequest(prompt, user, n, imageSize);
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
    return response;
}

function getImageGenerationUrl(): string {
    return getStringProperty("IMAGE_GENERATION_URL") ?? "https://api.openai.com/v1/images/generations";
}

function createImageGenerationRequest(
    prompt: string,
    user?: string,
    n?: number,
    imageSize?: ImageSize
): ImageGenerationRequest {
    return {
        prompt: prompt,
        n: n,
        size: imageSize,
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

import { ChatError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getOpenAIAPIKey } from "./OpenAI";
import { getBooleanProperty, getStringProperty } from "./Properties";

interface ImageGenerationRequest {
    prompt: string;
    n?: number;
    size?: ImageSize;
    response_format?: "url" | "b64_json";
    user?: string;
}

type ImageSize = "256x256" | "512x512" | "1024x1024";

interface ImageGenerationResponse {
    created: number;
    data: ImageGenerationResult[];
}

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

export function requestImageGeneration(prompt: string, user: string, n = 1): GoogleChat.ResponseMessage {
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

    // Format response
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

function getLogImage(): boolean {
    return getBooleanProperty("LOG_IMAGE") ?? false;
}

function toImageGenerationResponse(httpResponse: GoogleAppsScript.URL_Fetch.HTTPResponse): ImageGenerationResponse {
    if (!isOkResponse(httpResponse)) {
        throw new ImageGenerationError(
            "Received an error response from ChatGPT",
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
    return response.getResponseCode() === 200;
}

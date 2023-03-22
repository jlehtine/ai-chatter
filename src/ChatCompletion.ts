import { ChatError } from "./Errors";
import { ChatHistoryMessage } from "./History";
import { getBooleanProperty, getNumberProperty, getJSONProperty, getStringProperty } from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { getOpenAIAPIKey } from "./OpenAIAPI";
import { checkModeration } from "./Moderation";
import { millisNow } from "./Timestamp";

// Chat completion API interface

/** Chat completion request */
interface ChatCompletionRequest {
    model: string;
    messages: ChatCompletionMessage[];
    user?: string;
}

/** Chat completion response */
interface ChatCompletionResponse {
    object: "chat.completion";
    created: number;
    choices: ChatCompletionChoice[];
    usage: ChatCompletionTokenUsage;
}

/** Chat message */
export interface ChatCompletionMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/** Chat completion choice (a single result) */
interface ChatCompletionChoice {
    index: number;
    message: ChatCompletionMessage;
    finish_reason: string;
}

/** Chat completion token usage */
interface ChatCompletionTokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

/** Chat completion initialization sequence */
export type ChatCompletionInitialization = ChatCompletionMessage[];

function isChatCompletionResponse(obj: unknown): obj is ChatCompletionResponse {
    return (obj as ChatCompletionResponse)?.object === "chat.completion";
}

/** Signals a configuration error */
class ChatCompletionConfigurationError extends Error {}

/** Signals a chat completion error */
class ChatCompletionError extends ChatError {
    constructor(message: string, cause: unknown = undefined) {
        super(message, "ChatCompletionError", cause);
    }
}

/** User name used for the assistant in chat history */
export const USER_ASSISTANT = "__assistant__";

/** Property key for the initialization sequence of a chat */
export const PROP_CHAT_COMPLETION_INIT = "CHAT_COMPLETION_INIT";

/** Default initialization sequence for a chat */
const DEFAULT_CHAT_INIT: ChatCompletionInitialization = [];

/**
 * Requests a simple completion for the specified prompt.
 *
 * @param prompt prompt for completion
 * @param user user identification
 * @param skipInit whether to skip the chat initialization sequence (default is false)
 */
export function requestSimpleCompletion(prompt: string, user?: string, skipInit = false): GoogleChat.ResponseMessage {
    return requestChatCompletion([{ time: millisNow(), user: "User", text: prompt }], user, skipInit);
}

/**
 * Requests and returns a chat completion for the specified chat message history.
 * Updates the specified message sequence with the chat completion response.
 * The caller is responsible for persisting the history.
 *
 * @param messages chat messages to complement
 * @param user user identification
 * @param skipInit whether to skip the chat initialization sequence (default is false)
 */
export function requestChatCompletion(
    messages: ChatHistoryMessage[],
    user?: string,
    skipInit = false
): GoogleChat.ResponseMessage {
    // Make native chat completion request
    const response = requestNativeChatCompletion(messages, user, skipInit);
    const responseText = getChatCompletionText(response);

    // Moderate output
    checkModeration(responseText);

    // Format completion result
    const showTokens = getShowTokens();
    const chatResponse = GoogleChat.textResponse(responseText);
    if (showTokens) {
        let tokenUsage =
            "Prompt tokens: " +
            response.usage.prompt_tokens +
            "\nCompletion tokens: " +
            response.usage.completion_tokens +
            "\nTotal tokens: " +
            response.usage.total_tokens;
        const tokenPrice = getChatCompletionTokenPrice();
        if (typeof tokenPrice === "number") {
            tokenUsage += "\nTotal cost: $" + tokenPrice * response.usage.total_tokens;
        }
        GoogleChat.addDecoratedTextCard(chatResponse, "tokens", "Token usage", tokenUsage);
    }
    return chatResponse;
}

function requestNativeChatCompletion(
    messages: ChatHistoryMessage[],
    user?: string,
    skipInit = false
): ChatCompletionResponse {
    // Prepare chat completion request
    const url = getChatCompletionURL();
    const apiKey = getOpenAIAPIKey();
    const request = createChatCompletionRequest(messages, user, skipInit);
    const method: GoogleAppsScript.URL_Fetch.HttpMethod = "post";
    const params = {
        method: method,
        headers: {
            Authorization: "Bearer " + apiKey,
        },
        contentType: "application/json",
        payload: JSON.stringify(request),
    };
    if (getLogChatCompletion()) {
        console.log("Chat completion request:\n" + JSON.stringify(request, null, 2));
    }

    // Make chat completion request and parse response
    let response: ChatCompletionResponse;
    let responseMessage: ChatHistoryMessage;
    try {
        const httpResponse = UrlFetchApp.fetch(url, params);
        response = toChatCompletionResponse(httpResponse);
        if (getLogChatCompletion()) {
            console.log("Chat completion response:\n" + JSON.stringify(response, null, 2));
        }
        try {
            if ((response.choices?.length ?? 0) < 1 || typeof response.choices[0].message?.content !== "string") {
                throw new Error("No completion content available");
            }
            responseMessage = {
                time: millisNow(),
                user: USER_ASSISTANT,
                text: response.choices[0].message.content.trim(),
            };
            messages.push(responseMessage);
        } catch (err) {
            console.log("Chat completion response was:\n" + JSON.stringify(response, null, 2));
            throw err;
        }
        return response;
    } catch (err) {
        throw new ChatCompletionError("Error while performing chat completion", err);
    }
}

/**
 * Returns the actual chat completion response text given a full response object.
 *
 * @param response response object
 * @returns chat completion response text
 */
function getChatCompletionText(response: ChatCompletionResponse): string {
    return response.choices[0].message.content.trim();
}

/**
 * Creates a chat completion request from the specified chat history.
 */
function createChatCompletionRequest(
    messages: ChatHistoryMessage[],
    user: string | undefined,
    skipInit: boolean
): ChatCompletionRequest {
    return {
        model: getChatCompletionModel(),
        messages: toChatCompletionMessages(messages, skipInit),
        user: user,
    };
}

function getChatCompletionURL(): string {
    return getStringProperty("CHAT_COMPLETION_URL") ?? "https://api.openai.com/v1/chat/completions";
}

/** Returns whether chat completion requests and responses should be logged */
function getLogChatCompletion(): boolean {
    return getBooleanProperty("LOG_CHAT_COMPLETION") ?? false;
}

/** Returns the chat completion model to be used */
function getChatCompletionModel(): string {
    return getStringProperty("CHAT_COMPLETION_MODEL") ?? "gpt-3.5-turbo";
}

/**
 * Returns the initialization sequence for a chat.
 */
function getChatCompletionInit(): ChatCompletionMessage[] {
    const init = getJSONProperty(PROP_CHAT_COMPLETION_INIT) ?? DEFAULT_CHAT_INIT;
    if (!isValidInit(init)) {
        throw new ChatCompletionConfigurationError("Invalid initialization sequence: " + PROP_CHAT_COMPLETION_INIT);
    }
    return init;
}

/**
 * Returns whether the specified object represents a valid chat initialization sequence.
 */
function isValidInit(obj: unknown): obj is ChatCompletionMessage[] {
    if (!Array.isArray(obj)) {
        return false;
    }
    return obj.every((member) => {
        const msg = member as ChatCompletionMessage;
        return (
            (msg?.role === "system" || msg?.role === "user" || msg?.role === "assistant") &&
            typeof msg?.content === "string"
        );
    });
}

/**
 * Converts a chat history into an array of chat messages suitable for a completion request.
 */
function toChatCompletionMessages(messages: ChatHistoryMessage[], skipInit: boolean): ChatCompletionMessage[] {
    return (skipInit ? [] : getChatCompletionInit()).concat(messages.map((m) => toChatCompletionMessage(m)));
}

/**
 * Converts an individual chat history message into a chat message suitable for a completion request.
 */
function toChatCompletionMessage(message: ChatHistoryMessage): ChatCompletionMessage {
    return {
        role: message.user === USER_ASSISTANT ? "assistant" : "user",
        content: message.text,
    };
}

/**
 * Parses the specified HTTP response into a chat completion response.
 * Throws an error if the response does not indicate success.
 */
function toChatCompletionResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): ChatCompletionResponse {
    if (!isOkResponse(response)) {
        throw new ChatCompletionError(
            "Received an error response from the chat completion API",
            "HTTP response code " + response.getResponseCode()
        );
    }
    const responseData = response.getContentText();
    try {
        const data = JSON.parse(responseData);
        if (isChatCompletionResponse(data)) {
            return data;
        } else {
            throw new Error("Response is not a chat completion object");
        }
    } catch (err) {
        console.log("Chat completion response was:\n" + responseData);
        throw err;
    }
}

function isOkResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): boolean {
    const code = response.getResponseCode();
    return code >= 200 && code < 300;
}

/**
 * Returns whether to show token usage to the user as part of the response.
 */
function getShowTokens(): boolean {
    return getBooleanProperty("CHAT_COMPLETION_SHOW_TOKENS") ?? false;
}

/**
 * Returns the chat completion per-token price in dollars, if configured.
 */
function getChatCompletionTokenPrice(): number | void {
    return getNumberProperty("CHAT_COMPLETION_TOKEN_PRICE");
}

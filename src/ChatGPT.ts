import { ChatError } from "./Errors";
import { ChatHistory, ChatHistoryMessage } from "./History";
import { getBooleanProperty, getNumberProperty, getObjectProperty, getStringProperty } from "./Properties";
import * as GoogleChat from "./GoogleChat";

interface ChatGPTCompletionRequest {
    model: string;
    messages: ChatGPTMessage[];
}

interface ChatGPTMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface ChatGPTCompletionResponse {
    object: "chat.completion";
    created: number;
    choices: ChatGPTCompletionChoice[];
    usage: ChatGPTUsage;
}

function isChatGPTCompletionResponse(obj: unknown): obj is ChatGPTCompletionResponse {
    return (obj as ChatGPTCompletionResponse)?.object === "chat.completion";
}

interface ChatGPTCompletionChoice {
    index: number;
    message: ChatGPTMessage;
    finish_reason: string;
}

interface ChatGPTUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

class ChatGPTConfigurationError extends Error {}

class ChatGPTCompletionError extends ChatError {
    constructor(message: string, cause: unknown = undefined) {
        super(message, "ChatGPTCompletionError", cause);
    }
}

export const USER_ASSISTANT = "__ChatGPT__";

export const PROP_OPENAI_API_KEY = "OPENAI_API_KEY";
const PROP_CHATGPT_INIT = "CHATGPT_INIT";

const DEFAULT_CHATGPT_INIT: ChatGPTMessage[] = [];

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "November",
    "December",
];

/**
 * Requests and returns a ChatGPT completion for the specified chat history.
 * Returns null if ChatGPT remains silent.
 * Updates the specified history with the ChatGPT response.
 * The caller is responsible for persisting the history.
 */
export function requestChatGPTCompletion(history: ChatHistory): GoogleChat.BotResponse {
    const url = getChatCompletionsURL();
    const apiKey = getOpenAIAPIKey();
    const request = createChatGPTCompletionRequest(history);
    const method: GoogleAppsScript.URL_Fetch.HttpMethod = "post";
    const params = {
        method: method,
        headers: {
            Authorization: "Bearer " + apiKey,
        },
        contentType: "application/json",
        payload: JSON.stringify(request),
    };
    if (getLogChatGPT()) {
        console.log("ChatGPT request:\n" + JSON.stringify(request, null, 2));
    }
    let response: ChatGPTCompletionResponse;
    let responseMessage: ChatHistoryMessage;
    try {
        const httpResponse = UrlFetchApp.fetch(url, params);
        response = toChatGPTCompletionResponse(httpResponse);
        if (getLogChatGPT()) {
            console.log("ChatGPT response:\n" + JSON.stringify(response, null, 2));
        }
        try {
            if ((response.choices?.length ?? 0) < 1 || typeof response.choices[0].message?.content !== "string") {
                throw new Error("No completion content available");
            }
            responseMessage = {
                time: response.created * 1000,
                user: USER_ASSISTANT,
                text: response.choices[0].message.content.trim(),
            };
            history.messages.push(responseMessage);
        } catch (err) {
            console.log("ChatGPT completion response was:\n" + JSON.stringify(response, null, 2));
            throw err;
        }
    } catch (err) {
        throw new ChatGPTCompletionError("Error while performing a ChatGPT completion", err);
    }

    // Format response
    const showTokens = getShowTokens();
    if (responseMessage.text || showTokens) {
        const chatResponse = GoogleChat.textResponse(responseMessage.text);
        if (showTokens) {
            let tokenUsage =
                "Prompt tokens: " +
                response.usage.prompt_tokens +
                "\nCompletion tokens: " +
                response.usage.completion_tokens +
                "\nTotal tokens: " +
                response.usage.total_tokens;
            const tokenPrice = getTokenPrice();
            if (typeof tokenPrice === "number") {
                tokenUsage += "\nTotal cost: $" + tokenPrice * response.usage.total_tokens;
            }
            GoogleChat.addDecoratedTextCard(chatResponse, "tokens", "Token usage", tokenUsage);
        }
        return chatResponse;
    } else {
        return undefined;
    }
}

function createChatGPTCompletionRequest(history: ChatHistory): ChatGPTCompletionRequest {
    return {
        model: getModel(),
        messages: getInit().concat(toChatGPTMessages(history.messages)),
    };
}

function getChatCompletionsURL(): string {
    return getStringProperty("CHATGPT_COMPLETIONS_URL") ?? "https://api.openai.com/v1/chat/completions";
}

function getOpenAIAPIKey(): string {
    const apiKey = getStringProperty(PROP_OPENAI_API_KEY);
    if (apiKey) {
        return apiKey;
    } else {
        throw new ChatGPTConfigurationError("Missing mandatory script property: " + PROP_OPENAI_API_KEY);
    }
}

function getLogChatGPT(): boolean {
    return getBooleanProperty("LOG_CHATGPT") ?? false;
}

function getModel(): string {
    return getStringProperty("CHATGPT_MODEL") ?? "gpt-3.5-turbo";
}

function getInit(): ChatGPTMessage[] {
    const init = getObjectProperty(PROP_CHATGPT_INIT) ?? DEFAULT_CHATGPT_INIT;
    if (!isValidInit(init)) {
        throw new ChatGPTConfigurationError("Invalid initialization sequence: " + PROP_CHATGPT_INIT);
    }
    return init.map((msg) => ({
        role: msg.role,
        content: filteredInitContent(msg.content),
    }));
}

function isValidInit(obj: unknown): obj is ChatGPTMessage[] {
    if (!Array.isArray(obj)) {
        return false;
    }
    return obj.every((member) => {
        const msg = member as ChatGPTMessage;
        return (
            (msg?.role === "system" || msg?.role === "user" || msg?.role === "assistant") &&
            typeof msg?.content === "string"
        );
    });
}

function filteredInitContent(content: string): string {
    return content.replace("${currentDate}", getCurrentDate());
}

function getCurrentDate() {
    const now = new Date();
    return MONTH_NAMES[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
}

function toChatGPTMessages(messages: ChatHistoryMessage[]): ChatGPTMessage[] {
    return messages.map((m) => toChatGPTMessage(m));
}

function toChatGPTMessage(message: ChatHistoryMessage): ChatGPTMessage {
    return {
        role: message.user === USER_ASSISTANT ? "assistant" : "user",
        content: message.text,
    };
}

function toChatGPTCompletionResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): ChatGPTCompletionResponse {
    if (!isOkResponse(response)) {
        throw new ChatGPTCompletionError(
            "Received an error response from ChatGPT",
            "HTTP response code " + response.getResponseCode()
        );
    }
    const responseData = response.getContentText();
    try {
        const data = JSON.parse(responseData);
        if (isChatGPTCompletionResponse(data)) {
            return data;
        } else {
            throw new Error("Response is not a chat completion object");
        }
    } catch (err) {
        console.log("ChatGPT completion response was:\n" + responseData);
        throw err;
    }
}

function isOkResponse(response: GoogleAppsScript.URL_Fetch.HTTPResponse): boolean {
    return response.getResponseCode() === 200;
}

function getShowTokens(): boolean {
    return getBooleanProperty("SHOW_TOKENS") ?? false;
}

function getTokenPrice(): number | void {
    return getNumberProperty("CHATGPT_TOKEN_PRICE");
}

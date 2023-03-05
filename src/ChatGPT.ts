import { ChatError } from "./Errors";
import { ChatHistory, ChatHistoryMessage } from "./History";
import { getStringProperty } from "./Properties";

interface ChatGPTCompletionRequest {
    model: string;
    messages: Array<ChatGPTMessage>;
}

interface ChatGPTMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface ChatGPTCompletionResponse {
    object: "chat.completion";
    created: number;
    choices: Array<ChatGPTCompletionChoice>;
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

const USER_ASSISTANT = "__assistant_user__";
const PROP_OPENAI_API_KEY = "OPENAI_API_KEY";

/**
 * Requests and returns a ChatGPT completion for the specified chat history.
 * Returns an empty string as response text if ChatGPT remains silent.
 * The caller is responsible for storing the response message in chat history.
 */
export function requestChatGPTCompletion(history: ChatHistory): ChatHistoryMessage {
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
    let responseMessage: ChatHistoryMessage;
    try {
        const httpResponse = UrlFetchApp.fetch(url, params);
        const response = toChatGPTCompletionResponse(httpResponse);
        try {
            if ((response.choices?.length ?? 0) < 1 || typeof response.choices[0].message?.content !== "string") {
                throw new Error("No completion content available");
            }
            responseMessage = {
                time: response.created,
                user: USER_ASSISTANT,
                text: response.choices[0].message.content.trim(),
            };
        } catch (err) {
            console.log("ChatGPT completion response was:\n" + JSON.stringify(response, null, 2));
            throw err;
        }
    } catch (err) {
        throw new ChatGPTCompletionError("Error while performing a ChatGPT completion", err);
    }
    return responseMessage;
}

function createChatGPTCompletionRequest(history: ChatHistory): ChatGPTCompletionRequest {
    return {
        model: getModel(),
        messages: toChatGPTMessages(history.messages),
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

function getModel(): string {
    return getStringProperty("CHATGPT_MODEL") ?? "gpt-3.5-turbo";
}

function toChatGPTMessages(messages: Array<ChatHistoryMessage>): Array<ChatGPTMessage> {
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

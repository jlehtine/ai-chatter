import { ChatError } from "./Errors";
import { ChatHistory, ChatHistoryMessage } from "./History";
import { getBooleanProperty, getNumberProperty, getObjectProperty, getStringProperty } from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { getOpenAIAPIKey } from "./OpenAI";

// Chat completion API interface

/** Chat completion request */
interface ChatGPTCompletionRequest {
    model: string;
    messages: ChatGPTMessage[];
    user?: string;
}

/** Chat completion response */
interface ChatGPTCompletionResponse {
    object: "chat.completion";
    created: number;
    choices: ChatGPTCompletionChoice[];
    usage: ChatGPTUsage;
}

/** Chat message */
interface ChatGPTMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/** Chat completion choice (a single result) */
interface ChatGPTCompletionChoice {
    index: number;
    message: ChatGPTMessage;
    finish_reason: string;
}

/** Chat completion token usage */
interface ChatGPTUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

function isChatGPTCompletionResponse(obj: unknown): obj is ChatGPTCompletionResponse {
    return (obj as ChatGPTCompletionResponse)?.object === "chat.completion";
}

/** Signals a configuration error */
class ChatGPTConfigurationError extends Error {}

/** Signals a chat completion error */
class ChatGPTCompletionError extends ChatError {
    constructor(message: string, cause: unknown = undefined) {
        super(message, "ChatGPTCompletionError", cause);
    }
}

/** User name used for the assistant in chat history */
export const USER_ASSISTANT = "__ChatGPT__";

/** Property key for the initialization sequence of a one-to-one chat */
const PROP_CHATGPT_INIT = "CHATGPT_INIT";

/** Property key for the initialization sequence of a group chat */
const PROP_CHATGPT_INIT_GROUP = "CHATGPT_INIT_GROUP";

/** Default initialization sequence for a one-to-one chat */
const DEFAULT_CHATGPT_INIT: ChatGPTMessage[] = [
    {
        role: "user",
        content: "My name is ${user.firstName}.",
    },
];

/** Default initialization sequence for a group chat */
const DEFAULT_CHATGPT_INIT_GROUP: ChatGPTMessage[] = [
    {
        role: "user",
        content: "This discussion has several participants. Each input starts with the name of the participant.",
    },
];

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
 * Updates the specified history with the ChatGPT response.
 * The caller is responsible for persisting the history.
 */
export function requestChatGPTCompletion(
    history: ChatHistory,
    oneToOne: boolean,
    user: string
): GoogleChat.ResponseMessage {
    const url = getChatCompletionsURL();
    const apiKey = getOpenAIAPIKey();
    const request = createChatGPTCompletionRequest(history, oneToOne, user);
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
}

/**
 * Creates a chat completion request from the specified chat history.
 */
function createChatGPTCompletionRequest(
    history: ChatHistory,
    oneToOne: boolean,
    user: string
): ChatGPTCompletionRequest {
    return {
        model: getModel(),
        messages: toChatGPTMessages(history, oneToOne),
        user: user,
    };
}

function getChatCompletionsURL(): string {
    return getStringProperty("CHATGPT_COMPLETIONS_URL") ?? "https://api.openai.com/v1/chat/completions";
}

/** Returns whether chat completion requests and responses should be logged */
function getLogChatGPT(): boolean {
    return getBooleanProperty("LOG_CHATGPT") ?? false;
}

/** Returns the chat completion model to be used */
function getModel(): string {
    return getStringProperty("CHATGPT_MODEL") ?? "gpt-3.5-turbo";
}

/**
 * Returns the initialization sequence for a chat.
 */
function getInit(history: ChatHistory, oneToOne: boolean): ChatGPTMessage[] {
    const initProp = oneToOne ? PROP_CHATGPT_INIT : PROP_CHATGPT_INIT_GROUP;
    const defaultInit = oneToOne ? DEFAULT_CHATGPT_INIT : DEFAULT_CHATGPT_INIT_GROUP;
    const init = getObjectProperty(initProp) ?? defaultInit;
    if (!isValidInit(init)) {
        throw new ChatGPTConfigurationError("Invalid initialization sequence: " + initProp);
    }
    return init.map((msg) => ({
        role: msg.role,
        content: filteredInitContent(msg.content, history),
    }));
}

/**
 * Returns whether the specified object represents a valid chat initialization sequence.
 */
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

/**
 * Filters the content of initialization sequence messages, filling in the variables.
 */
function filteredInitContent(content: string, history: ChatHistory): string {
    return content.replace("${currentDate}", getCurrentDate()).replace("${user.firstName}", getUserFirstName(history));
}

/**
 * Returns the current date as a string for initialization sequence.
 */
function getCurrentDate(): string {
    const now = new Date();
    return MONTH_NAMES[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
}

/**
 * Returns the first name of the user for a one-to-one chat, based on the specified history.
 */
function getUserFirstName(history: ChatHistory) {
    const messages = history.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message.user !== USER_ASSISTANT) {
            const firstName = getFirstName(message.user.trim());
            if (firstName) {
                return firstName;
            }
        }
    }
    return "an unknown user";
}

/**
 * Converts a chat history into an array of chat messages suitable for a completion request.
 */
function toChatGPTMessages(history: ChatHistory, oneToOne: boolean): ChatGPTMessage[] {
    const messages = history.messages;
    const nameMap = getParticipantNameMap(messages);
    return getInit(history, oneToOne).concat(messages.map((m) => toChatGPTMessage(m, oneToOne ? undefined : nameMap)));
}

/**
 * Converts an individual chat history message into a chat message suitable for a completion request.
 */
function toChatGPTMessage(message: ChatHistoryMessage, nameMap?: { [key: string]: string }): ChatGPTMessage {
    const name = nameMap ? nameMap[message.user] : undefined;
    const content = (name ? name + ":\n" : "") + message.text;
    return {
        role: message.user === USER_ASSISTANT ? "assistant" : "user",
        content: content,
    };
}

/**
 * Parses the specified HTTP response into a chat completion response.
 * Throws an error if the response does not indicate success.
 */
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
    const code = response.getResponseCode();
    return code >= 200 && code < 300;
}

/**
 * Returns whether to show token usage to the user as part of the response.
 */
function getShowTokens(): boolean {
    return getBooleanProperty("SHOW_TOKENS") ?? false;
}

/**
 * Returns the per-token price in dollars, if configured.
 */
function getTokenPrice(): number | void {
    return getNumberProperty("CHATGPT_TOKEN_PRICE");
}

/**
 * Returns an object mapping chat participant display names to a shortened names
 * relayed to the chat completion service.
 */
function getParticipantNameMap(messages: ChatHistoryMessage[]): { [key: string]: string } {
    const nameMap: { [key: string]: string } = {};
    const users: string[] = [];
    messages
        .filter((m) => m.user !== USER_ASSISTANT && m.user.trim())
        .map((m) => m.user.trim())
        .forEach((user) => {
            if (!users.includes(user)) {
                users.push(user);
            }
        });
    users.forEach((user) => {
        const firstName = getFirstName(user);
        const uniqueFirstName = users.filter((u) => u !== user).every((u) => getFirstName(u) !== firstName);
        if (uniqueFirstName) {
            nameMap[user] = firstName;
        } else {
            const firstNamePlusInitial = getFirstNamePlusInitial(user);
            const uniqueFirstNamePlusInitial = users
                .filter((u) => u !== user)
                .every((u) => getFirstNamePlusInitial(u) !== firstNamePlusInitial);
            if (uniqueFirstNamePlusInitial) {
                nameMap[user] = firstNamePlusInitial;
            } else {
                nameMap[user] = user;
            }
        }
    });
    return nameMap;
}

function getFirstName(displayName: string): string {
    return (displayName.match(/^\S*/) ?? [""])[0];
}

function getFirstNamePlusInitial(displayName: string): string {
    return (displayName.match(/^\S*(\s+\S)?/) ?? [""])[0];
}

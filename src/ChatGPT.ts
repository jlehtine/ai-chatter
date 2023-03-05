import { ChatError } from "./Errors";
import { ChatHistory, ChatHistoryMessage } from "./History";
import { getBooleanProperty, getNumberProperty, getObjectProperty, getStringProperty } from "./Properties";
import * as GoogleChat from "./GoogleChat";

interface ChatGPTCompletionRequest {
    model: string;
    messages: ChatGPTMessage[];
    user?: string;
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
const PROP_CHATGPT_INIT_GROUP = "CHATGPT_INIT_GROUP";

const DEFAULT_CHATGPT_INIT: ChatGPTMessage[] = [];

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
 * Returns null if ChatGPT remains silent.
 * Updates the specified history with the ChatGPT response.
 * The caller is responsible for persisting the history.
 */
export function requestChatGPTCompletion(history: ChatHistory, user: string): GoogleChat.BotResponse {
    const url = getChatCompletionsURL();
    const apiKey = getOpenAIAPIKey();
    const request = createChatGPTCompletionRequest(history, user);
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

function createChatGPTCompletionRequest(history: ChatHistory, user: string): ChatGPTCompletionRequest {
    return {
        model: getModel(),
        messages: toChatGPTMessages(history),
        user: user,
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

function getInit(history: ChatHistory, groupChat: boolean): ChatGPTMessage[] {
    const initProp = groupChat ? PROP_CHATGPT_INIT_GROUP : PROP_CHATGPT_INIT;
    const defaultInit = groupChat ? DEFAULT_CHATGPT_INIT_GROUP : DEFAULT_CHATGPT_INIT;
    const init = getObjectProperty(initProp) ?? defaultInit;
    if (!isValidInit(init)) {
        throw new ChatGPTConfigurationError("Invalid initialization sequence: " + PROP_CHATGPT_INIT);
    }
    return init.map((msg) => ({
        role: msg.role,
        content: filteredInitContent(msg.content, history),
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

function filteredInitContent(content: string, history: ChatHistory): string {
    return content.replace("${currentDate}", getCurrentDate()).replace("${user.firstName}", getUserFirstName(history));
}

function getCurrentDate() {
    const now = new Date();
    return MONTH_NAMES[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
}

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

function toChatGPTMessages(history: ChatHistory): ChatGPTMessage[] {
    const messages = history.messages;
    const nameMap = getParticipantNameMap(messages);
    const groupChat = Object.keys(nameMap).length > 1;
    return getInit(history, groupChat).concat(
        messages.map((m) => toChatGPTMessage(m, groupChat ? nameMap : undefined))
    );
}

function toChatGPTMessage(message: ChatHistoryMessage, nameMap?: { [key: string]: string }): ChatGPTMessage {
    const name = nameMap ? nameMap[message.user] : undefined;
    const content = (name ? name + ":\n" : "") + message.text;
    return {
        role: message.user === USER_ASSISTANT ? "assistant" : "user",
        content: content,
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

function getFirstName(user: string): string {
    return (user.match(/^\S*/) ?? [""])[0];
}

function getFirstNamePlusInitial(user: string): string {
    return (user.match(/^\S*(\s+\S)?/) ?? [""])[0];
}

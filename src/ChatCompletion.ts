import { ChatError } from "./Errors";
import { ChatHistoryMessage, ROLE_ASSISTANT, ROLE_USER } from "./History";
import {
    getBooleanProperty,
    getNumberProperty,
    getJSONProperty,
    getStringProperty,
    setJSONProperty,
} from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { getOpenAIAPIKey } from "./OpenAIAPI";
import { checkModeration } from "./Moderation";
import { millisNow, MillisSinceEpoch } from "./Timestamp";
import { requestNativeImageGeneration } from "./Image";
import { CardSection } from "./GoogleChat";
import { asStringOpt } from "./typeutil";

// Chat completion API interface

/** Chat completion request */
interface ChatCompletionRequest {
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
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

/** Chat completion configuration by space */
interface ConfigurationProp {
    configurationBySpace: { [key: string]: Configuration };
}

interface Configuration {
    used: MillisSinceEpoch;
    instructions?: string;
}

function isConfigurationProp(obj: unknown): obj is ConfigurationProp {
    return typeof (obj as ConfigurationProp)?.configurationBySpace === "object";
}

/** Property key for the initialization sequence of a chat */
export const PROP_CHAT_COMPLETION_INIT = "CHAT_COMPLETION_INIT";

/** Default initialization sequence for a chat */
const DEFAULT_CHAT_INIT: ChatCompletionInitialization = [];

/** Default instruction given to chat completion to use image illustrations */
const DEFAULT_CHAT_COMPLETION_IMAGES_INSTRUCTION =
    "You may include DALL·E generated images in your responses using notation [DALLE: your prompt for image]. " +
    "Use images only when user asks for images or when the response requires visual output.";

/** Property key for chat completion configuration mapped by space */
const PROP_CONFIGURATION = "_configuration";

const DAY_IN_MILLIS = 24 * 60 * 60 * 1000;

/**
 * Requests a simple completion for the specified prompt.
 *
 * @param prompt prompt for completion
 * @param user user identification
 */
export function requestSimpleCompletion(prompt: string, user?: string): GoogleChat.ResponseMessage {
    return requestChatCompletion([{ time: millisNow(), role: ROLE_USER, text: prompt }], user, undefined, true);
}

/**
 * Requests and returns a chat completion for the specified chat message history.
 * Updates the specified message sequence with the chat completion response.
 * The caller is responsible for persisting the history.
 *
 * @param messages chat messages to complement
 * @param user user identification
 * @param instructions instructions for AI in this chat
 * @param skipInit whether to skip the chat initialization sequence (default is false)
 */
export function requestChatCompletion(
    messages: ChatHistoryMessage[],
    user?: string,
    space?: string,
    skipInit = false
): GoogleChat.ResponseMessage {
    // Make native chat completion request
    const response = requestNativeChatCompletion(messages, user, space, skipInit);
    let responseText = getChatCompletionText(response);

    // Moderate output
    checkModeration(responseText);

    // Generate images if they were included in the response
    const imageSections: CardSection[] = [];
    if (getChatCompletionImages()) {
        responseText = responseText
            .replaceAll(/\[\s*DALLE\s*[:\s]\s*([^\]]*)\]/gi, (m, p) => {
                try {
                    const response = requestNativeImageGeneration(p, undefined, 1, "512x512");
                    response.data.forEach((img) => {
                        imageSections.push({
                            header: '"' + p + '"',
                            widgets: [
                                {
                                    image: {
                                        imageUrl: img.url,
                                    },
                                },
                            ],
                            collapsible: false,
                        });
                    });
                } catch (err) {
                    // Log error but continue without images
                    console.error(err);
                }
                return "";
            })
            .trim();
    }

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
    if (imageSections.length > 0) {
        GoogleChat.addCardWithSections(chatResponse, "images", imageSections);
    }
    return chatResponse;
}

function requestNativeChatCompletion(
    messages: ChatHistoryMessage[],
    user?: string,
    space?: string,
    skipInit = false
): ChatCompletionResponse {
    // Prepare chat completion request
    const url = getChatCompletionURL();
    const apiKey = getOpenAIAPIKey();
    const request = createChatCompletionRequest(messages, user, space, skipInit);
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
                role: ROLE_ASSISTANT,
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
    user?: string,
    space?: string,
    skipInit = false
): ChatCompletionRequest {
    // Find instructions for this space, unless all initialization skipped
    const instr = skipInit || space === undefined ? undefined : getInstructions(space);
    const instrMsgs = instr === undefined ? [] : [toChatCompletionUserMessage(instr)];

    // Construct an array of chat completion messages: initialization, instructions and chat history
    const ccmsgs = (skipInit ? [] : getChatCompletionInit())
        .concat(instrMsgs)
        .concat(toChatCompletionMessages(messages));

    return {
        model: getChatCompletionModel(),
        temperature: getChatCompletionTemperature(),
        messages: ccmsgs,
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

/** Returns the chat completion temperature parameter value */
function getChatCompletionTemperature(): number | undefined {
    return getNumberProperty("CHAT_COMPLETION_TEMPERATURE");
}

/**
 * Returns the initialization sequence for a chat.
 */
function getChatCompletionInit(): ChatCompletionMessage[] {
    const init = getJSONProperty(PROP_CHAT_COMPLETION_INIT) ?? DEFAULT_CHAT_INIT;
    if (!isValidInit(init)) {
        throw new ChatCompletionConfigurationError("Invalid initialization sequence: " + PROP_CHAT_COMPLETION_INIT);
    }
    if (getChatCompletionImages()) {
        init.push({
            role: "system",
            content: getChatCompletionImagesInstruction(),
        });
    }
    return init;
}

/**
 * Returns whether to generate images from chat completion responses.
 */
function getChatCompletionImages(): boolean {
    return getBooleanProperty("CHAT_COMPLETION_IMAGES") ?? false;
}

function getChatCompletionImagesInstruction(): string {
    return (
        asStringOpt(getJSONProperty("CHAT_COMPLETION_IMAGES_INSTRUCTION")) ?? DEFAULT_CHAT_COMPLETION_IMAGES_INSTRUCTION
    );
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
function toChatCompletionMessages(messages: ChatHistoryMessage[]): ChatCompletionMessage[] {
    return messages.map((m) => toChatCompletionMessage(m));
}

/**
 * Converts an individual chat history message into a chat message suitable for a completion request.
 */
function toChatCompletionMessage(message: ChatHistoryMessage): ChatCompletionMessage {
    return {
        role: message.role,
        content: message.text,
    };
}

/***
 * Converts textual content into a user message for chat completion.
 */
function toChatCompletionUserMessage(content: string): ChatCompletionMessage {
    return {
        role: "user",
        content: content,
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
 * Returns the current instructions for the specified space.
 */
export function getInstructions(space: string): string | undefined {
    return getConfiguration(space)?.instructions;
}

/**
 * Sets or clears instructions for the specified space.
 */
export function setInstructions(space: string, instructions?: string): void {
    updateConfiguration(space, (conf) => {
        conf.instructions = instructions;
    });
}

/**
 * Removes configuration for the specified space.
 */
export function removeConfigurationForSpace(space: string): void {
    const confProp = getConfigurationProp();
    delete confProp.configurationBySpace[space];
    setConfigurationProp(confProp);
}

function updateConfiguration(space: string, update: (conf: Configuration) => void): Configuration {
    const confProp = getConfigurationProp();
    let conf = confProp.configurationBySpace[space];
    const now = millisNow();
    if (!conf) {
        conf = { used: now };
        confProp.configurationBySpace[space] = conf;
    } else {
        conf.used = now;
    }
    update(conf);

    // Remove configuration if it is all defaults
    if (conf.instructions === undefined) {
        delete confProp.configurationBySpace[space];
    }

    setConfigurationProp(confProp);
    return conf;
}

function getConfiguration(space: string): Configuration | undefined {
    const confProp = getConfigurationProp();
    const conf = confProp.configurationBySpace[space];
    if (conf) {
        const now = millisNow();
        if (now - conf.used > DAY_IN_MILLIS) {
            conf.used = now;
            setJSONProperty(PROP_CONFIGURATION, confProp);
        }
        return conf;
    } else {
        return undefined;
    }
}

function getConfigurationProp(): ConfigurationProp {
    const confProp = getJSONProperty(PROP_CONFIGURATION);
    if (isConfigurationProp(confProp)) {
        return confProp;
    } else {
        return { configurationBySpace: {} };
    }
}

function setConfigurationProp(confProp: ConfigurationProp) {
    setJSONProperty(PROP_CONFIGURATION, confProp);
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

import { getProperties, getNumberProperty, getJSONProperty, setJSONProperty, deleteProperty } from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { MillisSinceEpoch, Millis, millisNow, minutesToMillis, differenceMillis } from "./Timestamp";
import { CausedError, logError } from "./Errors";

const HISTORY_PREFIX = "_history/";

/** History for a chat or a chat thread */
export interface ChatHistory {
    updated: MillisSinceEpoch;
    space: string;
    thread?: string;
    messages: ChatHistoryMessage[];
    imageCommand?: ChatHistoryImageCommand;
}

/** One message in a chat history */
export interface ChatHistoryMessage {
    time: MillisSinceEpoch;
    role: ChatHistoryMessageRole;
    text: string;
}

/** Whether a chat message was produced by a user or by the assistant (i.e. chat completion) */
export type ChatHistoryMessageRole = typeof ROLE_USER | typeof ROLE_ASSISTANT;

export const ROLE_USER = "user";
export const ROLE_ASSISTANT = "assistant";

export interface ChatHistoryImageCommand {
    time: MillisSinceEpoch;
    arg: string;
}

function isChatHistory(obj: unknown): obj is ChatHistory {
    const updatedType = typeof (obj as ChatHistory)?.updated;
    const spaceType = typeof (obj as ChatHistory)?.space;
    const threadType = typeof (obj as ChatHistory)?.thread;
    const messages = (obj as ChatHistory)?.messages;
    return (
        updatedType === "number" &&
        spaceType === "string" &&
        (threadType === "string" || threadType === "undefined") &&
        Array.isArray(messages)
    );
}

/**
 *  Creates a new chat history from a Google Chat message.
 */
function createChatHistory(message: GoogleChat.Message): ChatHistory {
    return {
        updated: millisNow(),
        space: message.space.name,
        thread: message.space.spaceThreadingState === "UNTHREADED_MESSAGES" ? undefined : message.thread.name,
        messages: [toChatHistoryMessage(message)],
    };
}

/**
 * Returns chat history for the specified message, including the new message unless requested as is.
 * The caller is responsible for saving the history at the end to persist the new message.
 */
export function getHistory(message: GoogleChat.Message, asIs = false): ChatHistory {
    // Check if history exists and add to existing or create a new
    const historyKey = getHistoryKeyForMessage(message);
    const historyObj = getJSONProperty(historyKey);
    let history: ChatHistory;
    if (isChatHistory(historyObj)) {
        history = historyObj;
        pruneHistory(history);
        if (!asIs) {
            history.messages.push(toChatHistoryMessage(message));
            delete history.imageCommand;
        }
    } else {
        history = createChatHistory(message);
        if (asIs) {
            history.messages = [];
        }
    }

    return history;
}

/**
 * Saves the specified history, trying to prune it on failure (assuming too long value).
 */
export function saveHistory(history: ChatHistory) {
    // Prune expired histories
    pruneHistories();

    history.updated = millisNow();
    const historyKey = getHistoryKey(history);
    let saved = false;
    while (!saved) {
        try {
            setJSONProperty(historyKey, history);
            saved = true;
        } catch (err: unknown) {
            logError(err);
            if (history.messages.length > 0) {
                history.messages.splice(0, 1);
            } else {
                throw new CausedError("Failed to save chat history", err);
            }
        }
    }
}

/**
 * Removes the histories associated with the specified space.
 */
export function removeHistoriesForSpace(space: GoogleChat.Space): void {
    const spaceHistoryKey = HISTORY_PREFIX + space.name;
    const props = getProperties();
    Object.keys(props).forEach((propKey) => {
        if (propKey === spaceHistoryKey || propKey.startsWith(spaceHistoryKey + "/")) {
            deleteProperty(propKey);
        }
    });
}

/**
 * Returns the history key for the specified chat message.
 */
function getHistoryKeyForMessage(message: GoogleChat.Message): string {
    return (
        HISTORY_PREFIX +
        (message.space.spaceThreadingState === "UNTHREADED_MESSAGES" ? message.space.name : message.thread.name)
    );
}

/**
 * Returns the history key for the specified history.
 */
function getHistoryKey(history: ChatHistory): string {
    return HISTORY_PREFIX + (history.thread ?? history.space);
}

/**
 * Converts the specified Google Chat message to a history entry.
 */
function toChatHistoryMessage(message: GoogleChat.Message): ChatHistoryMessage {
    return {
        time: millisNow(),
        role: "user",
        text: message.argumentText ?? message.text,
    };
}

/**
 * Prunes expired records from the history.
 */
function pruneHistory(history: ChatHistory): void {
    const historyMillis = getHistoryMillis();
    const now: MillisSinceEpoch = millisNow();
    const messages = history.messages;
    let i;
    for (i = 0; i < messages.length; i++) {
        if (differenceMillis(now, messages[i].time) <= historyMillis) {
            break;
        }
    }
    messages.splice(0, i);
}

/**
 * Go through all histories and prune expired histories.
 */
function pruneHistories(): void {
    const historyMillis = getHistoryMillis();
    const now: MillisSinceEpoch = millisNow();
    const props = getProperties();
    Object.keys(props).forEach((propKey) => {
        if (propKey.startsWith(HISTORY_PREFIX)) {
            const history = JSON.parse(props[propKey]);
            if (isChatHistory(history)) {
                const messages = history.messages;
                if (
                    (messages.length === 0 ||
                        differenceMillis(now, messages[messages.length - 1].time) > historyMillis) &&
                    (!history.imageCommand || differenceMillis(now, history.imageCommand.time) > historyMillis)
                ) {
                    // Delete an expired history
                    deleteProperty(propKey);
                }
            } else {
                // Delete an invalid property
                deleteProperty(propKey);
            }
        }
    });
}

/**
 * Returns the number of millis that a chat history should be retained.
 */
function getHistoryMillis(): Millis {
    return minutesToMillis(getNumberProperty("HISTORY_MINUTES") ?? 60);
}

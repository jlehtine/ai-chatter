import { getProperties, getNumberProperty, getObjectProperty, setObjectProperty, deleteProperty } from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { MillisSinceEpoch, Millis, millisNow, minutesToMillis, differenceMillis } from "./Timestamp";
import { CausedError, logError } from "./Errors";

const HISTORY_PREFIX = "_history/";

/** History for a chat or a chat thread */
export interface ChatHistory {
    space: string;
    thread?: string;
    messages: Array<ChatHistoryMessage>;
}

/** One message in a chat history */
export interface ChatHistoryMessage {
    time: MillisSinceEpoch;
    user: string;
    text: string;
}

function isChatHistory(obj: unknown): obj is ChatHistory {
    const spaceType = typeof (obj as ChatHistory)?.space;
    const threadType = typeof (obj as ChatHistory)?.thread;
    const messages = (obj as ChatHistory)?.messages;
    return spaceType === "string" && (threadType === "string" || threadType === "undefined") && Array.isArray(messages);
}

/**
 *  Creates a new chat history from a Google Chat message.
 */
function createChatHistory(message: GoogleChat.Message): ChatHistory {
    return {
        space: message.space.name,
        thread: message.space.spaceThreadingState === "UNTHREADED_MESSAGES" ? undefined : message.thread.name,
        messages: [toChatHistoryMessage(message)],
    };
}

/**
 * Returns chat history for the specified message, including the new message.
 * The caller is responsible for saving the history at the end to persist the new message.
 */
export function getHistory(message: GoogleChat.Message): ChatHistory {
    // Check if history exists and add to existing or create a new
    const historyKey = getHistoryKeyForMessage(message);
    const historyObj = getObjectProperty(historyKey);
    let history: ChatHistory;
    if (isChatHistory(historyObj)) {
        history = historyObj;
        pruneHistory(history);
        history.messages.push(toChatHistoryMessage(message));
        history.messages.sort((h1, h2) => h1.time - h2.time);
    } else {
        history = createChatHistory(message);
    }

    return history;
}

/**
 * Saves the specified history, trying to prune it on failure (assuming too long value).
 */
export function saveHistory(history: ChatHistory) {
    // Prune expired histories
    pruneHistories();

    const historyKey = getHistoryKey(history);
    let saved = false;
    let lastErr;
    while (!saved && history.messages.length > 0) {
        try {
            setObjectProperty(historyKey, history);
            saved = true;
        } catch (err: unknown) {
            logError(err);
            lastErr = err;
            history.messages.splice(0, 1);
        }
    }
    if (!saved) {
        throw new CausedError("Failed to save chat history", lastErr);
    }
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
        time: Math.floor(GoogleChat.toMillisSinceEpoch(message.createTime)),
        user: message.sender.displayName,
        text: message.fallbackText ?? message.text,
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
    for (const propKey in Object.keys(props)) {
        if (propKey.startsWith(HISTORY_PREFIX)) {
            const history = JSON.parse(props[propKey]);
            if (isChatHistory(history)) {
                const messages = history.messages;
                if (
                    messages.length === 0 ||
                    differenceMillis(now, messages[messages.length - 1].time) > historyMillis
                ) {
                    // Delete an expired history
                    deleteProperty(propKey);
                }
            } else {
                // Delete an invalid property
                deleteProperty(propKey);
            }
        }
    }
}

/**
 * Returns the number of millis that a chat history should be retained.
 */
function getHistoryMillis(): Millis {
    return minutesToMillis(getNumberProperty("HISTORY_MINUTES") ?? 60);
}

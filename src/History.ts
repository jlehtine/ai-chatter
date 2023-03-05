import {
    PropertyKey,
    getProperties,
    getNumberProperty,
    getObjectProperty,
    setObjectProperty,
    deleteProperty,
} from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { MillisSinceEpoch, Millis, millisNow, minutesToMillis, differenceMillis } from "./Timestamp";
import { logError } from "./Errors";

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
 */
export function getHistory(message: GoogleChat.Message): ChatHistory {
    // Check if history exists and create a new or add to existing
    const historyProp = getHistoryPropertyKey(message);
    const historyObj = getObjectProperty(historyProp);
    let history: ChatHistory;
    if (isChatHistory(historyObj)) {
        history = historyObj;
        pruneHistory(history);
        history.messages.push(toChatHistoryMessage(message));
        history.messages.sort((h1, h2) => h1.time - h2.time);
    } else {
        history = createChatHistory(message);
    }

    // Save history, pruning it on failure (assuming too long value)
    let saved = false;
    while (!saved && history.messages.length > 0) {
        try {
            setObjectProperty(historyProp, history);
            saved = true;
        } catch (err: unknown) {
            logError(err);
            history.messages.splice(0, 1);
        }
    }
    if (!saved) {
        try {
            deleteProperty(historyProp);
        } catch (err: unknown) {
            logError(err);
        }
    }

    // Prune expired histories
    pruneHistories();

    return history;
}

/** Returns the history property key for a chat message */
function getHistoryPropertyKey(message: GoogleChat.Message): string {
    return (
        HISTORY_PREFIX +
        (message.space.spaceThreadingState === "UNTHREADED_MESSAGES" ? message.space.name : message.thread.name)
    );
}

/**
 * Converts the specified Google Chat message to a history entry.
 */
function toChatHistoryMessage(message: GoogleChat.Message): ChatHistoryMessage {
    return {
        time: Math.floor(GoogleChat.toMillisSinceEpoch(message.createTime)),
        user: message.sender.displayName,
        text: message.argumentText,
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
    return minutesToMillis(getNumberProperty(PropertyKey.HISTORY_MINUTES) ?? 60);
}

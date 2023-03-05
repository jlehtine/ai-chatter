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

/** History for a chat thread */
export type ThreadHistory = Array<HistoryMessage>;

/** One message in a chat thread history */
export interface HistoryMessage {
    time: MillisSinceEpoch;
    user: string;
    text: string;
}

/**
 * Returns chat history for the specified message, including the new message.
 */
export function getHistory(message: GoogleChat.Message): ThreadHistory {
    // Check if history exists and create a new or add to existing
    const historyProp =
        HISTORY_PREFIX +
        (message.space.spaceThreadingState === "UNTHREADED_MESSAGES" ? message.space.name : message.thread.name);
    const historyMessage = toHistoryMessage(message);
    let history = getObjectProperty(historyProp) as ThreadHistory;
    if (typeof history !== "undefined") {
        pruneHistory(history);
    } else {
        history = [];
    }
    history.push(historyMessage);
    history.sort((h1, h2) => h1.time - h2.time);

    // Save history, pruning it on failure (assuming too long value)
    let saved = false;
    while (!saved && history.length > 0) {
        try {
            setObjectProperty(historyProp, history);
            saved = true;
        } catch (err: unknown) {
            logError(err);
            history.splice(0, 1);
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

/**
 * Converts the specified Google Chat message to a history entry.
 */
function toHistoryMessage(message: GoogleChat.Message): HistoryMessage {
    return {
        time: Math.floor(GoogleChat.toMillisSinceEpoch(message.createTime)),
        user: message.sender.displayName,
        text: message.argumentText,
    };
}

/**
 * Prunes expired records from the history.
 */
function pruneHistory(history: ThreadHistory): void {
    const historyMillis: Millis = minutesToMillis(getNumberProperty(PropertyKey.HISTORY_MINUTES)!);
    const now: MillisSinceEpoch = millisNow();
    let i;
    for (i = 0; i < history.length; i++) {
        if (differenceMillis(now, history[i].time) <= historyMillis) {
            break;
        }
    }
    history.splice(0, i);
}

/**
 * Go through all histories and prune expired histories.
 */
function pruneHistories(): void {
    const historyMillis: Millis = minutesToMillis(getNumberProperty(PropertyKey.HISTORY_MINUTES)!);
    const now: MillisSinceEpoch = millisNow();
    const props = getProperties();
    for (const propKey in Object.keys(props)) {
        if (propKey.startsWith(HISTORY_PREFIX)) {
            const history = JSON.parse(props[propKey]) as ThreadHistory;
            if (history.length === 0 || differenceMillis(now, history[history.length - 1].time) > historyMillis) {
                deleteProperty(propKey);
            }
        }
    }
}

import { PropertyKey, getNumberProperty, getObjectProperty, setObjectProperty, deleteProperty } from "./Properties";
import * as GoogleChat from "./GoogleChat";
import { MillisSinceEpoch, Millis, millisNow, minutesToMillis, differenceMillis } from "./Timestamp";

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
    let saved = false;
    while (!saved && history.length > 0) {
        try {
            setObjectProperty(historyProp, history);
            saved = true;
        } catch (err: any) {
            history.splice(0, 1);
        }
    }
    if (!saved) {
        try {
            deleteProperty(historyProp);
        } catch (err: any) {
            console.error(err.stack || err.message || err);
        }
    }
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

function pruneHistory(history: ThreadHistory): void {
    const historyMillis: Millis = minutesToMillis(getNumberProperty(PropertyKey.HISTORY_MINUTES) as number);
    const now: MillisSinceEpoch = millisNow();
    let i;
    for (i = 0; i < history.length; i++) {
        if (differenceMillis(now, history[i].time) < historyMillis) {
            break;
        }
    }
    history.splice(0, i);
}

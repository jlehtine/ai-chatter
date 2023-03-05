import { requestChatGPTCompletion } from "./ChatGPT";
import { checkForCommand } from "./Commands";
import { ChatError, isChatError, logError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { ChatHistoryMessage, getHistory, saveHistory } from "./History";

/**
 * Responds to a received message.
 */
function onMessage(event: GoogleChat.OnMessageEvent): GoogleChat.BotResponse {
    try {
        // Check if the message includes a command
        const commandResponse = checkForCommand(event);
        if (commandResponse) {
            return commandResponse;
        }

        // Get chat history complemented with the input message
        const history = getHistory(event.message);

        // Get ChatGPT completion
        let completionMessage: ChatHistoryMessage;
        try {
            completionMessage = requestChatGPTCompletion(history);
        } catch (err) {
            // If something goes wrong then save at least the input message in history
            saveHistory(history);
            throw err;
        }

        // Store ChatGPT answer in history
        history.messages.push(completionMessage);
        saveHistory(history);

        // Return completion, unless keeping silent
        if (completionMessage.text === "") {
            return undefined;
        } else {
            return GoogleChat.textResponse(completionMessage.text);
        }
    } catch (err) {
        return errorResponse(err);
    }
}

/**
 * Responds to being added into a space or chat.
 */
function onAddToSpace(event: GoogleChat.OnSpaceEvent): GoogleChat.BotResponse {
    try {
        // TODO
    } catch (err) {
        return errorResponse(err);
    }
}

/**
 * Responds to being removed from a space or chat.
 */
function onRemoveFromSpace(event: GoogleChat.OnSpaceEvent): void {
    // TODO Purge history
}

/**
 * Handles an error and returns a suitable chat response value.
 */
function errorResponse(err: unknown): GoogleChat.BotResponse {
    logError(err);
    let errorMessage;
    if (isChatError(err)) {
        errorMessage = err.message;
    } else {
        errorMessage = "Something went wrong...";
    }
    return GoogleChat.decoratedTextResponse("ERROR", errorMessage, '<font color="#ff0000"><b>ERROR<b/></font>');
}

// Export required globals
declare global {
    function onMessage(event: GoogleChat.OnMessageEvent): GoogleChat.BotResponse;
    function onAddToSpace(event: GoogleChat.OnSpaceEvent): GoogleChat.BotResponse;
    function onRemoveFromSpace(event: GoogleChat.OnSpaceEvent): void;
}
globalThis.onMessage = onMessage;
globalThis.onAddToSpace = onAddToSpace;
globalThis.onRemoveFromSpace = onRemoveFromSpace;

import { removeConfigurationForSpace, requestChatCompletion } from "./ChatCompletion";
import { checkForCommand, commandIntro } from "./Commands";
import { isChatError, logError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getHistory, removeHistoriesForSpace, saveHistory } from "./History";
import { checkModeration } from "./Moderation";
import { getBooleanProperty } from "./Properties";

/**
 * Responds to a received message.
 */
function onMessage(event: GoogleChat.OnMessageEvent): GoogleChat.BotResponse {
    let response;
    try {
        // Log
        if (getLogGoogleChat()) {
            console.log("Google Chat request:\n" + JSON.stringify(event, null, 2));
        }

        // Check if the message includes a command
        const commandResponse = checkForCommand(event);
        if (commandResponse) {
            response = commandResponse;
        }

        // Otherwise delegate to chat completion API
        else {
            // Moderate input
            checkModeration(event.message.text);

            // Get chat history complemented with the input message
            const history = getHistory(event.message);

            // Get chat completion
            let completionResponse: GoogleChat.BotResponse;
            try {
                completionResponse = requestChatCompletion(
                    history.messages,
                    event.message.sender.name,
                    event.message.space.name
                );
            } catch (err) {
                // If something goes wrong then save at least the input message in history
                saveHistory(history);
                throw err;
            }

            // Store chat completion result in history
            saveHistory(history);

            // Return completion, unless keeping silent
            response = completionResponse;
        }
    } catch (err) {
        response = errorResponse(err);
    }

    if (getLogGoogleChat()) {
        console.log("Google Chat response:\n" + JSON.stringify(response, null, 2));
    }
    return response;
}

/**
 * Responds to being added into a space or chat.
 */
function onAddToSpace(): GoogleChat.BotResponse {
    try {
        return commandIntro();
    } catch (err) {
        return errorResponse(err);
    }
}

/**
 * Responds to being removed from a space or chat.
 */
function onRemoveFromSpace(event: GoogleChat.OnSpaceEvent): void {
    // Remove configuration for the space
    removeConfigurationForSpace(event.space.name);

    // Remove histories associated with the space
    removeHistoriesForSpace(event.space);
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
    return GoogleChat.decoratedTextResponse(
        "error",
        "ERROR",
        errorMessage,
        '<font color="#ff0000"><b>ERROR<b/></font>'
    );
}

/**
 * Returns whether to log Google Chat requests and responses.
 */
function getLogGoogleChat(): boolean {
    return getBooleanProperty("LOG_GOOGLE_CHAT") ?? false;
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

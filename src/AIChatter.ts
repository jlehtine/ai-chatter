import { requestChatGPTCompletion } from "./ChatGPT";
import { checkForCommand } from "./Commands";
import { isChatError, logError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getHistory, saveHistory } from "./History";
import { getBooleanProperty, getStringProperty } from "./Properties";

const DEFAULT_INTRODUCTION =
    "Hi! I'm a chatbot. \
I will relay your chat messages to OpenAI chat completion API (ChatGPT) and replay you the generated response. \
You can also generate images with the OpenAI image generation API (DALL·E). \
For further help, try `/help`.";

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

        // Otherwise delegate to ChatGPT
        else {
            // Get chat history complemented with the input message
            const history = getHistory(event.message);

            // Get ChatGPT completion
            let completionResponse: GoogleChat.BotResponse;
            try {
                completionResponse = requestChatGPTCompletion(history, event.message.sender.name);
            } catch (err) {
                // If something goes wrong then save at least the input message in history
                saveHistory(history);
                throw err;
            }

            // Store ChatGPT answer in history
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
        return GoogleChat.textResponse(getIntroduction());
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

/**
 * Returns whether to log Google Chat requests and responses.
 */
function getLogGoogleChat(): boolean {
    return getBooleanProperty("LOG_GOOGLE_CHAT") ?? false;
}

/**
 * Returns the introduction shown when being added to a space.
 */
function getIntroduction(): string {
    return getStringProperty("INTRODUCTION") ?? DEFAULT_INTRODUCTION;
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

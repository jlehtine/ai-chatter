import { requestChatCompletion, requestSimpleCompletion } from "./ChatCompletion";
import { checkForCommand } from "./Commands";
import { isChatError, logError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getHistory, removeHistoriesForSpace, saveHistory } from "./History";
import { checkModeration } from "./Moderation";
import { getBooleanProperty, getStringProperty } from "./Properties";

const DEFAULT_INTRODUCTION =
    "Hi! I'm a chatbot. \
I will relay your chat messages to the OpenAI chat completion model ChatGPT and replay you the generated response. \
You can also generate images with the OpenAI image generation model DALL·E.\n\n\
I am not in any way endorsed by OpenAI, just relaying your input to their API.\n\n\
For further help, try `/help` or `@<chatbot name> /help`.\n\n\
Now let me ask ChatGPT to introduce itself and DALL·E...";

const DEFAULT_INTRODUCTION_PROMPT = "Briefly introduce the ChatGPT and DALL·E to the user.";

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
                completionResponse = requestChatCompletion(history.messages, event.message.sender.name);
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
        // Create the static response
        const introduction = getIntroduction();
        const response = GoogleChat.textResponse(introduction);

        // Ask chat completion to complement the request, ignore failures
        try {
            const prompt = getIntroductionPrompt();
            if (prompt && prompt !== "none") {
                checkModeration(prompt);
                const completionResponse = requestSimpleCompletion(prompt, undefined, true);
                if (completionResponse.text) {
                    GoogleChat.addDecoratedTextCard(
                        response,
                        "completion",
                        "Introduction of ChatGPT and DALL·E by ChatGPT:",
                        completionResponse.text
                    );
                }
            }
        } catch (err) {
            logError(err);
        }

        return response;
    } catch (err) {
        return errorResponse(err);
    }
}

/**
 * Responds to being removed from a space or chat.
 */
function onRemoveFromSpace(event: GoogleChat.OnSpaceEvent): void {
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

/**
 * Returns the introduction shown when being added to a space.
 */
function getIntroduction(): string {
    return (getStringProperty("INTRODUCTION") ?? DEFAULT_INTRODUCTION).replaceAll("<chatbot name>", getChatbotName());
}

/**
 * Returns the introduction prompt provided to the chat completion to obtain a self provided introduction.
 * Use an empty value or "none" to disable.
 */
function getIntroductionPrompt(): string {
    return getStringProperty("INTRODUCTION_PROMPT") ?? DEFAULT_INTRODUCTION_PROMPT;
}

/**
 * Returns the chatbot name for help texts, if configured.
 * Otherwise just returns "<chatbot name>".
 */
export function getChatbotName(): string {
    return getStringProperty("CHATBOT_NAME") ?? "<chatbot name>";
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

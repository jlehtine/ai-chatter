import {
    ChatCompletionInitialization,
    PROP_CHAT_COMPLETION_INIT,
    requestChatCompletion,
    requestSimpleCompletion,
    USER_ASSISTANT,
} from "./ChatCompletion";
import { ChatError, logError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getHistory, HISTORY_PREFIX, saveHistory } from "./History";
import { requestImageGeneration } from "./Image";
import { checkModeration } from "./Moderation";
import { PROP_OPENAI_API_KEY } from "./OpenAIAPI";
import {
    deleteProperty,
    getJSONProperty,
    getProperties,
    getStringProperty,
    setJSONProperty,
    setStringProperty,
} from "./Properties";
import { millisNow } from "./Timestamp";
import { asStringOpt } from "./typeutil";

const COMMAND_PREFIX = "/";
const COMMAND_REGEX = /^\/([A-Za-z_]\w*)(?:\s+(.*)|)$/s;

const DEFAULT_INTRODUCTION =
    "Hi! I'm a chat app. " +
    "I will connect you to OpenAI artificial intelligence based services " +
    "such as the ChatGPT chat completion model and DALL·E image generation " +
    "model. However, this chat app itself is not in any way associated with " +
    "or endorsed by OpenAI.\n\n" +
    "Just send me your input as chat messages. In a group space you must " +
    "mention me with @<chat app name> notation to get my attention. " +
    "For further help, try `/help` or `@<chat app name> /help`.\n\n" +
    "Now let me ask ChatGPT to introduce itself and DALL·E...";

const DEFAULT_INTRODUCTION_PROMPT = "Briefly introduce the ChatGPT and DALL·E to the user.";

const DEFAULT_HELP_TEXT =
    "*Usage instructions*\n" +
    "\n" +
    "```\n" +
    "Usage in a one-to-one chat:\n" +
    "  <chat message>\n" +
    "  /command [arguments...]\n" +
    "\n" +
    "Usage in a group space:\n" +
    "  @<chat app name> <chat message>\n" +
    "  @<chat app name> /command [arguments...]\n" +
    "\n" +
    "Commands:\n" +
    "  /help                    show this help text\n" +
    "  /intro                   replay the chat app introduction\n" +
    "  /image [n=N] <prompt>    create an image based on the prompt\n" +
    "  /again                   regenerate the last chat response or image\n" +
    "  /history [clear]         show or clear chat history\n" +
    "<admin-commands>" +
    "```";

const HELP_TEXT_ADMIN =
    "\n" +
    "Admin commands (only available to admins in a one-to-one chat):\n" +
    "  /init [<initialization>] set or clear chat initialization\n" +
    "  /show [<property>...]    show all or specified properties\n" +
    "  /set <property> <value>  set the specified property\n";

const INVALID_ARGS_MSG = "Invalid command arguments";

/** Property listing admin users */
const PROP_ADMINS = "ADMINS";

const PROP_INTRODUCTION = "INTRODUCTION";
const PROP_INTRODUCTION_PROMPT = "INTRODUCTION_PROMPT";
const PROP_HELP_TEXT = "HELP_TEXT";

const JSON_STRING_PROPS = [PROP_INTRODUCTION, PROP_INTRODUCTION_PROMPT, PROP_HELP_TEXT];

class CommandError extends ChatError {}

class UnauthorizedError extends CommandError {}

/**
 * Checks the specified chat message for a command.
 * If a command is found then returns a response to be returned to the user.
 * Otherwise returns undefined.
 */
export function checkForCommand(event: GoogleChat.OnMessageEvent): GoogleChat.BotResponse {
    // Check if not a command
    const text = event.message?.argumentText;
    if (typeof text !== "string" || !text.trim().startsWith(COMMAND_PREFIX)) {
        return undefined;
    }

    // Otherwise interprete command
    const match = text.trim().match(COMMAND_REGEX);
    if (!match) {
        throw new CommandError('Unrecognized command format, try "/help"');
    }
    const cmd = match[1];
    const arg = match[2];
    if (cmd === "help") {
        return commandHelp(event.message);
    } else if (cmd === "intro") {
        return commandIntro();
    } else if (cmd === "image") {
        return commandImage(arg, event.message);
    } else if (cmd === "again") {
        return commandAgain(arg, event.message);
    } else if (cmd === "history") {
        return commandHistory(arg, event.message);
    } else if (cmd === "init") {
        return commandInit(arg, event.message);
    } else if (cmd === "show") {
        return commandShow(arg, event.message);
    } else if (cmd === "set") {
        return commandSet(arg, event.message);
    } else {
        throw new CommandError("Unrecognized command: " + cmd);
    }
}

/**
 * Checks that the message sending user is a configured admin
 * and that the message was received over a one-to-one chat.
 * Throws an error if this is not the case.
 */
function checkAdmin(message: GoogleChat.Message): void {
    if (message.space.singleUserBotDm !== true) {
        throw new CommandError("This command is only available in a direct messaging chat between an admin and a bot.");
    }
    if (!isAdmin(message)) {
        throw new UnauthorizedError("Unauthorized for this command: " + message.sender.name);
    }
}

/**
 * Returns whether the message sending user is an admin.
 *
 * @param message message
 * @returns whether the message sneding user is an admin
 */
function isAdmin(message: GoogleChat.Message): boolean {
    return getAdmins().includes(message.sender.name);
}

/**
 * Returns the user names that have been configured as admins.
 */
function getAdmins(): string[] {
    const adminsStr = getStringProperty(PROP_ADMINS);
    if (adminsStr && adminsStr.trim()) {
        return adminsStr.trim().split("\\s*[,\\s]\\s*");
    } else {
        return [];
    }
}

/**
 * Command "/help"
 */
function commandHelp(message: GoogleChat.Message): GoogleChat.ResponseMessage {
    return GoogleChat.textResponse(
        getHelpText()
            .replace("<admin-commands>", isAdmin(message) ? HELP_TEXT_ADMIN : "")
            .replaceAll("<chat app name>", getChatAppName())
    );
}

function getHelpText() {
    return asStringOpt(getJSONProperty(PROP_HELP_TEXT)) ?? DEFAULT_HELP_TEXT;
}

/**
 * Command "/intro", also executed when added to a chat
 */
export function commandIntro(): GoogleChat.ResponseMessage {
    // Create the static response
    const introduction = getIntroduction();
    const response = GoogleChat.textResponse(introduction);

    // Ask chat completion to complement the request
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
        // Log the error and just ignore it to show the basic introduction
        logError(err);
    }

    return response;
}

/**
 * Returns the introduction shown when being added to a space.
 */
function getIntroduction(): string {
    return (asStringOpt(getJSONProperty(PROP_INTRODUCTION)) ?? DEFAULT_INTRODUCTION).replaceAll(
        "<chat app name>",
        getChatAppName()
    );
}

/**
 * Returns the introduction prompt provided to the chat completion to obtain a self provided introduction.
 * Use an empty value or "none" to disable.
 */
function getIntroductionPrompt(): string {
    return asStringOpt(getJSONProperty(PROP_INTRODUCTION_PROMPT)) ?? DEFAULT_INTRODUCTION_PROMPT;
}

/**
 * Returns the chat app name for help texts, if configured.
 * Otherwise just returns "<chat app name>".
 */
function getChatAppName(): string {
    return getStringProperty("CHAT_APP_NAME") ?? "<chat app name>";
}

/**
 * Command "/image"
 */
function commandImage(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    const match = arg ? arg.match(/^(?:n=(\d+)\s+)?(.*$)/) : undefined;
    if (match) {
        const nStr = match[1];
        const prompt = match[2]?.trim();
        if (arg && prompt) {
            // Moderation check on prompt
            checkModeration(prompt);

            // Store latest image command for repeat
            const history = getHistory(message, true);
            history.imageCommand = {
                time: millisNow(),
                arg: arg,
            };
            saveHistory(history);

            // Image generation
            return requestImageGeneration(prompt, message.sender.name, nStr ? Number(nStr) : undefined);
        }
    }
    throw new CommandError(INVALID_ARGS_MSG);
}

/**
 * Command "/again"
 */
function commandAgain(arg: string | undefined, message: GoogleChat.Message): GoogleChat.BotResponse {
    // No arguments expected
    if (typeof arg !== "undefined") {
        throw new CommandError(INVALID_ARGS_MSG);
    }

    // Get history as is
    const history = getHistory(message, true);

    // Check if last command was an image
    if (history.imageCommand) {
        return commandImage(history.imageCommand.arg, message);
    }

    // Otherwise remove the last message from history, if it was an assistant response
    if (history.messages.length > 0 && history.messages[history.messages.length - 1].user === USER_ASSISTANT) {
        history.messages.splice(history.messages.length - 1, 1);
    }

    // Request new chat completion
    const completionResponse = requestChatCompletion(history.messages, message.sender.name);

    // Save history with new response
    saveHistory(history);

    return completionResponse;
}

/**
 * Command "/history"
 */
function commandHistory(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    const history = getHistory(message, true);
    if (typeof arg === "string" && arg.trim() === "clear") {
        history.messages = [];
        saveHistory(history);
    } else if (typeof arg !== "undefined") {
        throw new CommandError(INVALID_ARGS_MSG);
    }
    return GoogleChat.textResponse(
        history.messages.length === 0
            ? "Chat history is empty"
            : "*Chat history:*" +
                  history.messages.map(
                      (m) => "\n\n_" + (m.user === USER_ASSISTANT ? "Assistant" : m.user) + ":_\n" + m.text
                  )
    );
}

/**
 * Command "/init"
 */
function commandInit(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    checkAdmin(message);

    // Set initialization sequence
    if (arg?.trim()) {
        const initSeq: ChatCompletionInitialization = [
            {
                role: "user",
                content: arg.trim(),
            },
        ];
        setJSONProperty(PROP_CHAT_COMPLETION_INIT, initSeq);
        return GoogleChat.textResponse(
            "Chat completion initialization sequence:\n```\n" + JSON.stringify(initSeq, null, 2) + "\n```"
        );
    }

    // Or clear it
    else {
        deleteProperty(PROP_CHAT_COMPLETION_INIT);
        return GoogleChat.textResponse("Chat completion initialization sequence cleared");
    }
}

/**
 * Command "/show"
 */
function commandShow(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    checkAdmin(message);

    // Parse arguments
    const props = getProperties();
    let args: string[] = [];
    if (typeof arg === "string") {
        args = arg.trim().split("\\s+");
    }

    // Show all or selected properties
    const shown: string[] = [];
    let response = "";
    Object.keys(props)
        .filter((k) => k !== PROP_OPENAI_API_KEY && !k.startsWith("_") && (args.length == 0 || args.includes(k)))
        .sort()
        .forEach((key) => {
            if (response) {
                response += "\n";
            }
            response += key + ": " + quoteShownValue(key, props[key]);
            shown.push(key);
        });
    args.sort();
    args.forEach((key) => {
        if (!shown.includes(key)) {
            if (response) {
                response += "\n";
            }
            if (typeof props[key] !== "undefined") {
                response += key + " is hidden";
            } else {
                response += key + " is undefined";
            }
        }
    });
    return GoogleChat.textResponse("```\n" + response + "\n```");
}

function quoteShownValue(property: string, value: string) {
    if (JSON_STRING_PROPS.includes(property)) {
        return value
            .replaceAll("\n", "\\n")
            .replaceAll("\r", "\\r")
            .replaceAll("`", "\\u0060")
            .replaceAll("*", "\\u002a")
            .replaceAll("_", "\\u005f");
    } else {
        return value;
    }
}

/**
 * Command "/set"
 */
function commandSet(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    checkAdmin(message);

    // Parse arguments
    let match = null;
    if (arg) {
        match = arg.trim().match(/^([A-Za-z_]\w*)(?:\s+(.*))?$/s);
    }
    if (match) {
        const key = match[1];
        if (key === PROP_OPENAI_API_KEY || key === PROP_ADMINS || key.startsWith(HISTORY_PREFIX)) {
            throw new UnauthorizedError("This property can not be set via chat");
        }
        const value = match.length > 2 && match[2] ? match[2].trim() : undefined;
        if (value) {
            setStringProperty(key, value);
        } else {
            deleteProperty(key);
        }
        return GoogleChat.textResponse("```\n" + key + (value ? ": " + value : " is undefined") + "\n```");
    } else {
        throw new CommandError(INVALID_ARGS_MSG);
    }
}

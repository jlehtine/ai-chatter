import { ChatCompletionInitialization, PROP_CHAT_INIT, requestChatCompletion, USER_ASSISTANT } from "./ChatCompletion";
import { ChatError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getHistory, HISTORY_PREFIX, saveHistory } from "./History";
import { requestImageGeneration } from "./Image";
import { checkModeration } from "./Moderation";
import { PROP_OPENAI_API_KEY } from "./OpenAIAPI";
import { deleteProperty, getProperties, getStringProperty, setObjectProperty, setStringProperty } from "./Properties";

const COMMAND_PREFIX = "/";
const COMMAND_REGEX = /^\/([A-Za-z_]\w*)(?:\s+(.*)|)$/;

const HELP_TEXT =
    "*Usage instructions*\n\
\n\
```\n\
Usage:\n\
  <chat message in a one-to-one chat>\n\
  @<bot name> <chat message in a space>\n\
  /command [arguments...]\n\
  @<bot name> /command [arguments...]\n\
\n\
Commands:\n\
  /help                    show this help text\n\
  /image [n=N] <prompt>    create an image based on the prompt\n\
  /again                   get another chat completion\n\
  /history [clear]         show or clear chat history\n\
\n\
Admin commands:\n\
  /init [<initialization>] set or clear chat initialization\n\
  /show [<property>...]    show all or specified properties\n\
  /set <property> <value>  set the specified property\n\
```";

const INVALID_ARGS_MSG = "Invalid command arguments";

/** Property listing admin users */
const PROP_ADMINS = "ADMINS";

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
        return commandHelp();
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
    const admins = getAdmins();
    if (!admins.includes(message.sender.name)) {
        throw new UnauthorizedError("Unauthorized for this command: " + message.sender.name);
    }
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
function commandHelp(): GoogleChat.ResponseMessage {
    return GoogleChat.textResponse(HELP_TEXT);
}

/**
 * Command "/image"
 */
function commandImage(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    const match = arg ? arg.match(/^(?:n=([0-9]+)\s+)?(.*$)/) : undefined;
    if (match) {
        const nStr = match[1];
        const prompt = match[2]?.trim();
        if (prompt) {
            checkModeration(prompt);
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

    // Get history without last reponse, if it was from the bot
    const history = getHistory(message, true);
    if (history.messages.length > 0 && history.messages[history.messages.length - 1].user === USER_ASSISTANT) {
        history.messages.splice(history.messages.length - 1, 1);
    }

    // Request new chat completion
    const completionResponse = requestChatCompletion(history, message.sender.name);

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
        setObjectProperty(PROP_CHAT_INIT, initSeq);
        return GoogleChat.textResponse(
            "Chat completion initialization sequence:\n```\n" + JSON.stringify(initSeq, null, 2) + "\n```"
        );
    }

    // Or clear it
    else {
        deleteProperty(PROP_CHAT_INIT);
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
            response += key + ": " + props[key];
            shown.push(key);
        });
    args.sort().forEach((key) => {
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

/**
 * Command "/set"
 */
function commandSet(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    checkAdmin(message);

    // Parse arguments
    let match = null;
    if (arg) {
        match = arg.trim().match(/^([A-Za-z_]\w*)(?:\s+(.*))?$/);
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

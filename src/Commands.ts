import { PROP_OPENAI_API_KEY } from "./ChatGPT";
import { ChatError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getHistory, HISTORY_PREFIX, saveHistory } from "./History";
import { deleteProperty, getProperties, getStringProperty, setStringProperty } from "./Properties";

const COMMAND_PREFIX = "/";
const COMMAND_REGEX = /^\/([A-Za-z_]\w*)(?:\s+(.*)|)$/;

const HELP_TEXT =
    "*Usage instructions*\n\
\n\
```\n\
Usage:\n\
  /command [arguments...]\n\
\n\
Commands:\n\
  /help                    show this help text\n\
  /history [clear]         show or clear chat history\n\
  /show [<property>...]    show all or specified properties\n\
  /set <property> <value>  set the specified property\n\
```";

/** Property listing admin users */
const PROP_ADMINS = "ADMINS";

class CommandError extends ChatError {}

class UnauthorizedError extends CommandError {}

/**
 * Checks the specified chat message for a command.
 * If a command is found then returns a response to be returned to the user.
 * Otherwise returns undefined.
 */
export function checkForCommand(event: GoogleChat.OnMessageEvent): GoogleChat.ResponseMessage | undefined {
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
    } else if (cmd === "history") {
        return commandHistory(arg, event.message);
    } else if (cmd === "show") {
        return commandShow(arg, event.message);
    } else if (cmd === "set") {
        return commandSet(arg, event.message);
    } else {
        throw new CommandError("Unrecognized command: " + cmd);
    }
}

function checkAdmin(message: GoogleChat.Message): void {
    if (message.space.singleUserBotDm !== true) {
        throw new CommandError("This command is only available in a direct messaging chat between an admin and a bot.");
    }
    const admins = getAdmins();
    if (!admins.includes(message.sender.name)) {
        throw new UnauthorizedError("Unauthorized for this command: " + message.sender.name);
    }
}

function getAdmins(): string[] {
    const adminsStr = getStringProperty(PROP_ADMINS);
    if (adminsStr && adminsStr.trim()) {
        return adminsStr.trim().split("\\s*[,\\s]\\s*");
    } else {
        return [];
    }
}

function commandHelp(): GoogleChat.ResponseMessage {
    return GoogleChat.textResponse(HELP_TEXT);
}

function commandHistory(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    const history = getHistory(message, true);
    if (typeof arg === "string" && arg.trim() === "clear") {
        history.messages = [];
        saveHistory(history);
    } else if (typeof arg !== "undefined") {
        throw new CommandError("Invalid command arguments");
    }
    return GoogleChat.textResponse("```\n" + JSON.stringify(history, null, 2).replace("```", "") + "\n```");
}

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
        throw new CommandError("Invalid command arguments");
    }
}

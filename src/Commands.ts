import { ChatError } from "./Errors";
import * as GoogleChat from "./GoogleChat";
import { getHistory, saveHistory } from "./History";

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
  /help                show this help text\n\
  /history [clear]     show or clear chat history\n\
```";

class CommandError extends ChatError {}

/**
 * Checks the specified chat message for a command.
 * If a command is found then returns a response to be returned to the user.
 * Otherwise returns undefined.
 */
export function checkForCommand(event: GoogleChat.OnMessageEvent): GoogleChat.ResponseMessage | undefined {
    // Check if not a command
    const text = event.message?.text;
    if (typeof text !== "string" || !text.trim().startsWith(COMMAND_PREFIX)) {
        return undefined;
    }

    // Otherwise interprete command
    const match = text.trim().match(COMMAND_REGEX);
    if (!match) {
        throw new CommandError('Unrecognized command format, try "/help"');
    }
    const cmd = match[1].toLowerCase();
    const arg = match[2];
    if (cmd === "help") {
        return commandHelp(arg);
    } else if (cmd === "history") {
        return commandHistory(arg, event.message);
    } else {
        throw new CommandError("Unrecognized command: " + cmd);
    }
}

function commandHelp(arg: string | undefined): GoogleChat.ResponseMessage {
    return GoogleChat.textResponse(HELP_TEXT);
}

function commandHistory(arg: string | undefined, message: GoogleChat.Message): GoogleChat.ResponseMessage {
    const history = getHistory(message, true);
    if (typeof arg === "string" && arg.trim().toLowerCase() === "clear") {
        history.messages = [];
        saveHistory(history);
    } else if (typeof arg !== "undefined") {
        throw new CommandError("Invalid command arguments");
    }
    return GoogleChat.textResponse("```\n" + JSON.stringify(history, null, 2).replace("```", "") + "\n```");
}

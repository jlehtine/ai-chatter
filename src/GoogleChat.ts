// Google Chat types

export interface Event {
  message?: Message;
  user?: User;
  space?: Space;
  common?: CommonEventObject;
}

export interface OnMessageEvent {
  message: Message;
  user: User;
  space: Space;
  common: CommonEventObject;
}

export interface OnSpaceEvent {
  space: Space;
}

export interface CommonEventObject {
  userLocale: string;
}

export interface Message {
  name: string;
  sender: User;
  createTime: string;
  text: string;
  thread: Thread;
  space: Space;
  fallbackText: string;
  argumentText: string;
  slashCommand?: SlashCommand;
}

export interface ResponseMessage {
  text: string;
}

export type BotResponse = ResponseMessage | void;

export interface User {
  name: string;
  displayName: string;
  domainId: string;
  type: UserType;
}

export type UserType = "TYPE_UNSPECIFIED" | "HUMAN" | "BOT";

export interface Thread {
  name: string;
}

export interface Space {
  singleUserBotDm: boolean;
  name: string;
}

export interface SlashCommand {
  commandId: string;
}

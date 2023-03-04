import { MillisSinceEpoch } from "./Timestamp";

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
  createTime: ChatTime;
  text: string;
  thread: Thread;
  space: Space;
  fallbackText: string;
  argumentText: string;
}

export interface ChatTime {
  seconds: number;
  nanos: number;
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
  name: string;
  singleUserBotDm: boolean;
  spaceThreadingState: SpaceThreadingState;
}

export type SpaceThreadingState =
  | "SPACE_THREADING_STATE_UNSPECIFIED"
  | "THREADED_MESSAGES"
  | "GROUPED_MESSAGES"
  | "UNTHREADED_MESSAGES";

/**
 * Converts the specified chat time to seconds since epoch.
 */
export function toMillisSinceEpoch(time: ChatTime): MillisSinceEpoch {
  return time.seconds * 1000 + time.nanos / 1000000;
}

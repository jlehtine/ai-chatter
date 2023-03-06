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
    text?: string;
    cardsV2?: Card[];
    fallbackText?: string;
}

export interface Card {
    cardId: string;
    card: CardContent;
}

export interface CardContent {
    header?: CardHeader;
    sections?: CardSection[];
}

export interface CardHeader {
    title: string;
    subtitle?: string;
}

export interface CardSection {
    header: string;
    widgets: CardWidget[];
    collapsible?: boolean;
}

export type CardWidget = TextParagraphWidget | ImageWidget | DecoratedTextWidget | DividerWidget;

export interface TextParagraphWidget {
    textParagraph: TextParagraph;
}

export interface ImageWidget {
    image: Image;
}

export interface DecoratedTextWidget {
    decoratedText: DecoratedText;
}

export interface DividerWidget {
    divider: object;
}

export interface TextParagraph {
    text: string;
}

export interface Image {
    imageUrl: string;
    altText?: string;
}

export interface DecoratedText {
    topLabel?: string;
    text: string;
    wrapText?: boolean;
    bottomLabel?: string;
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

/**
 * Returns a simple text response message.
 */
export function textResponse(text: string): ResponseMessage {
    return { text: text };
}

/**
 * Returns a response that displays a card with decorated text and a header.
 */
export function decoratedTextResponse(
    cardId: string,
    header: string,
    text: string,
    formattedHeader?: string
): ResponseMessage {
    const message: ResponseMessage = {
        fallbackText: header + ": " + text,
    };
    addDecoratedTextCard(message, cardId, header, text, formattedHeader);
    return message;
}

/**
 * Adds a card with a decorated text section to the specified message.
 */
export function addDecoratedTextCard(
    message: ResponseMessage,
    cardId: string,
    header: string,
    text: string,
    formattedHeader?: string
): void {
    if (!message.cardsV2) {
        message.cardsV2 = [];
    }
    message.cardsV2.push({
        cardId: cardId,
        card: {
            sections: [
                {
                    header: formattedHeader ?? header,
                    widgets: [
                        {
                            decoratedText: {
                                text: text,
                                wrapText: true,
                            },
                        },
                    ],
                    collapsible: false,
                },
            ],
        },
    });
}

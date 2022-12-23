import { MessageType } from "../types";

export abstract class GenericRecord<T, U> {

  constructor(private messageType: MessageType) { }

  abstract getData(): T;
  protected abstract getBody(): string;

  public getMessageType() {
    return this.messageType;
  }

  protected parse(): T {
    const body = this.getBody();

    switch (this.messageType) {
      case MessageType.Binary:
        return Buffer.from(body, 'base64') as T;

      case MessageType.Number:
        return parseFloat(body) as T;

      case MessageType.String:
        return body as T;

      case MessageType.Object:
        return JSON.parse(body);

      default:
        throw new Error("No message type set");
    }
  }
}
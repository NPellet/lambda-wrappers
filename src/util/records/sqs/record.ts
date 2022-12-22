import { SQSBatchItemFailure, SQSRecord } from 'aws-lambda';
import { GenericRecord } from '../generic';
import { MessageType } from '../../types';

export class AwsSQSRecord<T> extends GenericRecord<T, SQSRecord> {

  private data: T;

  constructor(private record: SQSRecord, messageType: MessageType) {
    super(messageType);
  }

  protected getBody() {
    return this.record.body;
  }

  getRawRecord() {
    return this.record;
  }

  getMessageId() {
    return this.record.messageId;
  }

  public getData(): T {
    if (this.data) {
      return this.data;
    }

    this.data = this.parse() as T;
    return this.data;
  }
}

export const failSQSRecord = <T>(
  record: AwsSQSRecord<T>
): SQSBatchItemFailure => {
  return {
    itemIdentifier: record.getMessageId(),
  };
};

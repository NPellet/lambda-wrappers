import { SQSBatchItemFailure, SQSRecord } from 'aws-lambda';
import { BaseSchema } from 'yup';
import { log } from '../../lambda/utils/logger';
import { recordException } from '../exceptions';

export class AwsSQSRecord<T> {
  constructor(private record: SQSRecord) {}
  private data: T;
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
    if (this.record.messageAttributes.type?.stringValue === 'string') {
      return (this.data = this.record.body as T);
    }

    if (this.record.messageAttributes.type?.stringValue === 'binary') {
      return (this.data = Buffer.from(this.record.body, 'base64') as T);
    }

    this.data = JSON.parse(this.record.body) as T;
    return this.data as T;
  }
}

export const failSQSRecord = <T>(
  record: AwsSQSRecord<T>
): SQSBatchItemFailure => {
  return {
    itemIdentifier: record.getMessageId(),
  };
};

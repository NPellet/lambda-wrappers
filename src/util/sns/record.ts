import { SNSEventRecord, SQSBatchItemFailure, SQSRecord } from 'aws-lambda';
import { BaseSchema } from 'yup';
import { log } from '../../lambda/utils/logger';
import { recordException } from '../exceptions';

export class AwsSNSRecord<T> {
  constructor(private record: SNSEventRecord) {}
  private data: T;
  getRawRecord() {
    return this.record;
  }

  public getMessageId() {
    return this.record.Sns.MessageId;
  }

  public getData(): T {
    if (this.data) {
      return this.data;
    }
    if (this.record.Sns.MessageAttributes.type?.Value === 'string') {
      return (this.data = this.record.Sns.Message as T);
    }

    if (this.record.Sns.MessageAttributes.type?.Value === 'binary') {
      return (this.data = Buffer.from(this.record.Sns.Message, 'base64') as T);
    }

    this.data = JSON.parse(this.record.Sns.Message) as T;
    return this.data as T;
  }
}

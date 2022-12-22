import { SNSEventRecord, SQSBatchItemFailure, SQSRecord } from 'aws-lambda';
import { BaseSchema } from 'yup';
import { log } from '../../../lambda/utils/logger';
import { recordException } from '../../exceptions';
import { MessageType } from '../../types';
import { GenericRecord } from '../generic';

export class AwsSNSRecord<T> extends GenericRecord<T, SNSEventRecord> {
  constructor(private record: SNSEventRecord, messageType: MessageType) {

    super( messageType )
  }
  private data: T;

  protected getBody() {
    return this.record.Sns.Message
  }
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


    this.data = this.parse();
    return this.data as T;
  }
}

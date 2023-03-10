import { EventBridgeEvent } from 'aws-lambda';
import { GenericRecord } from '../generic';
import { MessageType } from '../../types';

export class AwsEventBridgeEvent<T> extends GenericRecord<T, EventBridgeEvent<string,T>>{
  validatedData: T;
  public constructor(private data: EventBridgeEvent<string, T>) {
    super( MessageType.Object )
  }

  protected getBody(): string {
    return ""
  }
  
  protected parse() {
    return this.data.detail;
  }

  public getData(): T {
    return this.data.detail;
  }

  public getSource() {
    return this.data.source;
  }

  public getDetailType() {
    return this.data['detail-type'];
  }

  public getRawData() {
    return this.data;
  }
  
  public getRawRecord() {
    return this.getRawData();
  }
}

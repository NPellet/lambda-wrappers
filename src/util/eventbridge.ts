import { APIGatewayProxyEvent, EventBridgeEvent } from 'aws-lambda';
import { BaseSchema, ObjectSchema } from 'yup';
import { log } from '../lambda/utils/logger';

export class AwsEventBridgeEvent<T> {
  validatedData: T;
  public constructor(private data: EventBridgeEvent<string, T>) {}

  public getData(): T {
    return this.data.detail;
  }

  public getSource() {
    return this.data.source;
  }

  public getDetailType() {
    return this.data['detail-type'];
  }
}

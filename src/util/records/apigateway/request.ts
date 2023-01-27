import { APIGatewayProxyEvent } from 'aws-lambda';
import { MessageType } from '../../types';
import { GenericRecord } from '../generic';

//declare const awsQuery: APIGatewayProxyEvent;

export class Request<T> extends GenericRecord<T, string> {
  private data: T | undefined;

  public constructor(
    private rawData: APIGatewayProxyEvent,
    messageType: MessageType
  ) {

    super( messageType )
  }

  public getRawData() {
    return this.rawData;
  }
  
  public getRawRecord() {
    return this.getRawData();
  }

  public getBody(): string {
    return this.rawData.body || ""
  }

  public getData(): T {
    if (this.data) return this.data;

    this.data = this.parse();
    return this.data;

    /*
    // typeis.(awsQuery, ['json']);
    const contentType =
      this.headers['Content-Type'] || this.headers['content-type'];

    if (contentType?.split('/')[0] === 'text') {
      this.data = this.rawData as T;
    }

    if (contentType === 'application/json' && this.rawData) {
      this.data = JSON.parse(this.rawData) as T;
    }

    return this.rawData as T;
    */
  }

  public getPathParameters(): Record<string, string | undefined> {
    return this.rawData.pathParameters || {};
  }

  public getQueryParameters(): Record<string, unknown> {
    return this.rawData.queryStringParameters || {};
  }

  public getHeaders(): Record<string, string | undefined> {
    return this.rawData.headers;
  }
}

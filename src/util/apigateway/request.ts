import { BaseSchema, NumberSchema, ObjectSchema, StringSchema } from 'yup';

//declare const awsQuery: APIGatewayProxyEvent;

export class Request<T> {
  private validator: BaseSchema | undefined;
  private data: T | undefined;

  public constructor(
    private rawData: string | null,
    private headers: Record<string, string | undefined> = {},
    private pathParameters: Record<string, string | undefined> | null = {},
    private queryParameters: Record<string, unknown> | null = {}
  ) {}

  public getRawData(): string | null {
    return this.rawData;
  }

  public getData(): T {
    if (this.data) return this.data;

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
  }

  public getPathParameters(): Record<string, string | undefined> {
    return this.pathParameters || {};
  }

  public getQueryParameters(): Record<string, unknown> {
    return this.queryParameters || {};
  }

  public getHeaders(): Record<string, string | undefined> {
    return this.headers;
  }
}

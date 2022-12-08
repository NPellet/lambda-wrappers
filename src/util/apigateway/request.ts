import { BaseSchema, NumberSchema, ObjectSchema, StringSchema } from 'yup';
import { log } from '../../lambda/utils/logger';

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

    const contentType = this.headers['Content-Type'];

    if (contentType?.split('/')[0] === 'text') {
      this.data = this.rawData as T;
    }

    if (contentType === 'application/json' && this.rawData) {
      this.data = JSON.parse(this.rawData) as T;
    }

    return this.data as T;
  }

  public getPathParameters(): Record<string, string | undefined> {
    return this.pathParameters || {};
  }

  public getQueryParameters(): Record<string, unknown> {
    return this.queryParameters || {};
  }

  public getHeaders(): Record<string, string | undefined> {
    return this.headers || {};
  }

  protected setValidator(validator: BaseSchema | undefined) {
    this.validator = validator;
  }
}

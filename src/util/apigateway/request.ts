import { ObjectSchema } from "yup";
import { log } from "../../lambda/utils/logger";

export class Request<T> {
  private validator: ObjectSchema<any> | undefined;
  private data: T | undefined;

  public constructor(
    private rawData: string,
    private headers: Record<string, string> = {},
    private pathParameters: Record<string, string> = {},
    private queryParameters: Record<string, unknown> = {}
  ) {}

  public getRawData(): string {
    return this.rawData;
  }

  public async getData(): Promise<T> {
    if (this.data) return this.data;

    this.data = JSON.parse(this.rawData) as T;

    if (this.validator) {
      log.debug("Trying to validate API Gateway body");
      await this.validator.validate(this.data);
    }
    return this.data;
  }

  public getPathParameters(): Record<string, string> {
    return this.pathParameters;
  }

  public getQueryParameters(): Record<string, unknown> {
    return this.queryParameters;
  }

  public getHeaders(): Record<string, string> {
    return this.headers;
  }

  protected setValidator(validator: ObjectSchema<any>) {
    this.validator = validator;
  }
}

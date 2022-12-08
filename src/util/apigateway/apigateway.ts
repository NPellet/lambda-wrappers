import { APIGatewayProxyEvent } from "aws-lambda";
import { BaseSchema, ObjectSchema } from "yup";
import { Request } from "./request";

export class AwsApiGatewayRequest<T> extends Request<T> {
  constructor(private event: APIGatewayProxyEvent) {
    super(
      event.body,
      event.headers,
      event.pathParameters,
      event.queryStringParameters
    );
  }

  public getOriginalData() {
    return this.event;
  }
}

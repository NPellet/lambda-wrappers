import { APIGatewayProxyEvent, EventBridgeEvent } from "aws-lambda";
import { BaseSchema, ObjectSchema } from "yup";
import { log } from "../lambda/utils/logger";

export class AwsEventBridgeEvent<T> {
  validatedData: T;
  public constructor(
    private data: EventBridgeEvent<string, T>,
    private validator: BaseSchema | undefined
  ) {}

  public async getData(): Promise<T> {
    if (this.validatedData) return this.validatedData;

    this.validatedData = this.data.detail;

    if (this.validator) {
      log.debug("Trying to validate Event bridge data");
      await this.validator.validate(this.data.detail);
    }

    return this.data.detail;
  }

  public getSource() {
    return this.data.source;
  }

  public getDetailType() {
    return this.data["detail-type"];
  }

  protected setValidator(validator: ObjectSchema<any>) {
    this.validator = validator;
  }
}

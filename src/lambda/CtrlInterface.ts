import { SQSBatchItemFailure } from "aws-lambda";
import { AwsEventBridgeEvent } from "../util/eventbridge";
import { Request } from "../util/records/apigateway/request";
import { HTTPError, HTTPResponse } from "../util/records/apigateway/response";
import { AwsSNSRecord } from "../util/records/sns/record";
import { AwsSQSRecord } from "../util/records/sqs/record";
import { TOrSchema } from "../util/types";
import { APIGatewayHandlerWrapperFactory } from "./ApiGateway/ControllerFactory";
import { EventBridgeHandlerWrapperFactory } from "./EventBridge/ControllerFactory";
import { SNSHandlerWrapperFactory } from "./SNS/ControllerFactory";
import { SQSHandlerWrapperFactory } from "./SQS/ControllerFactory";

export type CtrlInterfaceOf<T> = T extends SQSHandlerWrapperFactory<
    infer TInput,
    any,
    infer TSecrets,
    infer THandler,
    infer SInput
>
    ? {
        [x in THandler]: (
            payload: AwsSQSRecord<TOrSchema<TInput, SInput>>,
            secrets: Record<TSecrets, string>
        ) => Promise<void | SQSBatchItemFailure>;
    }
    : (

        T extends SNSHandlerWrapperFactory<
            infer TInput,
            any,
            infer TSecrets,
            infer THandler,
            infer SInput
        >
        ? {
            [x in THandler]: (
                payload: AwsSNSRecord<TOrSchema<TInput, SInput>>,
                secrets?: Record<TSecrets, string | undefined>
            ) => Promise<void>;
        }
        : (
            T extends EventBridgeHandlerWrapperFactory<
                infer TInput,
                any,
                infer TSecrets,
                infer THandler,
                infer SInput
            >
            ? {
                [x in THandler]: (
                    payload: AwsEventBridgeEvent<TOrSchema<TInput, SInput>>,
                    secrets: Record<TSecrets, string>
                ) => Promise<void>;
            }
            : (
                T extends APIGatewayHandlerWrapperFactory<
                    infer TInput,
                    infer TOutput,
                    any,
                    infer TSecrets,
                    infer THandler,
                    infer SInput,
                    infer SOutput
                >
                ? {
                    [x in THandler]: (
                        payload: Request<TOrSchema<TInput, SInput>>,
                        secrets: Record<TSecrets, string>
                    ) => Promise<HTTPResponse<TOrSchema<TOutput, SOutput>> | HTTPError>;
                }
                : never
            )
        )

    );


import { BaseSchema, InferType } from 'yup';
import { HTTPError, Request, Response } from '../lambda';
import { AwsEventBridgeEvent } from './eventbridge';
import { AwsSNSRecord } from './sns/record';
import { AwsSQSRecord } from './sqs/record';

export type ConstructorOf<T> = {
  init(secrets?: Record<string, string>): Promise<T>;
};
export type TOrSchema<T, U> = unknown extends T
  ? U extends BaseSchema
    ? InferType<U>
    : unknown
  : T;
/*
export type RequestOf<T> = T extends {
  _inputSchema: infer S;
  __shimInput: infer T;
}
  ? Request<TOrSchema<T, S>>
  : never;

export type ResponseOf<T, H extends string> = T extends {
  _inputSchema: infer S;
  __shimInput: infer T;
}
  ? HTTPError | Response<TOrSchema<T, S>>
  : never;

export type EventOf<T> = T extends {
  _inputSchema: infer S;
  __shimInput: infer T;
}
  ? AwsEventBridgeEvent<TOrSchema<T, S>>
  : never;

export type SQSRecordOf<T> = T extends {
  _inputSchema: infer S;
  __shimInput: infer T;
}
  ? AwsSQSRecord<TOrSchema<T, S>>
  : never;

export type SNSRecordOf<T> = T extends {
  _inputSchema: infer S;
  __shimInput: infer T;
}
  ? AwsSNSRecord<TOrSchema<T, S>>
  : never;
*/
export type PayloadOf<T, M extends string> = T extends {
  [x in M]: (payload: infer U, _secrets: any) => any;
}
  ? U
  : never;

export type SecretsOf<T, M extends string> = T extends {
  [x in M]: (payload: any, _secrets: infer U) => any;
}
  ? U
  : never;

export type ReplyOf<T, M extends string> = T extends {
  [x in M]: (payload: any, _secrets: any) => infer U;
}
  ? U
  : never;

export type IfHandler<T> = T extends {
  [x: string]: (A: infer U, B: infer V) => infer W;
}
  ? (a: U, b: V) => W
  : never;

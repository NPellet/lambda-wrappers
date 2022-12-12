import { BaseSchema, InferType } from 'yup';
import { HTTPError, Request, Response } from '../lambda';
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

export type SecretsOf<T> = T extends {
  _secrets: Record<infer U, any>;
}
  ? Record<U, string>
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

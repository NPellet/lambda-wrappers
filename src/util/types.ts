import { BaseSchema, InferType } from 'yup';
import { HTTPError, Response } from '../lambda';

export type ConstructorOf<T> = {
  init(secrets?: Record<string, string>): Promise<T>;
};
export type TOrSchema<T, U> = unknown extends T
  ? U extends BaseSchema
    ? InferType<U>
    : unknown
  : T;

export type RequestOf<T> = T extends abstract new () => {
  handle(a: infer U, ...args: any[]): any;
}
  ? U
  : never;

export type ResponseOf<T> = T extends abstract new () => {
  handle(...args: any): HTTPError | Response<infer U>;
}
  ? U
  : never;

export type SecretsOf<T> = T extends abstract new () => {
  handle(_: any, secrets: infer U): any;
}
  ? U
  : never;

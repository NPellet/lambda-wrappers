import { BaseSchema, InferType } from 'yup';

export type ConstructorOf<T> = {
  init(secrets: Record<string, string | undefined>): Promise<T>;
};

export type InstanceOf<T> = T extends ConstructorOf<infer U> ? U : never;
export type TOrSchema<T, U> = unknown extends T
  ? U extends BaseSchema
    ? InferType<U>
    : unknown
  : T;

export enum MessageType {
  Object,
  String,
  Number,
  Binary,
}

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

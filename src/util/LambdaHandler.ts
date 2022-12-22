import {
  Callback,
  Context,
} from 'aws-lambda';
import { SecretsRecord } from '../lambda/utils/secrets_manager';

export abstract class BaseLambdaHandler<T, U> {
  public isInit: boolean = false;

  abstract init(): Promise<void>;
  abstract handler(event: T, context: Context): Promise<U>;
}

export type LambdaInitSecretHandler<T, TInit, TSecrets extends string, V> = (
  data: T,
  //errorBag: ErrorBag,
  init: TInit,
  secrets: SecretsRecord<TSecrets>,
  context: Context,
  callback: Callback<any>
) => Promise<V> | void;

export type LambdaSecretsHandler<T, TSecrets extends string, V> = (
  data: T,
  secrets: SecretsRecord<TSecrets>,
  context: Context
) => Promise<V>;

export type LambdaContext<T> = Context & { originalData: T };

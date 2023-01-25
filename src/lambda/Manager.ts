import { APIGatewayHandlerWrapperFactory } from './ApiGateway/ControllerFactory';
import { EventBridgeHandlerWrapperFactory } from './EventBridge/ControllerFactory';
import { SNSHandlerWrapperFactory } from './SNS/ControllerFactory';
import { SQSHandlerWrapperFactory } from './SQS/ControllerFactory';
import {
  METABase,
  SecretFetchCfg,
  SecretsContentOf,
  TAllSecretRefs,
  TSecretRef,
} from './utils/secrets_manager';
import { NodeOptions } from '@sentry/node';
import { SourceConfig } from './config';

type awsPreSecret = {
  secret: string;
  required: boolean;
  secretKey?: string;
};

export type SecretFetcher<
  KEYS extends string,
  META extends METABase,
  AWSKEYS extends string = string
> = (
  secretsToFetch: SecretFetchCfg<KEYS, META>,
  awsSecrets: Partial<Record<AWSKEYS, string>>
) => Promise<Partial<Record<KEYS, string>>>;




export class LambdaFactoryManager<T extends TAllSecretRefs, V extends Record<string, (...args: any ) => Promise<void>> = {}> {
  runtimeCfg: SourceConfig | undefined = undefined;
  sentryCfg: NodeOptions = {};
  secretFetchers: Record<keyof T, SecretFetcher<string, any>>;
  preSecrets: Record<keyof T, awsPreSecret>;
  validations: V;

  constructor() {}

  public async init() {}

  public setRuntimeConfig(cfg: SourceConfig) {
    this.runtimeCfg = cfg;
    return this;
  }

  public setAWSSecrets<U extends TSecretRef>(_: U) {
    type AWS = {
      aws: {
        lst: U;
        src: undefined;
      };
    };
    type N = string extends keyof T ? AWS : T & AWS;
    const newMgr = new LambdaFactoryManager<N>();
    newMgr.sentryCfg = this.sentryCfg;
    newMgr.runtimeCfg = this.runtimeCfg;
    // @ts-ignore
    newMgr.secretFetchers = this.secretFetchers;

    return newMgr;
  }

  public addSecretSource<P extends METABase>() {
    const needsAWSSecret = <
      U extends keyof T['aws']['lst'],
      V extends SecretsContentOf<'aws', U, T> | undefined
    >(
      k: U,
      v: V,
      required: boolean = true
    ) => {
      return {
        secret: k,
        secretKey: v,
        required,
      };
    };
    const _self = this;

    return function <
      V extends string,
      Z extends string,
      U extends TSecretRef,
      W extends { [x in Z & string]: awsPreSecret }
    >(
      sourceName: V,
      _: U,
      awsFetcher: undefined | ((aws: typeof needsAWSSecret) => W),
      fetcher: SecretFetcher<string, P, keyof W & string>
    ): 'aws' extends V ? never : typeof newMgr {
      if (sourceName === 'aws') {
        throw new Error("Source name can't be 'aws'. Reserved keyword");
      }

      const secrets = awsFetcher?.(needsAWSSecret) || {};

      const newMgr = new LambdaFactoryManager<
        T & {
          [k in V]: {
            lst: U;
            src: P;
          };
        }
      >();
      newMgr.sentryCfg = _self.sentryCfg;
      newMgr.secretFetchers = {
        ..._self.secretFetchers,
        [sourceName]: fetcher,
      };
      newMgr.preSecrets = { ..._self.preSecrets, [sourceName]: secrets };
      newMgr.runtimeCfg = _self.runtimeCfg;

      //@ts-ignore // TODO: Find whether static asserts might exist in typescript ?
      return newMgr;
    };
  }


public addValidation<U extends string, Z extends (...args: any[]) => boolean>( methodName: U, validationMethod: Z ) {

  const newMgr = new LambdaFactoryManager<T, V & { [T in U]: Z }>();
  newMgr.runtimeCfg = this.runtimeCfg;
  newMgr.preSecrets = this.preSecrets;
  newMgr.secretFetchers = this.secretFetchers;
  newMgr.sentryCfg = this.sentryCfg;

  newMgr.validations = { ...this.validations, [ methodName ]: validationMethod }
  
  return newMgr;
}

  public configureSentry(sentryOptions: NodeOptions, expand: boolean = true) {
    if (expand) {
      Object.assign(this.sentryCfg, sentryOptions);
    } else {
      this.sentryCfg = sentryOptions;
    }

    return this;
  }

  /**
   * Sets Sentry's DSN. Shorthand for calling `configureSentry` with a DSN entry
   * @param dsn
   */
  public configureSentryDSN(dsn: string) {
    this.configureSentry({ dsn }, true);
    return this;
  }

  /**
   * Disable Sentry for the wrappers created by this manager
   */
  public disableSentry() {
    this.configureSentry({ enabled: false }, true);
    return this;
  }

  public apiGatewayWrapperFactory<U extends string>(handler: U) {
    const wrapper = new APIGatewayHandlerWrapperFactory<
      any,
      any,
      T,
      string,
      U,
      undefined,
      V
    >(this);

    return wrapper.setHandler(handler);
  }

  public eventBridgeWrapperFactory<U extends string>(handler: U) {
    const wrapper = new EventBridgeHandlerWrapperFactory<
      any,
      T,
      string,
      U,
      undefined
    >(this);
    return wrapper.setHandler(handler);
  }

  public sqsWrapperFactory<U extends string>(handler: U) {
    const wrapper = new SQSHandlerWrapperFactory<any, T, string, U, undefined>(
      this
    );
    return wrapper.setHandler(handler);
  }

  public snsWrapperFactory<U extends string>(handler: U) {
    const wrapper = new SNSHandlerWrapperFactory<any, T, string, U, undefined>(
      this
    );
    return wrapper.setHandler(handler);
  }
}

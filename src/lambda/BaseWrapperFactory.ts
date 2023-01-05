import {
  SecretConfig,
  TAllSecretRefs,
  TSecretRef,
} from './utils/secrets_manager';
import type { LambdaFactoryManager } from './Manager';
import { AWSLambda } from '@sentry/serverless';
import { MessageType } from '../util/types';
import { BaseSchema, NumberSchema, ObjectSchema, StringSchema } from 'yup';
import { HandlerConfiguration, SourceConfig } from './config';
import _ from 'lodash';
import { defaultSourceConfig } from '../util/defaultConfig';

export abstract class BaseWrapperFactory<TSecretList extends TAllSecretRefs> {
  private _disableSentry: boolean;
  protected _messageType: MessageType;
  runtimeCfg: SourceConfig;

  constructor(protected mgr: LambdaFactoryManager<TSecretList>) {}

  protected fork(newEl: BaseWrapperFactory<TSecretList>) {
    newEl._disableSentry = this._disableSentry;
    newEl._messageType = this._messageType;
  }

  public sentryDisable() {
    this._disableSentry = true;
    return this;
  }

  protected _configureRuntime(cfg: SourceConfig) {
    this.runtimeCfg = cfg;
    return this;
  }

  protected sentryIsEnabled() {
    return !this._disableSentry && !('DISABLE_SENTRY' in process.env);
  }

  protected setMessageTypeFromSchema(schema: BaseSchema) {
    if (schema instanceof StringSchema) {
      this._messageType = MessageType.String;
    } else if (schema instanceof NumberSchema) {
      this._messageType = MessageType.Number;
    } else if (schema instanceof ObjectSchema) {
      this._messageType = MessageType.Object;
    }
  }

  protected expandConfiguration<IF, SInput, SOutput, TSecrets extends string>(
    cfg: HandlerConfiguration<IF, SInput, SOutput, TSecrets>
  ): HandlerConfiguration<IF, SInput, SOutput, TSecrets> {
    const secrets = cfg.secretInjection;
    const expandedSecrets = this.expandSecrets(secrets);

    return {
      ...cfg,
      secretInjection: expandedSecrets,
      sources: _.defaultsDeep(
        {},
        this.runtimeCfg,
        this.mgr.runtimeCfg,
        defaultSourceConfig
      ),
    };
  }
  /**
   * Adds pre-secrets to the list of user-defined secrets
   * @param secretsIn The secrets defined by the needsSecret() calls
   * @returns A list of expanded secrets (input secrets + necessary secrets to prefetch)
   */
  protected expandSecrets(
    secretsIn: Record<string, SecretConfig<any>> | undefined
  ) {
    const sources = new Set<string>();

    if (!secretsIn) {
      return {};
    }

    for (let i in secretsIn) {
      const source = secretsIn[i].source;
      if (!source || source === 'aws') {
        continue;
      }

      sources.add(source);
    }

    const secrets = Object.assign({}, secretsIn);
    if (this.mgr.preSecrets) {
      for (let source of sources.values()) {
        Object.assign(secrets, this.mgr.preSecrets[source] || {});
      }
    }
    return secrets;
  }

  protected async init() {
    if (this.sentryIsEnabled()) {
      AWSLambda.init(this.mgr.sentryCfg);
    }
  }
}

import {
  SecretConfig,
  TAllSecretRefs,
} from './utils/secrets_manager';
import { LambdaFactoryManager } from './Manager';
import { AWSLambda } from '@sentry/serverless';
import { MessageType, TValidationMethod, TValidationMethodBase, TValidationsBase } from '../util/types';
import { BaseSchema, NumberSchema, ObjectSchema, StringSchema } from 'yup';
import { HandlerConfiguration, SourceConfig } from './config';
import _ from 'lodash';
import { defaultSourceConfig } from '../util/defaultConfig';

export abstract class BaseWrapperFactory<TSecretList extends TAllSecretRefs> {
  private _disableSentry: boolean;
  public _messageType: MessageType = MessageType.Object;
  public _runtimeCfg: SourceConfig;
  public _handler: string;
  public _secrets: Record<string, SecretConfig<any>>;
  private _initFunction: (...args: any) => Promise<any>;

  protected _validateInputFn: TValidationMethodBase[] = [];
  protected _validateOutputFn: TValidationMethodBase[] = [];
  protected validations: TValidationsBase = {};

  constructor(protected mgr: LambdaFactoryManager<TSecretList>) { }

  protected fork(newEl: BaseWrapperFactory<TSecretList>) {
    newEl._disableSentry = this._disableSentry;
    newEl._messageType = this._messageType;
    newEl._handler = this._handler;
    newEl._runtimeCfg = this._runtimeCfg;
    newEl._secrets = this._secrets;
    newEl._validateInputFn = this._validateInputFn;
    newEl._validateOutputFn = this._validateOutputFn;
    newEl.validations = this.validations;
  }

  protected _validateInput(methodName: string, ...args: any[]) {

    const self = this;
    let isInit: boolean = false;
    let out: any[];

    const init = async function () {
      out = await self.validations[methodName as string].init(this, ...args);
    }

    const validation = async function (data: any, rawData: any) {
      if (!isInit) {
        await init();
        isInit = true;
      }
      await self.validations[methodName as string].validate.apply(self, [data, rawData, ...(out || [])]);
    }

    this._validateInputFn.push(validation);
  }


  protected _validateOutput(methodName: string, ...args: any[]) {

    const self = this;

    let isInit: boolean = false;
    let out: any[];
    const init = async function () {
      out = await self.validations[methodName as string].init(this, ...args);
    }

    const validation = async function (data: any, rawData: any) {
      if (!isInit) {
        await init();
        isInit = true;
      }

      await self.validations[methodName as string].validate.apply(self, [data, rawData, ...out]);
    }

    this._validateOutputFn.push(validation);
    return this;

  }


  public sentryDisable() {
    this._disableSentry = true;
    return this;
  }

  protected _configureRuntime(cfg: SourceConfig) {
    this._runtimeCfg = cfg;
    return this;
  }

  protected sentryIsEnabled() {
    return !this._disableSentry && !('DISABLE_SENTRY' in process.env);
  }


  protected expandConfiguration<IF, TSecrets extends string>(
    cfg: HandlerConfiguration<IF, TSecrets>
  ): HandlerConfiguration<IF, TSecrets> {
    const secrets = cfg.secretInjection;
    const expandedSecrets = this.expandSecrets(secrets);

    return {
      initFunction: this._initFunction,
      ...cfg,
      secretInjection: expandedSecrets,
      secretFetchers: this.mgr.secretFetchers ?? {},
      validateInputFn: this._validateInputFn,
      validateOutputFn: this._validateOutputFn,
      sources: _.defaultsDeep(
        {},
        this._runtimeCfg,
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

  protected setInitFunction(func: (...args: any) => Promise<any>) {
    this._initFunction = async (secrets) => {
      await this.init();
      return func(secrets);
    };
  }

  protected async init() {
    if (this.sentryIsEnabled()) {
      AWSLambda.init(this.mgr.sentryCfg);
    }
  }

  protected _needsSecret(
    source: string,
    key: string,
    secretName: string,
    secretKey: string | undefined,
    meta: any,
    required: boolean
  ) {
    this._secrets = this._secrets || {};
    this._secrets[key] = {
      secret: secretName as string,
      source,
      meta,
      secretKey: secretKey as string | undefined,
      required,
    };
  }
}


import { SecretConfig, TAllSecretRefs, TSecretRef } from './utils/secrets_manager';
import type { LambdaFactoryManager } from './Manager';
import { AWSLambda } from "@sentry/serverless";
import { MessageType } from '../util/types';
import { BaseSchema, NumberSchema, ObjectSchema, StringSchema } from 'yup';


export abstract class BaseWrapperFactory<TSecretList extends TAllSecretRefs>{
  private _disableSentry: boolean;
  protected _messageType: MessageType;

  constructor(protected mgr: LambdaFactoryManager<TSecretList>) {
  }

  protected fork(newEl: BaseWrapperFactory<TSecretList>) {
    newEl._disableSentry = this._disableSentry;
    newEl._messageType = this._messageType;
  }

  public sentryDisable() {
    this._disableSentry = true;
    return this;
  }

  protected sentryIsEnabled() {
    return (!this._disableSentry && !("DISABLE_SENTRY" in process.env))
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

  /**
   * Adds pre-secrets to the list of user-defined secrets
   * @param secretsIn The secrets defined by the needsSecret() calls
   * @returns A list of expanded secrets (input secrets + necessary secrets to prefetch)
   */
  protected expandSecrets( secretsIn: Record<string, SecretConfig<any>> ) {
    const sources = new Set<string>();

    for( let i in secretsIn ) {
      const source = secretsIn[ i ].source;
      if( ! source || source === "aws" ) {
        continue;
      }

      sources.add( source );
    }

    const secrets = Object.assign( {}, secretsIn );
    if( this.mgr.preSecrets ) {
      for( let source of sources.values() ) {
        Object.assign( secrets, this.mgr.preSecrets[ source ] || {} );
      }
    }
    return secrets;
  }

  protected async init() {
    if (this.sentryIsEnabled()) {
      AWSLambda.init(this.mgr.sentryCfg)
    }
  }
}

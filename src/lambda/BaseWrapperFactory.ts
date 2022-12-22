import { TSecretRef } from './utils/secrets_manager';
import type { LambdaFactoryManager } from './Manager';
import { AWSLambda } from "@sentry/serverless";
import { MessageType } from '../util/types';
import { BaseSchema, NumberSchema, ObjectSchema, StringSchema } from 'yup';


export abstract class BaseWrapperFactory<  TSecretList extends TSecretRef>{
    private _disableSentry: boolean;
    protected _messageType: MessageType;

    constructor( protected mgr :LambdaFactoryManager<TSecretList> ) {
    }
  
    protected fork( newEl: BaseWrapperFactory<TSecretList> ) {
      newEl._disableSentry = this._disableSentry;
      newEl._messageType = this._messageType;
    }

    public sentryDisable() {
      this._disableSentry = true;
      return this;
    }
  
    protected sentryIsEnabled() {
      return ( ! this._disableSentry && !( "DISABLE_SENTRY" in process.env ) )
    }
    
    protected setMessageTypeFromSchema( schema: BaseSchema) {

      if( schema instanceof StringSchema ) {
        this._messageType = MessageType.String;
      } else if( schema instanceof NumberSchema ) {
        this._messageType = MessageType.Number;
      } else if (schema instanceof ObjectSchema ) {
        this._messageType = MessageType.Object;
      }
    }
    protected async init() {
      if( this.sentryIsEnabled() ) {
        AWSLambda.init( this.mgr.sentryCfg )
      }
    }
  }
  
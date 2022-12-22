import { TSecretRef } from './utils/secrets_manager';
import type { LambdaFactoryManager } from './Manager';
import { AWSLambda } from "@sentry/serverless";


export abstract class BaseWrapperFactory<  TSecretList extends TSecretRef>{
    private _disableSentry: boolean;
  
    constructor( protected mgr :LambdaFactoryManager<TSecretList> ) {
    }
  
    public sentryDisable() {
      this._disableSentry = true;
      return this;
    }
  
    protected sentryIsEnabled() {
      return ( ! this._disableSentry && !( "DISABLE_SENTRY" in process.env ) )
    }
  
    protected async init() {
      if( this.sentryIsEnabled() ) {
        AWSLambda.init( this.mgr.sentryCfg )
      }
    }
  }
  
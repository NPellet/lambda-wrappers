import { TSecretRef} from './utils/secrets_manager';
import { LambdaFactoryManager } from './Manager';
import { AWSLambda } from "@sentry/serverless";


export abstract class BaseWrapperFactory<  TSecretList extends TSecretRef>{
    mgr: LambdaFactoryManager<TSecretRef>;
    private _disableSentry: boolean;
  
    constructor( manager:LambdaFactoryManager<TSecretList> ) {
      this.mgr = manager;  
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
  
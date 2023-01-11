import { MessageType } from '../util/types';
import { BaseWrapperFactory } from './BaseWrapperFactory';
import { LambdaFactoryManager } from './Manager';

describe('Testing BaseWrapperFactory features', function () {
  test('Extending secrets auto-default to AWS', () => {
    class ImplFactory extends BaseWrapperFactory<any> {
      public testSecret() {
        const expandedSecrets = this.expandSecrets({
          def: {
            meta: {},
            required: true,
            secret: 'abc',
            source: 'gcp',
          },
        });

        expect(expandedSecrets.a!.secret).toBe('abc');
        expect(expandedSecrets.a!.secretKey).toBe('b');
        expect(expandedSecrets.def!.source).toBe('gcp');
      }
    }

    const mgr = new LambdaFactoryManager().addSecretSource<any>()(
      'gcp',
      {},
      async () => {
        return {};
      },
      (aws) => {
        return {
          a: aws('abc', 'b', true),
        };
      }
    );

    const inst = new ImplFactory(mgr);
    inst.testSecret();
  });

  test('Sources config are correctly deep extended', () => {
    const mgr = new LambdaFactoryManager().setRuntimeConfig({
      eventBridge: { failLambdaOnValidationFail: true },
    });

    const { configuration } = mgr
      .eventBridgeWrapperFactory('handler')
      .configureRuntime({}, { recordExceptionOnLambdaFail: true })
      .createHandler(
        class Handler {
          static async init() {
            return new Handler();
          }

          async handler() {}
        }
      );

    expect(configuration.sources?._general).toMatchObject({
      recordExceptionOnLambdaFail: true,
    });

    expect(configuration.sources?.eventBridge).toStrictEqual({
      failLambdaOnValidationFail: true,
    });
  });

  test('ExpandConfiguration expands in correct order', function () {
    class Fac extends BaseWrapperFactory<{}> {
      public cfg() {
        this._runtimeCfg = {
          _general: {
            recordExceptionOnLambdaFail: true,
          },
        };
        return this.expandConfiguration({
          messageType: MessageType.Binary,
        });
      }

      public cfgEmpty() {
        this._runtimeCfg = {};
        return this.expandConfiguration({
          messageType: MessageType.Binary,
        });
      }

      public cfgNull() {
        // @ts-ignore
        this._runtimeCfg = undefined;
        return this.expandConfiguration({
          messageType: MessageType.Binary,
        });
      }
    }

    const f = new Fac(
      new LambdaFactoryManager().setRuntimeConfig({
        _general: {
          recordExceptionOnLambdaFail: false,
        },
      })
    );

    const cfgA = f.cfg();
    expect(cfgA.sources?._general?.recordExceptionOnLambdaFail).toBe(true);

    const cfgEmpty = f.cfgEmpty();
    expect(cfgEmpty.sources?._general?.recordExceptionOnLambdaFail).toBe(false);

    const cfgNull = f.cfgNull();
    expect(cfgNull.sources?._general?.recordExceptionOnLambdaFail).toBe(false);
  });
});

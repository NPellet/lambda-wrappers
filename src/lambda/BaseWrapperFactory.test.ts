import { BaseWrapperFactory } from "./BaseWrapperFactory";
import { LambdaFactoryManager } from "./Manager";

describe("Testing BaseWrapperFactory features", function() {


    test("Extending secrets auto-default to AWS", () => {

        class ImplFactory extends BaseWrapperFactory<any> {

            public testSecret() {
                const expandedSecrets = this.expandSecrets( { "def": {
                    "meta": {},
                    "required": true,
                    "secret": "abc",
                    "source": "gcp"
                }})

                expect( expandedSecrets.a!.secret ).toBe('abc');
                expect( expandedSecrets.a!.secretKey ).toBe('b');
                expect( expandedSecrets.def!.source ).toBe('gcp');
            }
        }
    
        const mgr = new LambdaFactoryManager().addSecretSource<any>()("gcp", {}, async () => {
            return {};
        }, ( aws ) => {
            return {
                a: aws("abc", "b", true)
            }
        })

        const inst = new ImplFactory( mgr );
        inst.testSecret();

    })

    test("Sources config are correctly deep extended", () => {

        const mgr = new LambdaFactoryManager().setSourcesConfig({
            "eventBridge": {"failLambdaOnValidationFail": true}
        })

        const { configuration } = mgr.eventBridgeWrapperFactory("handler").setConfig( {
            "recordExceptionOnValidationFail": true
        }).createHandler( class Handler {
            static async init() {
                return new Handler();
            }

            async handler() {

            }
        })

        expect( configuration.sources?.eventBridge ).toStrictEqual( {
            "recordExceptionOnValidationFail": true,
            "failLambdaOnValidationFail": true
        })


    })
})
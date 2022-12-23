import { LambdaFactoryManager } from "./Manager";

describe("Testing manager behaviour", function() {


    it("Immutability handles copy of arguments", function() {

        const mgr = new LambdaFactoryManager();
        mgr
        .configureSentryDSN("abc")
        .setSecrets( {
            a: {
                b: 'c'
            }
        }).disableSentry();

        expect( mgr.sentryCfg.dsn ).toBe("abc");
        expect( mgr.sentryCfg.enabled ).toBe(false);
        
    })
});

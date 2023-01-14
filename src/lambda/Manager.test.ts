import { LambdaFactoryManager } from './Manager';

describe('Testing manager behaviour', function () {
  it('Immutability handles copy of arguments', function () {
    const mgr = new LambdaFactoryManager()
      .configureSentryDSN('abc')
      .setAWSSecrets({
        a: {
          b: 'c',
        },
      })
      .disableSentry();

    expect(mgr.sentryCfg.dsn).toBe('abc');
    expect(mgr.sentryCfg.enabled).toBe(false);
  });

  it("Cannot a secret source that's called aws", function () {
    const mgr = new LambdaFactoryManager();
    expect(() => {
      mgr.addSecretSource<any>()('aws', {}, undefined, async () => {
        return {};
      });
    }).toThrow();
  });
});

import { LambdaFactoryManager } from '../Manager';

jest.mock('../utils/telemetry', function () {
  const actual = jest.requireActual('../utils/telemetry');
  return {
    __esModule: true,
    ...actual,
    wrapLatencyMetering: jest.fn(actual.wrapLatencyMetering),
  };
});

import { wrapLatencyMetering } from '../utils/telemetry';

const okHandler = async () => {};

const makeHandler = (_handler: () => Promise<void>) => {
  const handler = new LambdaFactoryManager()
    .sqsWrapperFactory('handler')
    .createHandler(
      class Ctrl {
        static async init() {
          return new Ctrl();
        }

        handler = _handler;
      }
    );
  return handler;
};

describe('Testing API Gateway metering', function () {
  test('Metering telemetry is called', async () => {
    const handler = makeHandler(okHandler);

    expect(wrapLatencyMetering).toHaveBeenCalled();
  });
});

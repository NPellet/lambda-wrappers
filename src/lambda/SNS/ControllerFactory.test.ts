import _ from 'lodash';
import { LambdaContext, testSNSRecord } from '../../test_utils/utils';
import * as yup from 'yup';
import { SNSEvent, SNSEventRecord } from 'aws-lambda';
import { failSQSRecord } from '../../util/records/sqs/record';
import {
  SNSCtrlInterface,
  SNSHandlerWrapperFactory,
} from './ControllerFactory';
import { IfHandler, LambdaFactoryManager } from '..';


describe('Testing API Controller factory', function () {
  it('Basic functionality works', async () => {
    const schema = yup.object({ a: yup.string() });
    const controllerFactory = new SNSHandlerWrapperFactory( new LambdaFactoryManager() )
      .setInputSchema(schema)
      .setHandler('create');

    const mockHandler = jest.fn(async (data, secrets) => {
      if (data.getData().a === '1') {
        throw new Error("Didn't work");
      }

      if (data.getData().a === '2') {
        return;
      }
    }) ;

    class Ctrl implements SNSCtrlInterface<typeof controllerFactory> {
      static async init(secrets) {
        return new Ctrl();
      }

      create: IfHandler<SNSCtrlInterface<typeof controllerFactory>> = async (
        data,
        secrets
      ) => {
        return mockHandler(data, secrets);
      };
    }

    const { handler, configuration } = controllerFactory.createHandler(Ctrl);

    const out = await handler(
      {
        Records: [
          { ...testSNSRecord, Sns: { ...testSNSRecord.Sns, Message: "BAD_JSON" }  }, // We put it first to make sure the rest still runs
          { ...testSNSRecord, Sns: { ...testSNSRecord.Sns, Message: JSON.stringify({ a: '1' }) } },
          { ...testSNSRecord, Sns: { ...testSNSRecord.Sns, Message: JSON.stringify({ a: '2' }) } },
        ],
      },
      LambdaContext,
      () => {}
    );

    expect( mockHandler ).toHaveBeenCalledTimes( 2 );
    await expect( mockHandler.mock.results[0].value ).rejects.toBeTruthy( )
    await expect( mockHandler.mock.results[1].value ).resolves.toBe( undefined )
    expect(out).toBe( undefined );
  });
});

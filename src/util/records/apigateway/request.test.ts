import _, { clone } from 'lodash';
import { testApiGatewayEvent } from '../../../test_utils/utils';
import { MessageType } from '../../types';
import { Request } from './request';

describe('API Gateway request', () => {
  test('Output basic getters', async () => {

    const request = new Request(
      testApiGatewayEvent,
      MessageType.String
    );

    expect(request.getHeaders()['Content-Type']).toBe('text/plain');
    expect(request.getPathParameters().a).toBe('b');
    expect(request.getQueryParameters().query).toBe('content');
    expect( request.getRawData() ).toBe(testApiGatewayEvent );
    expect( request.getRawRecord() ).toBe(testApiGatewayEvent );
    expect(request.getData()).toBe('Request body');
  });

  test('Default values', async () => {

    const clonedTestApiGatewayEvent = _.cloneDeep( testApiGatewayEvent);
    clonedTestApiGatewayEvent.body = JSON.stringify({ a: "b"});

    const request = new Request<{ a: string }>(
      clonedTestApiGatewayEvent,
      MessageType.Object
    );
    expect(request.getData().a).toStrictEqual("b");
   
  });

});

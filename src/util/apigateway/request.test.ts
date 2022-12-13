import { Request } from './request';

describe('API Gateway request', () => {
  test('Output basic getters', async () => {
    const headers = {
      'Content-Type': 'text/plain',
    };
    const pathParameters = {
      a: 'b',
    };

    const queryParameters = {
      q: 'v',
    };

    const request = new Request(
      'data',
      headers,
      pathParameters,
      queryParameters
    );

    expect(request.getHeaders()['Content-Type']).toBe('text/plain');
    expect(request.getPathParameters().a).toBe('b');
    expect(request.getQueryParameters().q).toBe('v');

    expect(request.getData()).toBe('data');
  });

  test('Default values', async () => {
    const request = new Request('data');

    expect(request.getHeaders()).toStrictEqual({});
    expect(request.getPathParameters()).toStrictEqual({});
    expect(request.getQueryParameters()).toStrictEqual({});

    expect(request.getData()).toBe('data');
  });

  test('Accepts null values', async () => {
    const request = new Request('data', {}, null, null);

    expect(request.getHeaders()).toStrictEqual({});
    expect(request.getPathParameters()).toStrictEqual({});
    expect(request.getQueryParameters()).toStrictEqual({});

    expect(request.getData()).toBe('data');
  });
});

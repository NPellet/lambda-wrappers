import { HTTPError, Response } from './response';

describe('API Gateway request', () => {
  test('basic response functionality', async () => {
    expect(Response.OK('data').getData()).toBe('data');
    expect(Response.OK('data').getStatusCode()).toBe(200);

    expect(Response.OK_NO_CONTENT().getData()).toBe(null);
    expect(Response.OK_NO_CONTENT().getStatusCode()).toBe(204);

    expect(Response.CREATED('data').getStatusCode()).toBe(201);
  });

  test('basic error functionality', async () => {
    expect(HTTPError.CONFLICT('data').getStatusCode()).toBe(409);
    expect(HTTPError.BAD_REQUEST('data').getStatusCode()).toBe(400);
    expect(HTTPError.UNAUTHORIZED('data').getStatusCode()).toBe(401);
    expect(HTTPError.FORBIDDEN('data').getStatusCode()).toBe(403);
    expect(HTTPError.NOT_FOUND('data').getStatusCode()).toBe(404);
    expect(HTTPError.VALIDATION_FAILED('data').getStatusCode()).toBe(422);
    expect(HTTPError.SERVER_ERROR('data').getStatusCode()).toBe(500);
  });

  test('Internal server error is by default anormal', async () => {
    expect(HTTPError.SERVER_ERROR('ISE').isAnormal()).toBe(true);
  });

  test('An HTTPError can be made anormal', async () => {
    expect(HTTPError.CONFLICT('ISE').isAnormal()).toBe(false);
    expect(HTTPError.CONFLICT('ISE').anormal().isAnormal()).toBe(true);
  });
});

import { HTTPError, HTTPResponse } from './response';
import api from '@opentelemetry/api'
import { memoryExporter } from '../../../test_utils/utils';
import { flush } from '../../../lambda/utils/telemetry';

describe('API Gateway request', () => {
  test('basic response functionality', async () => {
    expect(HTTPResponse.OK('data').getData()).toBe('data');
    expect(HTTPResponse.OK('data').getStatusCode()).toBe(200);

    expect(HTTPResponse.OK_NO_CONTENT().getData()).toBe(null);
    expect(HTTPResponse.OK_NO_CONTENT().getStatusCode()).toBe(204);

    expect(HTTPResponse.CREATED('data').getStatusCode()).toBe(201);
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


  test('header functionality', async () => {
    expect(HTTPError.CONFLICT(undefined, { h: 'v'}).getHeaders().h).toBe("v");
    expect(HTTPError.BAD_REQUEST(undefined, { h: 'v'}).getHeaders().h).toBe("v");
    expect(HTTPError.UNAUTHORIZED(undefined, { h: 'v'}).getHeaders().h).toBe("v");
    expect(HTTPError.FORBIDDEN(undefined, { h: 'v'}).getHeaders().h).toBe("v");
    expect(HTTPError.NOT_FOUND(undefined, { h: 'v'}).getHeaders().h).toBe("v");
    expect(HTTPError.VALIDATION_FAILED(undefined, { h: 'v'}).getHeaders().h).toBe("v");
    expect(HTTPError.SERVER_ERROR(undefined, { h: 'v'}).getHeaders().h).toBe("v");

    expect(HTTPError.CONFLICT(undefined).getData()).toBe("Conflict");
    expect(HTTPError.BAD_REQUEST(undefined).getData()).toBe("Bad Request");
    expect(HTTPError.UNAUTHORIZED(undefined).getData()).toBe("Unauthorized");
    expect(HTTPError.FORBIDDEN(undefined).getData()).toBe("Forbidden");
    expect(HTTPError.NOT_FOUND(undefined).getData()).toBe("Not Found");
    expect(HTTPError.VALIDATION_FAILED(undefined).getData()).toBe("Validation Failed");
    expect(HTTPError.SERVER_ERROR(undefined).getData()).toBe("Internal Server Error");
  });

  test('Internal server error is by default anormal', async () => {
    expect(HTTPError.SERVER_ERROR('ISE').isAnormal()).toBe(true);
  });

  test('An HTTPError can be made anormal', async () => {
    expect(HTTPError.CONFLICT('ISE').isAnormal()).toBe(false);
    expect(HTTPError.CONFLICT('ISE').anormal().isAnormal()).toBe(true);
  });

});


describe("Response with opentelemetry attributes", function() {

  const wrapSpan = (cb: () => void) => {

    api.trace.getTracer('tracer').startActiveSpan( "testspan", ( span ) => {
      cb();
      span.end();
    })
  }
  test('possible upstream error', async () => {

    wrapSpan( () => {
      HTTPError.BAD_REQUEST("Oops").possibleUpstreamError("AnError");
    })

    await flush();
    const spans = memoryExporter.getFinishedSpans();
    
    expect( spans.length ).toBe( 1 );
    expect( Object.values( spans[ 0 ].attributes )[ 0 ] ).toBe("AnError")
  })
  test('possible downstream error', async () => {

    wrapSpan( () => {
      HTTPError.BAD_REQUEST("Oops").possibleDownstreamError("AnError");
    })

    await flush();
    const spans = memoryExporter.getFinishedSpans();
    
    expect( spans.length ).toBe( 1 );
    expect( Object.values( spans[ 0 ].attributes )[ 0 ] ).toBe("AnError")
  })
  test('possible data corruption', async () => {

    wrapSpan( () => {
      HTTPError.BAD_REQUEST("Oops").possibleDataCorruption("AnError");
    })

    await flush();
    const spans = memoryExporter.getFinishedSpans();
    
    expect( spans.length ).toBe( 1 );
    expect( Object.values( spans[ 0 ].attributes )[ 0 ] ).toBe("AnError")
  })
  test('defies laws of physics', async () => {

    wrapSpan( () => {
      HTTPError.BAD_REQUEST("Oops").defiesLawsOfPhysics("AnError");
    })

    await flush();
    const spans = memoryExporter.getFinishedSpans();
    
    expect( spans.length ).toBe( 1 );
    expect( Object.values( spans[ 0 ].attributes )[ 0 ] ).toBe("AnError")
  })
})
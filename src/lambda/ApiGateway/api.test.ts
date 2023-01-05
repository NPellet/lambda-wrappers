import _ from 'lodash';
import {
  testApiGatewayEvent,
  LambdaContext,
  memoryExporter,
} from '../../test_utils/utils';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import {
  event,
  successLHandler,
  exceptionLHandler,
  errorLHandler,
  malformedLHandler,
  unauthorizedLHandler,
  unauthorizedWithErrorLHandler,
  bufferLHandler,
  emptyLHandler,
  objectLHandler,
} from '../../test_utils/apigateway';
import { createApiGatewayHandler } from './api';
import * as yup from 'yup';

jest.mock('../../util/exceptions', function () {
  return {
    recordException: jest.fn(),
  };
});

import { recordException } from '../../util/exceptions';

jest.mock('../Wrapper', function () {
  const actual = jest.requireActual('../Wrapper');
  return {
    wrapGenericHandler: jest.fn(actual.wrapGenericHandler),
  };
});
import { wrapGenericHandler } from '../Wrapper';

jest.mock('./telemetry/Wrapper', function () {
  const actual = jest.requireActual('./telemetry/Wrapper');
  return {
    wrapTelemetryApiGateway: jest.fn(actual.wrapTelemetryApiGateway),
  };
});
import { wrapTelemetryApiGateway } from './telemetry/Wrapper';

import { HandlerConfiguration, LambdaType } from '../config';
import { HTTPResponse } from '../../util/records/apigateway/response';
import { MessageType } from '../../util/types';

describe('API Gateway. Sanitizing outputs', function () {
  const cfg: HandlerConfiguration = {
    type: LambdaType.GENERIC,
    secretInjection: {},
    messageType: MessageType.Number
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Handles 200 ', async () => {
    const handler = createApiGatewayHandler(successLHandler, cfg);

    expect(wrapGenericHandler).toHaveBeenCalled();
    const out = await handler(event, LambdaContext, () => {});
    expect(out.statusCode).toBe(200);
    expect(out.body).toBe('Ok');
  });

  it('Handles 500 ', async () => {
    const handler = createApiGatewayHandler(errorLHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(out.body).toBe('Internal Server Error');
  });

  it('Handles exception ', async () => {
    const handler = createApiGatewayHandler(exceptionLHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(typeof out.body).toBe('string');
    expect(out.body).toContain('The lambda execution for the API Gateway ');
    expect(recordException).toHaveBeenCalled();
  });
  
  it('Reports stack trace when HTTPError has payload of instance Error', async () => {
    const handler = createApiGatewayHandler(unauthorizedWithErrorLHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(401);
    expect(typeof out.body).toBe('string');
    expect(out.body).toContain(
      'Error: You do not have access to this resource'
    );
    expect(recordException).not.toHaveBeenCalled();
  });

  it('Handles malformed output ', async () => {
    const handler = createApiGatewayHandler(malformedLHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(out.body).toBe('Internal Server Error');
    expect(recordException).toHaveBeenCalled();
  });

  it('Handles buffer output ', async () => {
    const handler = createApiGatewayHandler(bufferLHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.isBase64Encoded).toBe(true);
  });

  it('Handles empty output ', async () => {
    const handler = createApiGatewayHandler(emptyLHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.isBase64Encoded).toBe(false);
    expect(out.body).toBe('');
  });
  it('Handles serializes JSON output ', async () => {
    const handler = createApiGatewayHandler(objectLHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.isBase64Encoded).toBe(false);
    expect(out.body).toBe(
      JSON.stringify({
        key: 'value',
      })
    );
    expect(typeof out.body).toBe('string');
  });

  /*
  it("Handles sync handler ", async () => {
    const handler = createApiGatewayHandler(syncHandler, cfg);
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(500);
    expect(out.body).toContain("Lambda function malformed.");
    expect(recordException).toHaveBeenCalled();
  });*/
});

describe('API Gateway: Telemetry', function () {
  
  const cfg: HandlerConfiguration = {
    type: LambdaType.API_GATEWAY,
    secretInjection: {},
    opentelemetry: true,
    messageType: MessageType.Number
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Creates 2 nested spans ', async () => {
    const handler = createApiGatewayHandler(successLHandler, cfg);

    expect(wrapGenericHandler).toHaveBeenCalled();
    const out = await handler(event, LambdaContext, () => {});

    expect(out.statusCode).toBe(200);

    const spans = memoryExporter.getFinishedSpans();

    expect(wrapTelemetryApiGateway).toHaveBeenCalled();

    expect(spans.length).toBe(2);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);
    expect(spans[1].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);

    expect(spans[0].parentSpanId).toBe(spans[1].spanContext().spanId);
  });


  test("Telemetry wrapper is called depending on otel flag", async () => {

    createApiGatewayHandler(
      async (request) => {
        return HTTPResponse.OK_NO_CONTENT();
      },

      {
        opentelemetry: true,
        messageType: MessageType.Binary,
      }
    );

    expect( wrapTelemetryApiGateway ).toHaveBeenCalled();

    jest.clearAllMocks();

     createApiGatewayHandler(
      async (request) => {
        return HTTPResponse.OK_NO_CONTENT();
      },
      {
        opentelemetry: false,
        messageType: MessageType.Binary,
      }
    );

    expect( wrapTelemetryApiGateway ).not.toHaveBeenCalled();
  })

  it('A normal HTTP Error does not create an exception, puts the outer span to Error when returning 500', async () => {
    const handler = createApiGatewayHandler(errorLHandler, cfg);

    expect(wrapGenericHandler).toHaveBeenCalled();
    expect(wrapTelemetryApiGateway).toHaveBeenCalled();

    const out = await handler(event, LambdaContext, () => {});
    expect(out.statusCode).toBe(500);

    const spans = memoryExporter.getFinishedSpans();

    expect(spans.length).toBe(2);
    expect(spans[1].events.length).toBe(0);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET); // Inner span
    expect(spans[1].status.code).toBe(SpanStatusCode.ERROR);
  });

  it('Leaves the outer span status to Unset when returning 403', async () => {
    const handler = createApiGatewayHandler(unauthorizedLHandler, cfg);

    expect(wrapGenericHandler).toHaveBeenCalled();
    expect(wrapTelemetryApiGateway).toHaveBeenCalled();

    const out = await handler(event, LambdaContext, () => {});
    expect(out.statusCode).toBe(401);

    const spans = memoryExporter.getFinishedSpans();

    expect(spans.length).toBe(2);
    expect(spans[1].events.length).toBe(0);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET); // Inner span
    expect(spans[1].status.code).toBe(SpanStatusCode.UNSET);
  });

  it('A throwing error logs an exception in the inner (lambda span) and fails the outer span', async () => {
    const handler = createApiGatewayHandler(exceptionLHandler, cfg);

    expect(wrapGenericHandler).toHaveBeenCalled();
    expect(wrapTelemetryApiGateway).toHaveBeenCalled();

    const out = await handler(event, LambdaContext, () => {});
    expect(out.statusCode).toBe(500);

    const spans = memoryExporter.getFinishedSpans();

    expect(spans.length).toBe(2);
    expect(spans[0].events.length).toBe(1);
    expect(spans[1].events.length).toBe(0);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[1].status.code).toBe(SpanStatusCode.ERROR);

    expect(
      spans[0].events[0].attributes![SemanticAttributes.EXCEPTION_STACKTRACE]
    ).toBeDefined();
  });
});

describe('API Gateway: Checking schemas', () => {
  it('Deserialization errors are handled', async () => {
    const handler = createApiGatewayHandler(async (request) => {
      return HTTPResponse.OK('Ok');
    }, {
      messageType: MessageType.Object,});

    const wrongObjectGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    wrongObjectGatewayEvent.body = 'Wrong json[]';
  //  wrongObjectGatewayEvent.headers['Content-Type'] = 'application/json';

    await expect(
      handler(wrongObjectGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining('Lambda input data malformed'),
    });
  });

  it('Input schema validation is enforced', async () => {
    const handler = createApiGatewayHandler(
      async (request) => {
        request.getData();

        return HTTPResponse.OK('Ok');
      },
      {
        yupSchemaInput: yup.object({
          num: yup.number().required(),
        }),
        messageType: MessageType.Object,
      }
    );


    const clonedTest = _.cloneDeep( testApiGatewayEvent );
    clonedTest.body = JSON.stringify({"b": "c"})
    await expect(
      handler(clonedTest, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining('Lambda input schema validation failed'),
    });

    const wrongObjectGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    wrongObjectGatewayEvent.body = JSON.stringify({ property: 'value' });
    await expect(
      handler(wrongObjectGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining('num is a required field'),
    });

    const validObjectGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    validObjectGatewayEvent.body = JSON.stringify({ num: 12 });
    await expect(
      handler(validObjectGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 200,
    });
  });

  it('Output schema validation is enforced', async () => {
    const handler = createApiGatewayHandler(
      // @ts-ignore
      async (request) => {
        const data = await request.getData();

        return HTTPResponse.OK(data);
      },
      {

      messageType: MessageType.String,
        yupSchemaOutput: yup.object({
          outputField: yup.number().required(),
        }),
      }
    );

    await expect(
      handler(testApiGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining(
        'Validation error: Output object not validating'
      ), // Validating output
    });

    const wrongObjectGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    wrongObjectGatewayEvent.body = JSON.stringify({ property: 'value' });
    await expect(
      handler(wrongObjectGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining(
        'Validation error: Output object not validating'
      ),
    });

    const wrongTypeGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    wrongTypeGatewayEvent.body = JSON.stringify({ outputField: 'value' });
    await expect(
      handler(wrongTypeGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 500,
      body: expect.stringContaining(
        'Validation error: Output object not validating'
      ),
    });

    const validObjectGatewayEvent = _.cloneDeep(testApiGatewayEvent);
    validObjectGatewayEvent.body = JSON.stringify({ outputField: 12 });
    await expect(
      handler(validObjectGatewayEvent, LambdaContext, () => {})
    ).resolves.toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ outputField: 12 }),
    });
  });
});

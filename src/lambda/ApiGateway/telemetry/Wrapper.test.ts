import _ from 'lodash';
import { LambdaContext, memoryExporter } from '../../../test_utils/utils';
import { wrapTelemetryApiGateway } from './Wrapper';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import {
  successHandler,
  event,
  errorHandler,
  exceptionHandler,
} from '../../../test_utils/apigateway';
import { flush } from '../../utils/telemetry';
import { APIGatewayProxyResult } from 'aws-lambda';

describe('Telemetry: API Gateway wrapper handles all types of outputs', function () {
  it('Response is of instance Response', async () => {
    const handler = wrapTelemetryApiGateway(successHandler);
    const out = await handler(event, LambdaContext, () => {});
    expect(out).not.toBe(null);
    expect((out as APIGatewayProxyResult).body).toBe('Ok');
  });

  it('Handles 200', async () => {
    const handler = wrapTelemetryApiGateway(successHandler);

    const out = await expect(
      handler(event, LambdaContext, () => {})
    ).resolves.toBeDefined();

    const spans = memoryExporter.getFinishedSpans();

    expect(spans.length).toBe(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);

    expect(spans[0].attributes[SemanticAttributes.HTTP_METHOD]).toBe(
      event.requestContext.httpMethod
    );
    expect(spans[0].attributes[SemanticAttributes.HTTP_ROUTE]).toBe(
      event.requestContext.resourcePath
    );
    expect(spans[0].attributes[SemanticAttributes.HTTP_URL]).toBe(
      event.requestContext.domainName + event.requestContext.path
    );
    expect(spans[0].attributes[SemanticAttributes.HTTP_SERVER_NAME]).toBe(
      event.requestContext.domainName
    );
    expect(spans[0].attributes[SemanticAttributes.NET_PEER_IP]).toBe(
      event.requestContext.identity.sourceIp
    );
    expect(spans[0].attributes[SemanticAttributes.HTTP_METHOD]).toBe(
      event.requestContext.httpMethod
    );
    expect(spans[0].attributes['http.request.query.k']).toBe('v');
    expect(spans[0].attributes['http.request.query.k2']).toStrictEqual([
      'v1',
      'v2',
    ]);

    // TODO: Add test path parameters
  });

  it('Handles 500 ', async () => {
    const handler = wrapTelemetryApiGateway(errorHandler);
    const out = await handler(event, LambdaContext, () => {});
    await flush();

    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET); // By default unset, it's the inner API wrapper that sets the span to Error
  });

  it('Handles exception ', async () => {
    const handler = wrapTelemetryApiGateway(exceptionHandler);
    const out = await expect(
      handler(event, LambdaContext, () => {})
    ).rejects.toBeTruthy();

    await flush();
    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
  });
});

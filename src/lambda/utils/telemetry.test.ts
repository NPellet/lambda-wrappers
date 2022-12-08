import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
  SemanticAttributes,
  SemanticResourceAttributes,
} from '@opentelemetry/semantic-conventions';
import { Handler } from 'aws-lambda';
import { event } from '../../test_utils/apigateway';
import { LambdaContext, memoryExporter } from '../../test_utils/utils';
import { flush, wrapTelemetryLambda } from './telemetry';

const handler: Handler<any, any> = async () => {
  return 'Ok';
};
const failedHandler: Handler<any, any> = async () => {
  throw new Error('Internal server error');
};

describe('Telemetry: generic lambda', () => {
  /*test('Lambda wrapper has been called', function () {
    const wrapper = jest.fn();
    wrapTelemetryLambda(handler, wrapper);

    expect(wrapper).toHaveBeenCalledTimes(1);
  });
*/
  test('Span is properly flushed', async () => {
    const wrappedHandler = wrapTelemetryLambda(handler);

    await wrappedHandler(event, LambdaContext, () => {});
    await flush();
    const spans = memoryExporter.getFinishedSpans();

    expect(spans.length).toBe(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
    expect(spans[0].kind).toBe(SpanKind.SERVER);

    expect(spans[0].attributes[SemanticAttributes.FAAS_EXECUTION]).toBe(
      LambdaContext.awsRequestId
    );
    expect(spans[0].attributes[SemanticResourceAttributes.FAAS_ID]).toBe(
      LambdaContext.invokedFunctionArn
    );
    expect(
      spans[0].attributes[SemanticResourceAttributes.CLOUD_ACCOUNT_ID]
    ).toBe('12345678');
  });

  test('Lambda exception is properly rethrown', async () => {
    const wrappedHandler = wrapTelemetryLambda(failedHandler);

    await expect(
      wrappedHandler(event, LambdaContext, () => {})
    ).rejects.toBeTruthy();

    await flush();
    const spans = memoryExporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);

    expect(spans[0].events.length).toBe(1);
    expect(
      spans[0].events[0].attributes![SemanticAttributes.EXCEPTION_STACKTRACE]
    ).toBeDefined();
  });
});

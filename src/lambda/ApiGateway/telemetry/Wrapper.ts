import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
  Handler,
} from "aws-lambda";
import { telemetryFindApiGatewayParent } from "./ParentContext";
import { Attributes, SpanKind, SpanStatusCode } from "@opentelemetry/api";

import * as otelapi from "@opentelemetry/api";
import {
  SemanticAttributes,
  SemanticResourceAttributes,
} from "@opentelemetry/semantic-conventions";
import { flush, tracer } from "../../utils/telemetry";
import { log } from "../../utils/logger";
import { AwsApiGatewayRequest } from "../../../util/apigateway/apigateway";

export const wrapTelemetryApiGateway = <T>(
  handler: Handler<AwsApiGatewayRequest<T>, APIGatewayProxyResult>
) => {
  return async function (
    event: AwsApiGatewayRequest<T>,
    context: Context,
    callback: Callback
  ) {
    const parentContext = telemetryFindApiGatewayParent(event);
    const eventData = event.getOriginalData();
    const requestContext = eventData.requestContext;

    let attributes: Attributes = {
      [SemanticAttributes.HTTP_METHOD]: requestContext.httpMethod,
      [SemanticAttributes.HTTP_ROUTE]: requestContext.resourcePath,
      [SemanticAttributes.HTTP_URL]:
        requestContext.domainName + requestContext.path,
      [SemanticAttributes.HTTP_SERVER_NAME]: requestContext.domainName,
      [SemanticResourceAttributes.CLOUD_ACCOUNT_ID]: requestContext.accountId,
    };

    if (requestContext.identity?.sourceIp) {
      attributes[SemanticAttributes.NET_PEER_IP] =
        requestContext.identity.sourceIp;
    }

    if (eventData.multiValueQueryStringParameters) {
      Object.assign(
        attributes,
        Object.fromEntries(
          Object.entries(eventData.multiValueQueryStringParameters).map(
            ([k, v]) => [`http.request.query.${k}`, v?.length == 1 ? v[0] : v] // We don't have a semantic attribute for query parameters, but would be useful nonetheless
          )
        )
      );
    }

    if (eventData.multiValueHeaders) {
      Object.assign(
        attributes,
        Object.fromEntries(
          Object.entries(eventData.multiValueHeaders).map(([k, v]) => [
            // See https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/http/#http-request-and-response-headers
            `http.request.header.${k}`,
            v?.length == 1 ? v[0] : v,
          ])
        )
      );
    }
    if (eventData.pathParameters) {
      Object.assign(
        attributes,
        Object.fromEntries(
          Object.entries(eventData.pathParameters).map(([k, v]) => [
            `http.request.parameters.${k}`,
            v,
          ])
        )
      );
    }

    const span = tracer.startSpan(
      requestContext.domainName + requestContext.path,
      {
        kind: SpanKind.SERVER,
        attributes: attributes,
      },
      parentContext
    );

    const out = await otelapi.context.with(
      otelapi.trace.setSpan(parentContext, span),
      async () => {
        let out: void | APIGatewayProxyResult;

        try {
          out = await handler(event, context, callback); // This should NEVER throw
        } catch (e) {
          // We must run a try-catch here, despite our expectation that the handler should not throw
          // This is because if it DOES in fact throw, the span will not end
          otelapi.diag.error(
            "API Gateway lambda has thrown an error at the telemetry level. This should not be happening and points to a bug. Make sure the handler is properly wrapped in a try-catch clause"
          );
          out = {
            statusCode: 500,
            body: "Internal server error",
          };
        }

        if (!out) {
          log.error("Only use asynchronous handlers");
          return callback("The lambda must by asynchronous", undefined); // TODO: Fill the callback
        }

        if (out.statusCode >= 400 && out.statusCode < 600) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        return out;
      }
    );

    span.end();
    await flush();

    return out;
  };
};

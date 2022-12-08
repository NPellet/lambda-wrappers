import {
  APIGatewayEvent,
  APIGatewayProxyEvent,
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
import { AwsApiGatewayRequest } from "../../../util/apigateway/apigateway";
import { HTTPError, Response } from "../../../util/apigateway/response";
import { log } from "../../utils/logger";

export const wrapTelemetryApiGateway = <T, U>(
  handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult>
) => {
  return async function (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback
  ) {
    const parentContext = telemetryFindApiGatewayParent(event);
    const eventData = event;
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

    try {
      const out = (await otelapi.context.with(
        otelapi.trace.setSpan(parentContext, span),
        async () => {
          return handler(event, context, callback);
        }
      )) as APIGatewayProxyResult;

      if (!out) {
        log.error(
          "Api Gateway OTEL API wrapper should output a response, and not void"
        );
        span.setStatus({ code: SpanStatusCode.ERROR });
      }

      span.end();
      await flush();

      return out;
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      await flush();
      throw e;
    }
  };
};

import api from '@opentelemetry/api';

interface Replyable<T> {
  getData(): T;

  getStatusCode(): number;

  getHeaders(): Record<string, string>;
}

class BaseHTTPResponse<T> implements Replyable<T> {
  public constructor(
    private data: T,
    private headers: Record<string, string>,
    private statusCode: number
  ) {}
  
  public getRawRecord() {
    return this;
  }
  
  public getData(): T {
    return this.data;
  }

  public getStatusCode(): number {
    return this.statusCode;
  }

  public getHeaders(): Record<string, string> {
    return this.headers;
  }
}

export class HTTPResponse<T> extends BaseHTTPResponse<T> {
  public isResponse = true;

  public static OK<T>(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPResponse<T> {
    return new HTTPResponse(data, headers, 200);
  }

  public static CREATED<T>(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPResponse<T> {
    return new HTTPResponse(data, headers, 201);
  }

  public static OK_NO_CONTENT(
    headers: Record<string, string> = {}
  ): HTTPResponse<void> {
    // @ts-ignore
    return new HTTPResponse(null, headers, 204);
  }
}

type T = string | Error;
export class HTTPError extends BaseHTTPResponse<T> {
  public isError = true;

  private _anormal: boolean = false;

  public isAnormal() {
    return this._anormal;
  }

  public anormal() {
    this._anormal = true;
    return this;
  }

  //#possibleUpstreamError: string | undefined = undefined;
  public possibleUpstreamError(reason: string) {
    api.trace
      .getActiveSpan()
      ?.setAttribute('httperror.possible_upstream_error', reason);
    //this.#possibleUpstreamError = reason;
    return this;
  }

  //#possibleDownstreamError: string | undefined = undefined;
  public possibleDownstreamError(reason: string) {
    api.trace
      .getActiveSpan()
      ?.setAttribute('httperror.possible_downstream_error', reason);
    //this.#possibleDownstreamError = reason;
    return this;
  }

  //#possibleDataCorruptionMessage: string | undefined = undefined;
  public possibleDataCorruption(reason: string) {
    api.trace
      .getActiveSpan()
      ?.setAttribute('httperror.possible_data_corruption', reason);
    //this.#possibleDataCorruptionMessage = reason;
    return this;
  }

  //#defiesLawsOfPhysicsMessage: string | undefined = undefined;
  public defiesLawsOfPhysics(reason: string) {
    api.trace
      .getActiveSpan()!.setAttribute('httperror.defies_laws_of_physics', reason);
    //this.#defiesLawsOfPhysicsMessage = reason;
    return this;
  }

  public static CONFLICT(
    data: T = 'Conflict',
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 409);
  }

  public static BAD_REQUEST(
    data: T = 'Bad Request',
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 400);
  }

  public static UNAUTHORIZED(
    data: T = 'Unauthorized',
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 401);
  }

  public static FORBIDDEN(
    data: T = 'Forbidden',
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 403);
  }

  public static NOT_FOUND(
    data: T = 'Not Found',
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 404);
  }

  public static VALIDATION_FAILED(
    data: T = 'Validation Failed',
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 422);
  }

  public static SERVER_ERROR(
    data: T = 'Internal Server Error',
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 500).anormal();
  }
}

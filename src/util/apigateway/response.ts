interface Replyable<T> {
  getData(): T;

  getStatusCode(): number;

  getHeaders(): Record<string, string>;
}

class HTTPResponse<T> implements Replyable<T> {
  public constructor(
    private data: T,
    private headers: Record<string, string>,
    private statusCode: number
  ) {}

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

export class Response<T> extends HTTPResponse<T> {
  public isResponse = true;

  public static OK<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 200);
  }

  public static CREATED<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 201);
  }

  public static OK_NO_CONTENT(
    headers: Record<string, string> = {}
  ): Response<void> {
    // @ts-ignore
    return new Response(null, headers, 204);
  }
}

type T = string | Error;
export class HTTPError extends HTTPResponse<T> {
  public isError = true;

  private _anormal: boolean = false;

  public isAnormal() {
    return this._anormal;
  }

  public anormal() {
    this._anormal = true;
    return this;
  }

  public static CONFLICT(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 409);
  }

  public static BAD_REQUEST(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 400);
  }

  public static UNAUTHORIZED(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 401);
  }

  public static FORBIDDEN(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 403);
  }

  public static NOT_FOUND(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 404);
  }

  public static VALIDATION_FAILED(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 422);
  }

  public static SERVER_ERROR(
    data: T,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 500).anormal();
  }
}

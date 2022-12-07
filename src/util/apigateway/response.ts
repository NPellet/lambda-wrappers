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
  public isResponse() {
    return true;
  }
  public thisIsIt = true;
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

  public static OK_NO_CONTENT<T>(
    headers: Record<string, string> = {}
  ): Response<T> {
    // @ts-ignore
    return new Response(null, headers, 204);
  }
}

export class HTTPError extends HTTPResponse<any> {
  public isError = true;

  public static CONFLICT(
    data: string,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 409);
  }

  public static BAD_REQUEST<T>(
    data: string,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 400);
  }

  public static UNAUTHORIZED<T>(
    data: string,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 401);
  }

  public static FORBIDDEN<T>(
    data: string,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 403);
  }

  public static NOT_FOUND<T>(
    data: string,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 404);
  }

  public static VALIDATION_FAILED<T>(
    data: string,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 422);
  }

  public static SERVER_ERROR<T>(
    data: string,
    headers: Record<string, string> = {}
  ): HTTPError {
    return new HTTPError(data, headers, 500);
  }
}

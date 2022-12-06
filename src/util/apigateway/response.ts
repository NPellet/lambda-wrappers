export class Response<T> {
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

  public static CONFLICT<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 409);
  }

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
    return new Response(null, headers, 204);
  }

  public static BAD_REQUEST<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 400);
  }

  public static UNAUTHORIZED<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 401);
  }

  public static FORBIDDEN<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 403);
  }

  public static NOT_FOUND<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 404);
  }

  public static VALIDATION_FAILED<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 422);
  }

  public static SERVER_ERROR<T>(
    data: T,
    headers: Record<string, string> = {}
  ): Response<T> {
    return new Response(data, headers, 500);
  }
}

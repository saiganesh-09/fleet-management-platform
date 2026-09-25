export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errorCode: string = 'INTERNAL_ERROR',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, errorCode = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, message, errorCode, details);
  }
  static unauthorized(message = 'Unauthorized', errorCode = 'UNAUTHORIZED') {
    return new ApiError(401, message, errorCode);
  }
  static forbidden(message = 'Forbidden', errorCode = 'FORBIDDEN') {
    return new ApiError(403, message, errorCode);
  }
  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new ApiError(404, message, errorCode);
  }
  static conflict(message: string, errorCode = 'CONFLICT') {
    return new ApiError(409, message, errorCode);
  }
  static unprocessable(message: string, errorCode = 'UNPROCESSABLE_ENTITY', details?: unknown) {
    return new ApiError(422, message, errorCode, details);
  }
}

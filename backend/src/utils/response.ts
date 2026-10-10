import { Response } from 'express';

export function successResponse<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data !== undefined ? data : null,
  });
}

export function errorResponse(
  res: Response,
  message: string,
  code = 'ERROR',
  statusCode = 400,
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(details ? { details } : {}),
  });
}

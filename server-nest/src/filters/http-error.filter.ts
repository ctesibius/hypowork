import { ArgumentsHost, Catch, ExceptionFilter, Logger } from "@nestjs/common";
import type { Response } from "express";
import { HttpError } from "@paperclipai/server/errors";

/**
 * Maps {@link HttpError} from `@paperclipai/server` services to HTTP responses.
 * Without this, Nest treats thrown `HttpError` as an unknown `Error` → 500.
 */
@Catch(HttpError)
export class HttpErrorFilter implements ExceptionFilter {
  private readonly log = new Logger(HttpErrorFilter.name);

  catch(exception: HttpError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    if (exception.status >= 500) {
      this.log.warn(`${exception.status} ${exception.message}`);
    }
    res.status(exception.status).json({
      error: exception.message,
      ...(exception.details !== undefined ? { details: exception.details } : {}),
    });
  }
}

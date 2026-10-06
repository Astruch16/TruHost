import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
  PipeTransform,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBody, ApiOkResponse, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { ProblemException } from './problem.js';

export function toOpenApiSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'output', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
}

function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
}

/** Validates and transforms request input; failures become a 400 problem with per-field errors. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw new ProblemException({
      status: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
      detail: 'Request validation failed',
      extras: {
        errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
}

/** Documents a zod request body in OpenAPI. Pair with `@Body(new ZodPipe(schema))`. */
export const ZodBody = (schema: z.ZodType) => ApiBody({ schema: toInputSchema(schema) });

/** Documents each key of a zod object as an OpenAPI query parameter. */
export function ZodQuery(schema: z.ZodObject) {
  const json = toInputSchema(schema) as { properties?: Record<string, object>; required?: string[] };
  return applyDecorators(
    ...Object.entries(json.properties ?? {}).map(([name, s]) =>
      ApiQuery({ name, required: json.required?.includes(name) ?? false, schema: s }),
    ),
  );
}

export const RESPONSE_SCHEMA = 'truhost:response-schema';

/**
 * Declares the response schema: documents it in OpenAPI and, via ZodResponseInterceptor, parses
 * every response through it. Undeclared fields are stripped, so a service can't leak a column by
 * accident.
 */
export function ZodResponse(schema: z.ZodType, status: HttpStatus = HttpStatus.OK) {
  const doc =
    status === HttpStatus.OK
      ? ApiOkResponse({ schema: toOpenApiSchema(schema) })
      : ApiResponse({ status, schema: toOpenApiSchema(schema) });
  return applyDecorators(SetMetadata(RESPONSE_SCHEMA, schema), doc);
}

@Injectable()
export class ZodResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const schema = this.reflector.get<z.ZodType | undefined>(RESPONSE_SCHEMA, context.getHandler());
    return next.handle().pipe(
      map((body: unknown) => {
        if (!schema || body === undefined) return body;
        // Round-trip through JSON so Date objects become ISO strings before validation.
        const json: unknown = JSON.parse(JSON.stringify(body));
        const result = schema.safeParse(json);
        if (!result.success) {
          throw new Error(
            `Response for ${context.getClass().name}.${context.getHandler().name} does not match its schema: ${result.error.message}`,
          );
        }
        return result.data;
      }),
    );
  }
}

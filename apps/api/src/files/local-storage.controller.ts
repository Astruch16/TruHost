import { Controller, Get, HttpCode, Inject, Put, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/actor.js';
import { ProblemException } from '../common/problem.js';
import { LocalStorage } from './local-storage.js';
import { FILE_STORAGE, inlineDisposition, WINDOWED_CACHE_CONTROL } from './storage.js';

const forbidden = (detail: string) => new ProblemException({ status: 403, code: 'BAD_SIGNATURE', detail });

/**
 * Stand-in for R2's signed URLs when STORAGE_DRIVER=local (development and tests only). Public: the signature is
 * the authorisation, exactly as with R2.
 */
@ApiExcludeController()
@Controller('local-storage')
export class LocalStorageController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: LocalStorage) {}

  @Public()
  @Put('*key')
  @HttpCode(200)
  async put(@Req() req: Request, @Query() query: Record<string, string>) {
    const key = objectKey(req);
    const params = this.storage.verify(key, query);
    if (!params || params.op !== 'put') throw forbidden('Invalid or expired upload link');
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (req.header('content-type') !== params.ct) throw forbidden('Content-Type does not match the signed upload');
    if (body.length !== Number(params.len)) throw forbidden('Content-Length does not match the signed upload');
    const sha = LocalStorage.sha256Hex(body);
    if (sha !== params.sha) throw forbidden('SHA-256 does not match the signed upload');
    await this.storage.write(key, body, { contentType: params.ct!, sizeBytes: body.length, sha256Hex: sha });
    return { ok: true };
  }

  @Public()
  @Get('*key')
  async get(@Req() req: Request, @Query() query: Record<string, string>, @Res() res: Response) {
    const key = objectKey(req);
    const params = this.storage.verify(key, query);
    if (!params || params.op !== 'get') throw forbidden('Invalid or expired link');
    const object = await this.storage.read(key);
    if (!object) throw new ProblemException({ status: 404, code: 'NOT_FOUND', detail: 'File not found' });
    res
      .status(200)
      .type(object.meta.contentType)
      .setHeader('Content-Disposition', inlineDisposition(params.name || null))
      .setHeader('Cache-Control', params.cc === WINDOWED_CACHE_CONTROL ? params.cc : 'private, max-age=60')
      .send(object.body);
  }
}

/** The object key is everything after /v1/local-storage/ (keys contain slashes). */
function objectKey(req: Request): string {
  return decodeURIComponent(req.path.replace(/^\/v1\/local-storage\//, ''));
}

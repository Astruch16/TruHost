import { GetObjectCommand, HeadObjectCommand, NotFound, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  base64ToHex,
  GET_TTL_SECONDS,
  hexToBase64,
  inlineDisposition,
  PUT_TTL_SECONDS,
  type FileStorage,
  type ObjectInfo,
  type PutTarget,
} from './storage.js';

/**
 * Cloudflare R2 through its S3 API. The PUT URL signs Content-Type, Content-Length and x-amz-checksum-sha256, and
 * the checksum is kept as a header (not hoisted into the query), so R2 rejects any body whose SHA-256 differs.
 */
export class R2Storage implements FileStorage {
  private readonly client: S3Client;

  constructor(
    cfg: { accountId: string; accessKeyId: string; secretAccessKey: string },
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      // Only send checksums we ask for; R2 doesn't support the SDK's default CRC32 trailers.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async presignPut(o: { key: string; contentType: string; sizeBytes: number; sha256Hex: string }): Promise<PutTarget> {
    const checksum = hexToBase64(o.sha256Hex);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: o.key,
      ContentType: o.contentType,
      ContentLength: o.sizeBytes,
      ChecksumSHA256: checksum,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: PUT_TTL_SECONDS,
      signableHeaders: new Set(['content-type', 'content-length', 'x-amz-checksum-sha256']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
    });
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': o.contentType, 'x-amz-checksum-sha256': checksum },
      expiresAt: new Date(Date.now() + PUT_TTL_SECONDS * 1000).toISOString(),
    };
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' }),
      );
      return {
        sizeBytes: res.ContentLength ?? 0,
        contentType: res.ContentType ?? null,
        sha256Hex: res.ChecksumSHA256 ? base64ToHex(res.ChecksumSHA256) : null,
      };
    } catch (e) {
      if (e instanceof NotFound || (e as { name?: string }).name === 'NotFound') return null;
      throw e;
    }
  }

  async presignGet(key: string, o: { contentType: string; filename: string | null }) {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: o.contentType,
        ResponseContentDisposition: inlineDisposition(o.filename),
      }),
      { expiresIn: GET_TTL_SECONDS },
    );
    return { url, expiresAt: new Date(Date.now() + GET_TTL_SECONDS * 1000).toISOString() };
  }
}

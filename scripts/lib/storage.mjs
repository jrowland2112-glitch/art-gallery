import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const execFileAsync = promisify(execFile);

export function storageConfig(env = process.env) {
  const wranglerBucket = env.ORIGINALS_R2_BUCKET?.trim();
  const values = {
    endpoint: env.ORIGINALS_S3_ENDPOINT,
    region: env.ORIGINALS_S3_REGION || 'auto',
    bucket: env.ORIGINALS_S3_BUCKET,
    accessKeyId: env.ORIGINALS_S3_ACCESS_KEY_ID,
    secretAccessKey: env.ORIGINALS_S3_SECRET_ACCESS_KEY,
  };
  const present = [values.endpoint, values.bucket, values.accessKeyId, values.secretAccessKey].filter(Boolean).length;
  if (wranglerBucket && present > 0) {
    throw new Error('Choose either ORIGINALS_R2_BUCKET with Wrangler login or the ORIGINALS_S3_* settings, not both.');
  }
  if (wranglerBucket) return { provider: 'wrangler-r2', bucket: wranglerBucket };
  if (present === 0) return null;
  if (!values.endpoint || !values.bucket || !values.accessKeyId || !values.secretAccessKey) {
    throw new Error('Original-storage settings are incomplete. Set endpoint, bucket, access key ID, and secret access key in the local environment.');
  }
  return { provider: 's3', ...values };
}

function contentTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff';
  return 'image/jpeg';
}

async function putWithWrangler({ bucket, key, filename, contentType }) {
  const cli = path.resolve('node_modules', 'wrangler', 'bin', 'wrangler.js');
  await execFileAsync(process.execPath, [
    cli,
    'r2', 'object', 'put', `${bucket}/${key}`,
    '--file', path.resolve(filename),
    '--content-type', contentType,
    '--storage-class', 'Standard',
    '--remote',
  ], { windowsHide: true, maxBuffer: 1024 * 1024 });
}

export async function storeOriginal(filename, checksum, env = process.env, dependencies = {}) {
  const config = storageConfig(env);
  if (!config) return null;
  const key = `originals/${checksum}/${path.basename(filename)}`;
  if (config.provider === 'wrangler-r2') {
    await (dependencies.putWithWrangler || putWithWrangler)({
      bucket: config.bucket,
      key,
      filename,
      contentType: contentTypeFor(filename),
    });
    return { bucket: config.bucket, key, existed: null };
  }

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  try {
    await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return { bucket: config.bucket, key, existed: true };
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
  }

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: createReadStream(filename),
    ContentType: contentTypeFor(filename),
    Metadata: { sha256: checksum },
  }));
  return { bucket: config.bucket, key, existed: false };
}

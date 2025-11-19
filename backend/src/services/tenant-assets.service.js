import crypto from 'node:crypto';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.js';
import { normalizeFileName } from '../utils/s3-utils.js';

const IMAGE_EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp'
};

let cachedClient = null;
let cachedSignature = null;

function buildSignature(settings) {
  return JSON.stringify({
    endpoint: settings.endpoint,
    region: settings.region,
    bucket: settings.bucket,
    accessKeyId: settings.accessKeyId
  });
}

function resolvePublicBaseUrl(endpoint, bucket, overrideBaseUrl) {
  if (overrideBaseUrl) {
    return overrideBaseUrl.replace(/\/$/, '');
  }

  if (!endpoint || !bucket) {
    return null;
  }

  try {
    const endpointUrl = new URL(endpoint);
    return `https://${bucket}.${endpointUrl.host}`;
  } catch (error) {
    logger.warn('No se pudo construir la URL pública de Spaces', { error: error.message });
    return null;
  }
}

export function getSettings() {
  const endpoint = process.env.SPACES_ENDPOINT;
  const bucket = process.env.SPACES_BUCKET;
  const region = process.env.SPACES_REGION || 'fra1';
  const accessKeyId = process.env.SPACES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;
  const publicBaseUrl = resolvePublicBaseUrl(endpoint, bucket, process.env.SPACES_PUBLIC_BASE_URL);

  return {
    endpoint,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl
  };
}

function ensureClient() {
  const settings = getSettings();

  if (!settings.endpoint || !settings.bucket || !settings.accessKeyId || !settings.secretAccessKey) {
    throw new Error('Object storage no configurado. Revisa las variables SPACES_*.');
  }

  const signature = buildSignature(settings);

  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = new S3Client({
      region: settings.region,
      endpoint: settings.endpoint,
      forcePathStyle: false,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey
      }
    });
    cachedSignature = signature;
  }

  return { client: cachedClient, settings };
}

function buildTenantPrefix(slug) {
  return `tenants/${slug}/`;
}

function buildTenantPrefixById(tenantId) {
  return `tenants/${tenantId}/`;
}

function buildLogoKey(tenantId, extension) {
  const safeExtension = extension || 'png';
  return `${buildTenantPrefixById(tenantId)}branding/logo-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

function buildProjectLogoKey(tenantId, projectId, extension) {
  const safeExtension = extension || 'png';
  return `${buildTenantPrefixById(tenantId)}projects/${projectId}/logo-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

function buildSubmissionFileKey(tenantId, submissionId, fileName) {
  const normalizedName = fileName?.replace?.(/[^\w.\-]+/g, '_') ?? 'file.bin';
  // Usa tenant_id en lugar de slug para evitar problemas si el slug cambia
  return `${buildTenantPrefixById(tenantId)}submissions/${submissionId}/${Date.now()}-${crypto.randomUUID()}-${normalizedName}`;
}

function buildEventAssetKey(tenantId, eventId, fileName) {
  // Normalizar el nombre eliminando acentos y caracteres especiales
  const normalizedName = normalizeFileName(fileName);
  // Estructura: tenants/{tenantId}/events/{eventId}/assets/{timestamp}-{uuid}-{filename}
  // Usa tenant_id en lugar de slug para evitar problemas si el slug cambia
  return `${buildTenantPrefixById(tenantId)}events/${eventId}/assets/${Date.now()}-${crypto.randomUUID()}-${normalizedName}`;
}

function buildUserAvatarKey(userId, extension) {
  const safeExtension = extension || 'png';
  return `users/${userId}/avatar-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

function buildUserProfileImageKey(userId, extension) {
  const safeExtension = extension || 'png';
  return `users/${userId}/profile-image-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

export function extractKeyFromUrl(url, settings) {
  if (!url) {
    return null;
  }

  const normalizedUrl = url.replace(/\n/g, '').trim();
  if (!normalizedUrl) {
    return null;
  }

  const baseUrl = settings.publicBaseUrl?.replace(/\/$/, '');
  if (baseUrl && normalizedUrl.startsWith(`${baseUrl}/`)) {
    return normalizedUrl.slice(baseUrl.length + 1);
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    
    // Manejar formato de DigitalOcean Spaces: https://{bucket}.{region}.digitaloceanspaces.com/{key}
    // Ejemplo: https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/...
    if (parsedUrl.hostname && parsedUrl.hostname.includes('.digitaloceanspaces.com')) {
      // El pathname incluye el key completo después del dominio
      return parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.slice(1) : parsedUrl.pathname;
    }
    
    // Manejar formato estándar: https://{bucket}.{endpoint}/{key}
    if (settings.bucket && parsedUrl.hostname === settings.bucket && parsedUrl.pathname.startsWith('/')) {
      return parsedUrl.pathname.slice(1);
    }
    
    // Fallback: extraer el pathname
    return parsedUrl.pathname.startsWith('/') ? parsedUrl.pathname.slice(1) : parsedUrl.pathname;
  } catch (error) {
    logger.warn('No se pudo extraer la clave del objeto desde la URL proporcionada', {
      error: error.message,
      url: normalizedUrl
    });
    return null;
  }
}

export function decodeBase64Image(base64) {
  const matches = base64.match(/^data:(?<mime>[\w/+.-]+);base64,(?<data>.+)$/);
  if (!matches?.groups?.mime || !matches.groups.data) {
    throw new Error('Formato base64 de imagen inválido');
  }

  const mimeType = matches.groups.mime;
  if (!Object.prototype.hasOwnProperty.call(IMAGE_EXTENSION_BY_MIME, mimeType)) {
    throw new Error('Tipo de imagen no soportado');
  }

  const buffer = Buffer.from(matches.groups.data, 'base64');
  const extension = IMAGE_EXTENSION_BY_MIME[mimeType] || 'bin';

  return { buffer, mimeType, extension };
}

export function decodeBase64File(base64) {
  const matches = base64.match(/^data:(?<mime>[\w/+.;-]+);base64,(?<data>.+)$/);
  if (matches?.groups?.data) {
    const buffer = Buffer.from(matches.groups.data, 'base64');
    return {
      buffer,
      mimeType: matches.groups.mime
    };
  }

  const buffer = Buffer.from(base64, 'base64');
  return {
    buffer,
    mimeType: 'application/octet-stream'
  };
}

/**
 * Sube un logo de tenant a DigitalOcean Spaces.
 * @param {{ tenantId: number; buffer: Buffer; contentType: string; extension?: string }} options
 * @returns {Promise<{ url: string; key: string }>}
 */
export async function uploadTenantLogo({ tenantId, buffer, contentType, extension }) {
  const { client, settings } = ensureClient();
  const objectKey = buildLogoKey(tenantId, extension);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=604800, immutable'
    })
  );

  const baseUrl = settings.publicBaseUrl;
  if (!baseUrl) {
    throw new Error('No se pudo determinar la URL pública para el objeto subido');
  }

  return {
    key: objectKey,
    url: `${baseUrl}/${objectKey}`
  };
}

/**
 * Sube un logo de proyecto a DigitalOcean Spaces.
 * @param {{ tenantId: number; projectId: number; buffer: Buffer; contentType: string; extension?: string }} options
 * @returns {Promise<{ url: string; key: string }>}
 */
export async function uploadProjectLogo({ tenantId, projectId, buffer, contentType, extension }) {
  const { client, settings } = ensureClient();
  const objectKey = buildProjectLogoKey(tenantId, projectId, extension);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=604800, immutable'
    })
  );

  const baseUrl = settings.publicBaseUrl;
  if (!baseUrl) {
    throw new Error('No se pudo determinar la URL pública para el objeto subido');
  }

  return {
    key: objectKey,
    url: `${baseUrl}/${objectKey}`
  };
}

export async function uploadSubmissionFile({ tenantId, submissionId, fileName, buffer, contentType }) {
  const { client, settings } = ensureClient();
  const objectKey = buildSubmissionFileKey(tenantId, submissionId, fileName);
  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'private, max-age=31536000, immutable'
    })
  );

  const baseUrl = settings.publicBaseUrl;
  if (!baseUrl) {
    throw new Error('No se pudo determinar la URL pública para el archivo subido');
  }

  return {
    key: objectKey,
    url: `${baseUrl}/${objectKey}`
  };
}

export async function deleteObjectByUrl(url) {
  const { client, settings } = ensureClient();
  const key = extractKeyFromUrl(url, settings);
  if (!key) {
    return;
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: settings.bucket,
      Key: key
    })
  );
}

export async function deleteObjectByKey(key) {
  if (!key) {
    return;
  }

  const { client, settings } = ensureClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: settings.bucket,
      Key: key
    })
  );
}

/**
 * Verifica si un objeto existe en S3
 * @param {string} key - Clave del objeto en S3
 * @returns {Promise<boolean>} - true si existe, false si no existe o hay error
 */
export async function checkObjectExists(key) {
  if (!key) {
    return false;
  }

  try {
    const { client, settings } = ensureClient();
    await client.send(
      new HeadObjectCommand({
        Bucket: settings.bucket,
        Key: key
      })
    );
    return true;
  } catch (error) {
    // Si el error es 404 (NotFound), el objeto no existe
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // Para otros errores, loguear y retornar false
    logger.warn('Error al verificar existencia de objeto en S3', {
      error: error.message,
      key
    });
    return false;
  }
}

export async function deleteTenantAssetsBySlug(slug) {
  let client;
  let settings;

  try {
    const ensured = ensureClient();
    client = ensured.client;
    settings = ensured.settings;
  } catch (error) {
    logger.warn('Saltando limpieza de assets porque Spaces no está configurado', { error: error.message });
    return;
  }

  const prefix = buildTenantPrefix(slug);
  let continuationToken;

  do {
    const listResponse = await client.send(
      new ListObjectsV2Command({
        Bucket: settings.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken
      })
    );

    const objects = listResponse.Contents?.map(item => ({ Key: item.Key })).filter(Boolean) ?? [];

    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: settings.bucket,
          Delete: { Objects: objects }
        })
      );
    }

    continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
  } while (continuationToken);
}

export function validateSpacesConfiguration() {
  try {
    const ensured = ensureClient();
    return {
      configured: true,
      endpoint: ensured.settings.endpoint,
      bucket: ensured.settings.bucket
    };
  } catch (error) {
    return {
      configured: false,
      message: error.message
    };
  }
}

/**
 * Obtiene el cliente y configuración de S3 para uso en seeders
 * @returns {{ client: S3Client; settings: object } | null}
 */
export function getS3ClientAndSettings() {
  try {
    return ensureClient();
  } catch (error) {
    return null;
  }
}

export async function probeSpacesConnection() {
  const { client, settings } = ensureClient();

  await client.send(
    new ListObjectsV2Command({
      Bucket: settings.bucket,
      MaxKeys: 1
    })
  );

  return {
    endpoint: settings.endpoint,
    bucket: settings.bucket
  };
}

/**
 * Sube un archivo de evento a DigitalOcean Spaces.
 * @param {{ tenantId: number; eventId: number; fileName: string; buffer: Buffer; contentType: string }} options
 * @returns {Promise<{ url: string; key: string }>}
 */
export async function uploadEventAsset({ tenantId, eventId, fileName, buffer, contentType }) {
  const { client, settings } = ensureClient();
  const objectKey = buildEventAssetKey(tenantId, eventId, fileName);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000, immutable'
    })
  );

  const baseUrl = settings.publicBaseUrl;
  if (!baseUrl) {
    throw new Error('No se pudo determinar la URL pública para el archivo subido');
  }

  return {
    key: objectKey,
    url: `${baseUrl}/${objectKey}`
  };
}

/**
 * Sube un avatar de usuario a DigitalOcean Spaces.
 * Las imágenes de usuario son globales y no están asociadas a un tenant específico.
 * @param {{ userId: number; buffer: Buffer; contentType: string; extension?: string }} options
 * @returns {Promise<{ url: string; key: string }>}
 */
export async function uploadUserAvatar({ userId, buffer, contentType, extension }) {
  const { client, settings } = ensureClient();
  const objectKey = buildUserAvatarKey(userId, extension);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=604800, immutable'
    })
  );

  const baseUrl = settings.publicBaseUrl;
  if (!baseUrl) {
    throw new Error('No se pudo determinar la URL pública para el avatar subido');
  }

  return {
    key: objectKey,
    url: `${baseUrl}/${objectKey}`
  };
}

/**
 * Sube una imagen de perfil de usuario a DigitalOcean Spaces.
 * Las imágenes de usuario son globales y no están asociadas a un tenant específico.
 * @param {{ userId: number; buffer: Buffer; contentType: string; extension?: string }} options
 * @returns {Promise<{ url: string; key: string }>}
 */
export async function uploadUserProfileImage({ userId, buffer, contentType, extension }) {
  const { client, settings } = ensureClient();
  const objectKey = buildUserProfileImageKey(userId, extension);

  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=604800, immutable'
    })
  );

  const baseUrl = settings.publicBaseUrl;
  if (!baseUrl) {
    throw new Error('No se pudo determinar la URL pública para la imagen de perfil subida');
  }

  return {
    key: objectKey,
    url: `${baseUrl}/${objectKey}`
  };
}


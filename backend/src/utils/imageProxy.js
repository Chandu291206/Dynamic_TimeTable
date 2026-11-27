const http = require('http');
const https = require('https');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB cap to prevent memory exhaustion
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

/**
 * Validates that a URL uses HTTP/HTTPS and belongs strictly to griet.ac.in.
 */
function isAllowedGrietUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'griet.ac.in' || host.endsWith('.griet.ac.in')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Downloads an image buffer from a remote HTTP or HTTPS URL.
 * Automatically accepts unverified TLS certificates (common for college subdomains).
 * Enforces size limits, safe raster image MIME types, and allowlisted redirects.
 */
function fetchImageBuffer(url, { timeoutMs = 8000, maxRedirects = 3, maxBytes = MAX_IMAGE_BYTES, enforceGrietDomain = true } = {}) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error('Too many redirects'));
    }

    try {
      const parsed = enforceGrietDomain ? isAllowedGrietUrl(url) : new URL(url);
      if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
        return reject(new Error('Invalid or disallowed image URL'));
      }

      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        },
        timeout: timeoutMs,
      };

      if (isHttps) {
        options.rejectUnauthorized = false; // College servers often have invalid or unverified TLS certificates
      }

      const req = client.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          // Always enforce GRIET allowlist on redirect targets to prevent SSRF chains
          return fetchImageBuffer(redirectUrl, {
            timeoutMs,
            maxRedirects: maxRedirects - 1,
            maxBytes,
            enforceGrietDomain: true,
          })
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Upstream returned HTTP ${res.statusCode}`));
        }

        const rawType = (res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.has(rawType)) {
          res.destroy();
          return reject(new Error(`Unsupported image content-type: ${rawType || 'unknown'}`));
        }

        const contentLength = Number(res.headers['content-length'] || 0);
        if (contentLength > maxBytes) {
          res.destroy();
          return reject(new Error('Upstream image exceeds maximum allowed size'));
        }

        const chunks = [];
        let totalBytes = 0;

        res.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            res.destroy();
            return reject(new Error('Upstream image exceeds maximum allowed size'));
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: rawType === 'image/jpg' ? 'image/jpeg' : rawType,
          });
        });
        res.on('error', reject);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { fetchImageBuffer, isAllowedGrietUrl, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES };

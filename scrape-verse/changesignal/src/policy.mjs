import net from 'node:net';

const BLOCKED_PATH_SEGMENTS = new Set([
  'account',
  'admin',
  'checkout',
  'login',
  'paywall',
  'private',
  'signin',
  'signup',
]);

const GOVERNMENT_SUFFIXES = [
  '.gov',
  '.gov.au',
  '.gov.br',
  '.gov.ca',
  '.gov.in',
  '.gov.uk',
  '.gouv.fr',
  '.gc.ca',
  '.mil',
];

function isBlockedIPv4(hostname) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIPv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

export function assertPublicHttpsUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('target URL must be an absolute URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('target URL must use HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('target URL must not contain credentials');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('target URL must resolve to a public hostname');
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 && isBlockedIPv4(hostname)) {
    throw new Error('private, loopback, reserved, or multicast IPv4 targets are blocked');
  }
  if (ipVersion === 6 && isBlockedIPv6(hostname)) {
    throw new Error('private, loopback, unspecified, or link-local IPv6 targets are blocked');
  }
  if (ipVersion === 0 && !hostname.includes('.')) {
    throw new Error('single-label hostnames are blocked');
  }

  if (GOVERNMENT_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error('government-site targets are blocked for this event scaffold');
  }

  const pathSegments = url.pathname
    .split('/')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  if (pathSegments.some((segment) => BLOCKED_PATH_SEGMENTS.has(segment))) {
    throw new Error('login, account, private, checkout, or paywall paths are blocked');
  }

  return url;
}

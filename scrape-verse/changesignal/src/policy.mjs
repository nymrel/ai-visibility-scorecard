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

  const ipVersion = net.isIP(hostname.replace(/^\[|\]$/g, ''));
  if (ipVersion !== 0 || hostname.includes(':')) {
    throw new Error('IP literal targets are blocked; use a reviewed public hostname');
  }
  if (url.port) throw new Error('nonstandard HTTPS ports are blocked');
  if (ipVersion === 0 && !hostname.includes('.')) {
    throw new Error('single-label hostnames are blocked');
  }

  if (GOVERNMENT_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error('government-site targets are blocked for this event scaffold');
  }

  const pathSegments = url.pathname
    .split('/')
    .map((segment) => decodeURIComponent(segment).trim().toLowerCase())
    .filter(Boolean);
  if (pathSegments.some((segment) => BLOCKED_PATH_SEGMENTS.has(segment))) {
    throw new Error('login, account, private, checkout, or paywall paths are blocked');
  }

  return url;
}

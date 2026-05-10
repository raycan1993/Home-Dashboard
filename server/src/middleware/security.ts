/**
 * Composes the security middleware chain
 * (OWASP A05: Security Misconfiguration).
 *
 * Helmet defaults handle most of the standard headers; we override the CSP
 * to be explicit about which origins the dashboard may talk to.
 */
import type { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env';

export function applySecurity(app: Application): void {
  // Disable Express's "X-Powered-By: Express" disclosure.
  app.disable('x-powered-by');

  app.use(
    helmet({
      // CSP — applied to any HTML the API serves (e.g. error pages, OAuth landings).
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': [],
        },
      },
      // HSTS — only meaningful behind a TLS terminator (Caddy/nginx). Safe to send anyway.
      hsts: { maxAge: 15_552_000, includeSubDomains: true },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  // Strict CORS. No wildcard, single allowed origin from env.
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // same-origin / curl
        cb(null, origin === env.CORS_ORIGIN);
      },
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
    }),
  );
}

/**
 * Compatibility shim. The original codebase imported `devLogger` from this
 * path; the new structured logger lives at './logger'. Re-export so legacy
 * imports keep working until they're updated.
 */
export { logger as devLogger } from './logger';

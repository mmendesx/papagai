import { HttpContextToken } from '@angular/common/http';

/**
 * When set to `true`, the global error interceptor will NOT surface a
 * TuiAlert for failed requests. Use for background polling or any request
 * whose failures should be handled silently by the caller.
 */
export const SUPPRESS_ERROR_ALERT = new HttpContextToken<boolean>(() => false);

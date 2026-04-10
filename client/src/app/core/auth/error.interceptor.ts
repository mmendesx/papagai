import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TuiAlertService } from '@taiga-ui/core';
import { catchError, throwError } from 'rxjs';
import { DOCS_TRY_IT } from '../http/docs-try-it.context';
import { SUPPRESS_ERROR_ALERT } from '../http/suppress-error-alert.context';

const TOKEN_KEY = 'papagai_access_token';

function isPublicAuthUrl(url: string): boolean {
  return url.includes('/api/auth/login') || url.includes('/api/auth/register');
}

function messageFromError(err: HttpErrorResponse): string {
  const body = err.error as { message?: string | string[] } | undefined;
  if (body?.message) {
    return Array.isArray(body.message) ? body.message.join(', ') : body.message;
  }
  return err.message || 'Request failed';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const alerts = inject(TuiAlertService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      if (req.context.get(DOCS_TRY_IT)) {
        return throwError(() => err);
      }

      const suppressAlert = req.context.get(SUPPRESS_ERROR_ALERT);
      const url = err.url ?? req.url;

      if (isPublicAuthUrl(url)) {
        return throwError(() => err);
      }

      if (err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        void router.navigate(['/login']);
        alerts
          .open(messageFromError(err), {
            label: 'Session expired',
            appearance: 'warning',
            autoClose: 5000,
          })
          .subscribe();
        return throwError(() => err);
      }

      if (!suppressAlert) {
        alerts
          .open(messageFromError(err), {
            label: 'Error',
            appearance: 'negative',
            autoClose: 6000,
          })
          .subscribe();
      }

      return throwError(() => err);
    }),
  );
};

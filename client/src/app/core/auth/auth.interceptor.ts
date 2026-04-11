import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { DOCS_TRY_IT, DocsTryItContextValue } from '../http/docs-try-it.context';

const TOKEN_KEY = 'papagai_access_token';

function applyDocsTryItHeaders(req: HttpRequest<unknown>, context: DocsTryItContextValue): HttpRequest<unknown> {
  const headersWithoutAuth = req.headers.delete('Authorization').delete('X-Api-Key');

  if (context.mode === 'none') {
    return req.clone({ headers: headersWithoutAuth });
  }

  if (context.mode === 'apiKey') {
    const apiKey = context.apiKey?.trim();
    if (!apiKey) {
      return req.clone({ headers: headersWithoutAuth });
    }
    return req.clone({
      headers: headersWithoutAuth.set('X-Api-Key', apiKey),
    });
  }

  const explicitBearer = context.bearerToken?.trim();
  const storedBearer = localStorage.getItem(TOKEN_KEY)?.trim();
  const bearer = explicitBearer || storedBearer;
  if (!bearer) {
    return req.clone({ headers: headersWithoutAuth });
  }

  return req.clone({
    headers: headersWithoutAuth.set('Authorization', `Bearer ${bearer}`),
  });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const docsTryItContext = req.context.get(DOCS_TRY_IT);
  if (docsTryItContext) {
    return next(applyDocsTryItHeaders(req, docsTryItContext));
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};

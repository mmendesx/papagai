import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';
import { TuiConfirmService } from '@taiga-ui/kit/components/confirm';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/auth/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    NG_EVENT_PLUGINS,
    TuiConfirmService,
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideRouter(routes),
  ],
};

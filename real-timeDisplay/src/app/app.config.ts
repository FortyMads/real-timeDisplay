import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { DisplayPageComponent } from './display/display.page';

const routes = [
  { path: 'admin', component: AdminComponent },
  { path: 'display', component: DisplayPageComponent },
  { path: '', redirectTo: 'admin', pathMatch: 'full' as const },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
  ]
};

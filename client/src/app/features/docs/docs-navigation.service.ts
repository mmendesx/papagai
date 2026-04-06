import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DocsNavigationService {
  readonly targetEndpointId = signal<string | null>(null);

  navigate(id: string): void {
    this.targetEndpointId.set(id);
  }

  clear(): void {
    this.targetEndpointId.set(null);
  }
}

import { Injectable, Signal, signal } from '@angular/core';

export interface HeaderAction {
  id:       string;
  label:    string;
  variant:  'primary' | 'secondary' | 'negative' | 'icon-only';
  disabled?: Signal<boolean>;
  onClick:  () => void;
}

@Injectable({ providedIn: 'root' })
export class HeaderActionsService {
  private readonly _actions = signal<HeaderAction[]>([]);
  readonly actions = this._actions.asReadonly();

  setActions(actions: HeaderAction[]): void {
    this._actions.set(actions);
  }

  clearActions(): void {
    this._actions.set([]);
  }
}

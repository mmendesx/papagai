import { HttpContextToken } from '@angular/common/http';

export type DocsTryItAuthMode = 'none' | 'bearer' | 'apiKey';

export interface DocsTryItContextValue {
  mode: DocsTryItAuthMode;
  bearerToken?: string;
  apiKey?: string;
}

export const DOCS_TRY_IT = new HttpContextToken<DocsTryItContextValue | null>(() => null);

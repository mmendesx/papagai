import { HttpContextToken } from '@angular/common/http';

export const DOCS_TRY_IT = new HttpContextToken<boolean>(() => false);

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  key?: string; // only present after creation
  enabled: boolean;
  expiresAt?: string;
  createdAt: string;
  lastUsedAt?: string;
  permissions?: string[];
}

export interface CreateApiKeyPayload {
  name: string;
  expiresAt?: string;
  permissions?: string[];
  permissionsTemplate?: string;
}

export interface ApiKeyPermissionTemplate {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface ApiKeyTemplateListResponse {
  templates: ApiKeyPermissionTemplate[];
}

type ApiKeyListResponse = ApiKeyRecord[] | { keys?: ApiKeyRecord[] };

function withoutPlaintextKey(record: ApiKeyRecord): ApiKeyRecord {
  const { key: _key, ...safeRecord } = record;
  return safeRecord;
}

function normalizeApiKeyList(response: ApiKeyListResponse): ApiKeyRecord[] {
  const rows = Array.isArray(response) ? response : response.keys ?? [];
  return rows.map(withoutPlaintextKey);
}

@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private readonly http = inject(HttpClient);

  listAccountKeys(): Observable<ApiKeyRecord[]> {
    return this.http
      .get<ApiKeyListResponse>('/api/auth/apikeys')
      .pipe(map(normalizeApiKeyList));
  }

  createAccountKey(payload: CreateApiKeyPayload): Observable<ApiKeyRecord> {
    return this.http.post<ApiKeyRecord>('/api/auth/apikeys', payload);
  }

  listAccountKeyTemplates(): Observable<ApiKeyTemplateListResponse> {
    return this.http.get<ApiKeyTemplateListResponse>('/api/auth/apikeys/templates');
  }

  createInstanceKey(instanceName: string, payload: CreateApiKeyPayload): Observable<ApiKeyRecord> {
    return this.http.post<ApiKeyRecord>(`/api/instances/${instanceName}/apikeys`, payload);
  }

  revokeAccountKey(id: string): Observable<void> {
    return this.http.delete<void>(`/api/auth/apikeys/${id}`);
  }

  revokeInstanceKey(instanceName: string, id: string): Observable<void> {
    return this.http.delete<void>(`/api/instances/${instanceName}/apikeys/${id}`);
  }
}

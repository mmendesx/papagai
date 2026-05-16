import { resolveAccountPermissionForRequest } from './api-key-permissions.js';

describe('api-key-permissions route mapping', () => {
  it('maps compatibility route to instances:chats:read', () => {
    const permission = resolveAccountPermissionForRequest({
      method: 'GET',
      path: '/chat/getBase64FromMediaMessage/alpha',
      originalUrl: '/chat/getBase64FromMediaMessage/alpha',
    } as any);

    expect(permission).toBe('instances:chats:read');
  });
});

export type InstanceProvider = 'web' | 'wba';

export interface InstanceCapabilities {
  qr: boolean;
  sendMessages: boolean;
  receiveMessages: boolean;
  chatHistorySync: boolean;
  contactLookup: boolean;
  markRead: boolean;
  templates: boolean;
}

export const PROVIDER_CAPABILITIES: Record<
  InstanceProvider,
  InstanceCapabilities
> = {
  web: {
    qr: true,
    sendMessages: true,
    receiveMessages: true,
    chatHistorySync: true,
    contactLookup: true,
    markRead: true,
    templates: true,
  },
  wba: {
    qr: false,
    sendMessages: true,
    receiveMessages: true,
    chatHistorySync: false,
    contactLookup: false,
    markRead: false,
    templates: true,
  },
};

export function getProviderCapabilities(
  provider: InstanceProvider,
): InstanceCapabilities {
  return PROVIDER_CAPABILITIES[provider];
}

export function isProvider(value: string): value is InstanceProvider {
  return value === 'web' || value === 'wba';
}

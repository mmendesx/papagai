import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';

interface FakeInstance {
  name: string;
  userId: string;
  connected: boolean;
  startTime: number;
  webhookUrl: string | null;
  webhookHeaders: Record<string, string>;
  webhookEnabled: boolean;
  webhookEvents: string[];
  // Minimal socket shim so controller code that reads instance.socket.user?.id
  // does not throw a TypeError.
  socket: { user?: { id?: string } };
}

@Injectable()
export class FakeWhatsappService implements OnModuleInit, OnModuleDestroy {
  private instances = new Map<string, FakeInstance>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {}
  onModuleDestroy() {}

  async createInstance(
    userId: string,
    name: string,
    webhookUrl?: string,
    webhookHeaders: Record<string, string> = {},
    webhookEnabled = false,
    webhookEvents: string[] = [],
  ): Promise<void> {
    const key = `${userId}:${name}`;
    if (this.instances.has(key)) {
      throw new Error(`Instância "${name}" já existe para este usuário`);
    }
    const inst: FakeInstance = {
      name,
      userId,
      connected: false,
      startTime: Date.now(),
      webhookUrl: webhookUrl ?? null,
      webhookHeaders,
      webhookEnabled: !!(webhookUrl && webhookEnabled),
      webhookEvents,
      socket: { user: undefined },
    };
    this.instances.set(key, inst);
    await this.prisma.instanceConfig.upsert({
      where: { userId_name: { userId, name } },
      create: {
        userId,
        name,
        webhookUrl: inst.webhookUrl,
        webhookHeaders: inst.webhookHeaders,
        webhookEnabled: inst.webhookEnabled,
        webhookEvents: inst.webhookEvents,
      },
      update: {
        webhookUrl: inst.webhookUrl,
        webhookHeaders: inst.webhookHeaders,
        webhookEnabled: inst.webhookEnabled,
        webhookEvents: inst.webhookEvents,
      },
    });
  }

  getInstance(userId: string, name: string): FakeInstance | undefined {
    return this.instances.get(`${userId}:${name}`);
  }

  getInstances(
    userId: string,
    pagination: { page: number; limit: number },
  ): { instances: any[]; total: number } {
    const all = [...this.instances.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, inst]) => ({
        name: inst.name,
        connected: inst.connected,
        startTime: inst.startTime,
        webhookEnabled: inst.webhookEnabled,
        phoneNumber: null,
        webhook: {
          url: inst.webhookUrl,
          headers: inst.webhookHeaders,
          enabled: inst.webhookEnabled,
          events: inst.webhookEvents,
        },
      }));
    const total = all.length;
    const start = (pagination.page - 1) * pagination.limit;
    return { instances: all.slice(start, start + pagination.limit), total };
  }

  async disconnectInstance(userId: string, name: string): Promise<boolean> {
    const key = `${userId}:${name}`;
    if (!this.instances.has(key)) return false;
    this.instances.delete(key);
    await this.prisma.instanceConfig.deleteMany({ where: { userId, name } });
    return true;
  }

  async updateWebhookConfig(
    userId: string,
    name: string,
    config: any,
  ): Promise<any> {
    const key = `${userId}:${name}`;
    const inst = this.instances.get(key);
    if (!inst) throw new Error(`Instance "${key}" not found`);
    if (config.webhookUrl !== undefined) inst.webhookUrl = config.webhookUrl;
    if (config.webhookHeaders !== undefined)
      inst.webhookHeaders = config.webhookHeaders;
    if (config.webhookEnabled !== undefined)
      inst.webhookEnabled = config.webhookEnabled;
    if (config.webhookEvents !== undefined)
      inst.webhookEvents = config.webhookEvents;
    await this.prisma.instanceConfig.updateMany({
      where: { userId, name },
      data: config,
    });
    return inst;
  }

  getQR(_userId: string, _name: string): null {
    return null;
  }

  async send(): Promise<void> {}

  getContactInfo(): Promise<any> {
    return Promise.resolve(undefined);
  }

  getChats(): any[] {
    return [];
  }

  async reconnectInstance(): Promise<void> {}
}

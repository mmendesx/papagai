import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('instances')
export class InstanceConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ name: 'webhook_url', nullable: true, type: 'varchar', length: 2048 })
  webhookUrl: string | null;

  @Column({ name: 'webhook_headers', type: 'jsonb', default: '{}' })
  webhookHeaders: Record<string, string>;

  @Column({ name: 'webhook_enabled', type: 'boolean', default: false })
  webhookEnabled: boolean;

  @Column({
    name: 'webhook_events',
    type: 'text',
    array: true,
    default: `'{message,message_update,qr,connected,disconnected}'`,
  })
  webhookEvents: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

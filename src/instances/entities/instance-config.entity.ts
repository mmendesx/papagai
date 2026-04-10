import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('instances')
@Index(['userId', 'name'], { unique: true })
export class InstanceConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({
    name: 'webhook_url',
    nullable: true,
    type: 'varchar',
    length: 2048,
  })
  webhookUrl: string | null;

  @Column({ name: 'webhook_headers', type: 'jsonb', default: '{}' })
  webhookHeaders: Record<string, string>;

  @Column({ name: 'webhook_enabled', type: 'boolean', default: false })
  webhookEnabled: boolean;

  @Column({
    name: 'webhook_events',
    type: 'text',
    array: true,
    default: ['message', 'message_update', 'qr', 'connected', 'disconnected'],
  })
  webhookEvents: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

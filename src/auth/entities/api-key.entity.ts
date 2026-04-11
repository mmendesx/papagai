import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { InstanceConfig } from '../../instances/entities/instance-config.entity';
import { AccountApiKeyPermission } from '../api-key-permissions';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'instance_id', type: 'int', nullable: true })
  instanceId: number | null;

  @ManyToOne(() => InstanceConfig, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'instance_id' })
  instance: InstanceConfig | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  prefix: string;

  @Index({ unique: true })
  @Column({ name: 'key_hash', type: 'varchar', length: 64 })
  keyHash: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'text', array: true, nullable: true })
  permissions: AccountApiKeyPermission[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

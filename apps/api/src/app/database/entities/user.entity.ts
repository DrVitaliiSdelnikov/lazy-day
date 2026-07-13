import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'last_seen_at', default: () => 'NOW()' })
  lastSeenAt!: Date;

  @Column({ type: 'jsonb', default: {} })
  profile!: Record<string, unknown>;

  @Column({ type: 'text', array: true, name: 'saved_ids', default: '{}' })
  savedIds!: string[];

  @Column({ type: 'text', array: true, name: 'hidden_ids', default: '{}' })
  hiddenIds!: string[];

  @Column({ type: 'text', name: 'consent_state', default: 'pending' })
  consentState!: string;

  @Column({ type: 'text', name: 'auth_provider', nullable: true })
  authProvider?: string;

  @Column({ type: 'text', name: 'auth_external_id', nullable: true })
  authExternalId?: string;

  @Column({ type: 'text', array: true, name: 'device_ids', default: '{}' })
  deviceIds!: string[];
}

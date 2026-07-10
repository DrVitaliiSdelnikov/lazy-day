import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('interaction_events')
export class InteractionEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'device_id_hash' })
  deviceIdHash!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'text', name: 'event_type' })
  eventType!: string;

  @Column({ type: 'text', name: 'target_type' })
  targetType!: string;

  @Column({ type: 'text', nullable: true, name: 'target_id' })
  targetId?: string;

  @Column({ type: 'text', default: 'tbilisi', name: 'city_id' })
  cityId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'int', nullable: true, name: 'card_position' })
  cardPosition?: number;

  @Column({ type: 'jsonb', nullable: true, name: 'score_breakdown' })
  scoreBreakdown?: Record<string, number>;

  @Column({ type: 'text', array: true, nullable: true, name: 'explanation_codes' })
  explanationCodes?: string[];

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, unknown>;

  @Column({ type: 'text', default: 'pending', name: 'consent_state' })
  consentState!: string;
}

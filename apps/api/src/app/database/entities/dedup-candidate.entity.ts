import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dedup_candidates')
export class DedupCandidate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['place', 'event', 'venue'] })
  entityType!: string;

  @Column({ type: 'uuid' })
  entityAId!: string;

  @Column({ type: 'uuid' })
  entityBId!: string;

  @Column({ type: 'numeric', precision: 3, scale: 2 })
  confidence!: number;

  @Column({ type: 'jsonb', nullable: true })
  matchReasons?: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ['pending', 'merged', 'rejected'],
    default: 'pending',
  })
  status!: string;

  @Column({ type: 'text', nullable: true })
  resolvedBy?: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

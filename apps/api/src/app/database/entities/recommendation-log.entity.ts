import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('recommendation_logs')
export class RecommendationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  sessionId!: string;

  @Column({ type: 'text', nullable: true })
  deviceId?: string;

  @Column({ type: 'jsonb' })
  requestContext!: Record<string, unknown>;

  @Column({ type: 'uuid', array: true })
  returnedIds!: string[];

  @Column({ type: 'text' })
  rankingVersion!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

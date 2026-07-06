import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('interactions')
export class Interaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  deviceId!: string;

  @Column({ type: 'enum', enum: ['place', 'event'] })
  cardType!: string;

  @Column({ type: 'uuid' })
  cardId!: string;

  @Column({
    type: 'enum',
    enum: ['impression', 'click', 'save', 'hide', 'share', 'clickout'],
  })
  action!: string;

  @Column({ type: 'text', nullable: true })
  sessionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

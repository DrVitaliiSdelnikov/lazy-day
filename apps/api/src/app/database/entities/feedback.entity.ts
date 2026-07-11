import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text', nullable: true })
  contact?: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'text', default: 'new' })
  status!: string;
}

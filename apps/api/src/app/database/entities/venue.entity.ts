import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Place } from './place.entity';
import { Event } from './event.entity';

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  nameKa?: string;

  @Column({ type: 'text', nullable: true })
  nameEn?: string;

  @Column({ type: 'float' })
  lat!: number;

  @Column({ type: 'float' })
  lng!: number;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'text', default: 'tbilisi' })
  city!: string;

  @Column({ type: 'text', nullable: true })
  website?: string;

  @Column({ type: 'text', nullable: true })
  phone?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Place, (place) => place.venue)
  places?: Place[];

  @OneToMany(() => Event, (event) => event.venue)
  events?: Event[];
}

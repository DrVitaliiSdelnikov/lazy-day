import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardsController } from './cards.controller';
import { OgController } from './og.controller';
import { CardsService } from './cards.service';
import { Place } from '../database/entities/place.entity';
import { Event } from '../database/entities/event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Place, Event])],
  controllers: [CardsController, OgController],
  providers: [CardsService],
})
export class CardsModule {}

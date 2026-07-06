import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interaction } from '../database/entities/interaction.entity';
import { InteractionDto } from './dto/interaction.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Interaction)
    private readonly interactionRepo: Repository<Interaction>,
  ) {}

  async log(deviceId: string, dto: InteractionDto) {
    const interaction = this.interactionRepo.create({
      deviceId: deviceId || 'unknown',
      cardType: dto.cardType,
      cardId: dto.cardId,
      action: dto.action,
      sessionId: dto.sessionId,
      context: dto.context,
    });

    await this.interactionRepo.save(interaction);
    this.logger.log(`${dto.action} on ${dto.cardType}/${dto.cardId}`);

    return { ok: true };
  }
}

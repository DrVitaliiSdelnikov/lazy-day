import { Body, Controller, Post } from '@nestjs/common';
import { IsString, IsOptional, IsObject, MinLength } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Feedback } from '../database/entities/feedback.entity';

class SubmitFeedbackDto {
  @IsString()
  category!: string;

  @IsString()
  @MinLength(10)
  text!: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

@Controller('feedback')
export class UserFeedbackController {
  private readonly logger = new Logger(UserFeedbackController.name);

  constructor(
    @InjectRepository(Feedback)
    private readonly repo: Repository<Feedback>,
  ) {}

  @Post()
  async submit(@Body() dto: SubmitFeedbackDto) {
    const entry = await this.repo.save(this.repo.create({
      category: dto.category,
      text: dto.text,
      contact: dto.contact,
      meta: dto.meta,
    }));

    this.logger.log(`Feedback [${dto.category}]: ${dto.text.slice(0, 50)}...`);

    // Forward to Telegram
    await this.forwardToTelegram(entry);

    return { ok: true };
  }

  private async forwardToTelegram(fb: Feedback) {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];
    if (!token || !chatId) return;

    const text = `📩 LaziGo Feedback [${fb.category}]\n\n${fb.text}`
      + (fb.contact ? `\n\n📞 ${fb.contact}` : '')
      + `\n\n🕐 ${fb.createdAt?.toISOString?.() || 'now'}`;

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (e: any) {
      this.logger.error(`Telegram forward failed: ${e?.message}`);
    }
  }
}

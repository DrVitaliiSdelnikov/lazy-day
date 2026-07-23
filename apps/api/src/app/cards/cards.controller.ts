import { Controller, Get, Param, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { CardsService } from './cards.service';

const ALLOWED_HOSTS = ['static.biletebi.ge', 'static.tkt.ge', 'encrypted-tbn0.gstatic.com'];
const CONTENT_TYPES: Record<string, string> = { '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };

@Controller('cards')
export class CardsController {
  constructor(private readonly service: CardsService) {}

  @Get(':type/:id')
  getCard(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('locale') locale?: string,
  ) {
    return this.service.getCard(type, id, lat ? Number(lat) : undefined, lng ? Number(lng) : undefined, locale || 'ru');
  }

  /** Image proxy for CDNs that block cross-origin (biletebi.ge) */
  @Get('img-proxy')
  async imgProxy(@Query('url') url: string, @Res() res: Response) {
    if (!url) throw new HttpException('url required', HttpStatus.BAD_REQUEST);
    try {
      const parsed = new URL(url);
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        throw new HttpException('host not allowed', HttpStatus.FORBIDDEN);
      }
      const upstream = await fetch(url);
      if (!upstream.ok) throw new HttpException('upstream error', HttpStatus.BAD_GATEWAY);
      const ext = url.match(/\.\w+$/)?.[0]?.toLowerCase() || '.jpeg';
      const ct = CONTENT_TYPES[ext] || 'image/jpeg';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.set({ 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' });
      res.send(buf);
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException('proxy error', HttpStatus.BAD_GATEWAY);
    }
  }
}

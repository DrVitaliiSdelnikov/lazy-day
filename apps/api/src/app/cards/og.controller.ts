import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { CardsService } from './cards.service';

@Controller('og')
export class OgController {
  constructor(private readonly cards: CardsService) {}

  @Get(':type/:id')
  async ogPreview(
    @Param('type') type: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    try {
      const card: any = await this.cards.getCard(type, id);
      const title = this.escape(card.title || 'LaziGo');
      const description = this.escape(
        [card.category, card.rating ? `${card.rating}★` : null, card.address]
          .filter(Boolean).join(' · ') || 'Where to go in Tbilisi'
      );
      const url = `https://lazigo.app/detail/${type}/${id}`;
      const image = card.photoUrl || 'https://lazigo.app/og-image.png';

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta property="og:type" content="website">
<meta property="og:site_name" content="LaziGo">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0;url=${url}">
<title>${title} — LaziGo</title>
</head>
<body>Redirecting to <a href="${url}">${title}</a>...</body>
</html>`);
    } catch {
      res.redirect('https://lazigo.app');
    }
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

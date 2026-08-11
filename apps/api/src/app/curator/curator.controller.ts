import { Controller, Post, Body } from '@nestjs/common';
import { CuratorService } from './curator.service';
import { CuratorRequestDto } from './dto/curator-request.dto';
import { RouteService } from '../route/route.service';

@Controller('curator')
export class CuratorController {
  constructor(
    private readonly curator: CuratorService,
    private readonly routeService: RouteService,
  ) {}

  @Post('generate')
  async generate(@Body() dto: CuratorRequestDto) {
    return this.curator.buildCuration(dto);
  }

  @Post('swap')
  async swap(@Body() dto: { itemId: string; moods: string[]; lat: number; lng: number; locale?: string; seed?: number }) {
    return this.curator.swapItem(dto);
  }

  @Post('link-to-route')
  async linkToRoute(@Body() dto: { placeIds: string[]; lat: number; lng: number; locale?: string }) {
    return this.routeService.linkPoints({
      pointIds: dto.placeIds,
      startLat: dto.lat,
      startLng: dto.lng,
      locale: dto.locale,
    });
  }
}

import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { RouteService } from './route.service';
import { GenerateRouteDto } from './dto/generate-route.dto';

@Controller('routes')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateRouteDto) {
    return this.routeService.generate(dto);
  }

  @Get('areas')
  async areas(@Query('locale') locale?: string) {
    return this.routeService.getAreas(locale ?? 'ru');
  }

  @Get('top-places')
  async topPlaces(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('type') type?: string,
    @Query('locale') locale?: string,
  ) {
    return this.routeService.getTopPlaces(
      parseFloat(lat || '41.6934'),
      parseFloat(lng || '44.8015'),
      type,
      locale ?? 'ru',
    );
  }

  @Post('link')
  async link(@Body() dto: { pointIds: string[]; startLat: number; startLng: number; locale?: string }) {
    return this.routeService.linkPoints(dto);
  }

  @Post('nearby')
  async nearby(@Body() dto: { points: { lat: number; lng: number }[]; excludeIds: string[]; locale?: string }) {
    return this.routeService.getNearbyPlaces(dto);
  }

  @Post('alternatives')
  async alternatives(@Body() dto: {
    lat: number; lng: number; role: string;
    excludeIds: string[]; prevLat?: number; prevLng?: number;
    nextLat?: number; nextLng?: number; moods?: string[];
  }) {
    return this.routeService.getAlternatives(dto);
  }

  @Post('mark-seen')
  async markSeen(@Body() dto: { deviceId: string; routeCode: string }) {
    await this.routeService.markSeen(dto.deviceId, dto.routeCode);
    return { ok: true };
  }

  @Get('interesting-places')
  async interestingPlaces(
    @Query('excludeIds') excludeIds?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('locale') locale?: string,
  ) {
    return this.routeService.getInterestingPlaces(
      excludeIds ? excludeIds.split(',') : [],
      parseFloat(lat || '41.6934'),
      parseFloat(lng || '44.8015'),
      locale ?? 'ru',
    );
  }
}

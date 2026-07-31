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

  @Get('top-places')
  async topPlaces(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('type') type?: string,
  ) {
    return this.routeService.getTopPlaces(
      parseFloat(lat || '41.6934'),
      parseFloat(lng || '44.8015'),
      type,
    );
  }

  @Post('link')
  async link(@Body() dto: { pointIds: string[]; startLat: number; startLng: number; locale?: string }) {
    return this.routeService.linkPoints(dto);
  }

  @Post('alternatives')
  async alternatives(@Body() dto: {
    lat: number; lng: number; role: string;
    excludeIds: string[]; prevLat?: number; prevLng?: number;
    nextLat?: number; nextLng?: number; moods?: string[];
  }) {
    return this.routeService.getAlternatives(dto);
  }
}

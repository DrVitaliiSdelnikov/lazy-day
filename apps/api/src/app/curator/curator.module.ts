import { Module } from '@nestjs/common';
import { CuratorController } from './curator.controller';
import { CuratorService } from './curator.service';
import { RouteModule } from '../route/route.module';

@Module({
  imports: [RouteModule],
  controllers: [CuratorController],
  providers: [CuratorService],
})
export class CuratorModule {}

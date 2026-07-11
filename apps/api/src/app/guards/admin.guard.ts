import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-admin-token'];
    const secret = process.env['ADMIN_SECRET'];

    if (!secret) {
      // No secret configured = dev mode, allow all
      return true;
    }

    if (!token || token !== secret) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return true;
  }
}

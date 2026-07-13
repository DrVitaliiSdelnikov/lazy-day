import {
  Controller, Post, Req, Res, BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Request, Response } from 'express';
import { isUUID } from 'class-validator';
import { User } from '../database/entities/user.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  @Post('anon')
  async createOrRestore(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Check for existing cookie — restore user
    const cookieUid = req.cookies?.['ld_uid'];
    if (cookieUid && isUUID(cookieUid, '4')) {
      const user = await this.usersRepo.findOne({ where: { id: cookieUid } });
      if (user) {
        user.lastSeenAt = new Date();
        // Link old device hash if not already linked
        const deviceIdHash = req.body?.deviceIdHash;
        if (deviceIdHash && !user.deviceIds?.includes(deviceIdHash)) {
          user.deviceIds = [...(user.deviceIds || []), deviceIdHash];
        }
        await this.usersRepo.save(user);
        this.logger.log(`Restored user ${user.id} from cookie`);
        return {
          uid: user.id,
          profile: user.profile,
          savedIds: user.savedIds,
          hiddenIds: user.hiddenIds,
          consentState: user.consentState,
          restored: true,
        };
      }
    }

    // 2. Client-generated uid (idempotent) — MUST validate UUID v4
    const clientUid = req.body?.clientUid;
    if (clientUid && !isUUID(clientUid, '4')) {
      throw new BadRequestException('Invalid clientUid format');
    }
    const deviceIdHash = req.body?.deviceIdHash;

    if (clientUid) {
      // Upsert: create if missing, update last_seen + merge device_ids if exists
      const result = await this.dataSource.query(`
        INSERT INTO users (id, profile, saved_ids, hidden_ids, consent_state, device_ids, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          last_seen_at = NOW(),
          device_ids = (
            SELECT array_agg(DISTINCT d)
            FROM unnest(users.device_ids || EXCLUDED.device_ids) d
          )
        RETURNING *, (xmax <> 0) AS was_update
      `, [
        clientUid,
        req.body?.profile || {},
        req.body?.savedIds || [],
        req.body?.hiddenIds || [],
        req.body?.consentState || 'pending',
        deviceIdHash ? [deviceIdHash] : [],
      ]);

      const user = result[0];
      const restored = user.was_update;
      this.setCookie(res, user.id);
      this.logger.log(`${restored ? 'Restored' : 'Created'} user ${user.id} via clientUid`);
      return {
        uid: user.id,
        profile: user.profile,
        savedIds: user.saved_ids,
        hiddenIds: user.hidden_ids,
        consentState: user.consent_state,
        restored,
      };
    }

    // 3. No client uid — create fresh
    const user = await this.usersRepo.save(this.usersRepo.create({
      profile: req.body?.profile || {},
      savedIds: req.body?.savedIds || [],
      hiddenIds: req.body?.hiddenIds || [],
      consentState: req.body?.consentState || 'pending',
      deviceIds: deviceIdHash ? [deviceIdHash] : [],
    }));

    this.setCookie(res, user.id);
    this.logger.log(`Created fresh user ${user.id}`);
    return {
      uid: user.id,
      profile: user.profile,
      savedIds: [],
      hiddenIds: [],
      consentState: 'pending',
      restored: false,
    };
  }

  private cookieOpts() {
    const isDev = process.env['NODE_ENV'] === 'development';
    return {
      httpOnly: true,
      secure: !isDev,
      sameSite: 'lax' as const,
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      ...(isDev ? {} : { domain: '.lazigo.app' }),
      path: '/',
    };
  }

  private setCookie(res: Response, uid: string) {
    res.cookie('ld_uid', uid, this.cookieOpts());
  }
}

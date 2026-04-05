import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './guards/jwt-auth.guard.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser; accessToken: string }> {
    const expectedKey = this.configService.get<string>('appKey', '');
    if (!expectedKey) {
      throw new ForbiddenException({
        message: 'Registration is disabled',
        error: 'Forbidden',
        code: 'REGISTRATION_DISABLED',
      });
    }
    if (dto.appKey !== expectedKey) {
      throw new ForbiddenException({
        message: 'Invalid application key',
        error: 'Forbidden',
        code: 'INVALID_APP_KEY',
      });
    }

    const existing = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.usersRepo.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
    });
    try {
      await this.usersRepo.save(user);
    } catch (e) {
      if (e instanceof QueryFailedError) {
        const code = (e.driverError as { code?: string } | undefined)?.code;
        if (code === '23505') {
          throw new ConflictException('Email already registered');
        }
      }
      throw e;
    }

    const accessToken = await this.signToken(user);
    return {
      user: this.toPublicUser(user),
      accessToken,
    };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; accessToken: string }> {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = await this.signToken(user);
    return {
      user: this.toPublicUser(user),
      accessToken,
    };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.toPublicUser(user);
  }

  private async signToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: 'user',
    };
    return this.jwtService.signAsync(payload);
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

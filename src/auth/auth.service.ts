import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './guards/jwt-auth.guard.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; accessToken: string }> {
    const expectedKey = this.configService.get<string>('appKey', '');
    if (!expectedKey) {
      throw new ForbiddenException({
        message: 'Cadastro desabilitado',
        error: 'Forbidden',
        code: 'REGISTRATION_DISABLED',
      });
    }
    if (dto.appKey !== expectedKey) {
      throw new ForbiddenException({
        message: 'Chave de aplicação inválida',
        error: 'Forbidden',
        code: 'INVALID_APP_KEY',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user: Awaited<ReturnType<typeof this.prisma.user.create>>;
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash,
        },
      });
    } catch (e) {
      if (
        e instanceof PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw e;
    }

    const accessToken = await this.signToken(user);
    return {
      user: this.toPublicUser(user),
      accessToken,
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: PublicUser; accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const accessToken = await this.signToken(user);
    return {
      user: this.toPublicUser(user),
      accessToken,
    };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }
    return this.toPublicUser(user);
  }

  private async signToken(user: { id: string; email: string; name: string }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: 'user',
    };
    return this.jwtService.signAsync(payload);
  }

  private toPublicUser(user: { id: string; name: string; email: string }): PublicUser {
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

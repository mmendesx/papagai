import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: { user: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('jwt-token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'appKey') return 'test-app-key';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('register throws ConflictException when create hits unique constraint (P2002)', async () => {
    mockPrismaService.user.create.mockRejectedValue(
      new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      service.register({
        name: 'A',
        email: 'a@example.com',
        password: 'password123',
        appKey: 'test-app-key',
      }),
    ).rejects.toMatchObject({ message: 'E-mail já cadastrado' });
  });
});

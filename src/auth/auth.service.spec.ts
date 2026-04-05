import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuthService } from './auth.service.js';
import { User } from './entities/user.entity.js';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

function uniqueViolationError(): QueryFailedError {
  const driverError = Object.assign(new Error('duplicate key'), { code: '23505' });
  return new QueryFailedError('INSERT INTO users', [], driverError);
}

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: jest.Mocked<Pick<Repository<User>, 'findOne' | 'create' | 'save'>>;

  beforeEach(async () => {
    usersRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
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

  it('register throws ConflictException when save hits unique constraint (23505)', async () => {
    usersRepo.findOne.mockResolvedValue(null);
    usersRepo.create.mockReturnValue({
      id: 'u1',
      name: 'A',
      email: 'a@example.com',
      passwordHash: 'hashed-password',
    } as User);
    usersRepo.save.mockRejectedValue(uniqueViolationError());

    await expect(
      service.register({
        name: 'A',
        email: 'a@example.com',
        password: 'password123',
        appKey: 'test-app-key',
      }),
    ).rejects.toMatchObject({ message: 'Email already registered' });
  });
});

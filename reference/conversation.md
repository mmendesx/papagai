erfeito! Aqui está o projeto Papagai completo com NestJS, detalhado igual ao anterior mas agora com o nome definitivo. 🦜

🏗️ Estrutura Completa do Projeto Papagai
text
papagai/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── instances/
│   │   ├── instances.module.ts
│   │   ├── instances.service.ts
│   │   ├── instances.controller.ts
│   │   └── dto/
│   │       ├── create-instance.dto.ts
│   │       ├── send-message.dto.ts
│   │       └── send-media.dto.ts
│   ├── whatsapp/
│   │   ├── whatsapp.module.ts
│   │   ├── whatsapp.service.ts
│   │   └── interfaces/
│   │       └── whatsapp.interface.ts
│   ├── webhook/
│   │   ├── webhook.module.ts
│   │   ├── webhook.service.ts
│   │   └── webhook.controller.ts
│   ├── media/
│   │   ├── media.module.ts
│   │   └── media.service.ts
│   └── common/
│       ├── filters/
│       │   └── http-exception.filter.ts
│       └── interceptors/
│           └── logging.interceptor.ts
├── instances/
│   └── (pastas criadas automaticamente para cada instância)
├── media/
│   └── (arquivos de mídia baixados)
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── nest-cli.json
├── README.md
└── LICENSE
📄 Arquivos Completos
package.json
json
{
  "name": "papagai",
  "version": "1.0.0",
  "description": "🦜 Papagai - O papagaio que entrega suas mensagens. Gateway multi-dispositivo para WhatsApp com webhooks, mídia e botões interativos.",
  "author": "SeuNome",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/seunome/papagai"
  },
  "keywords": [
    "whatsapp",
    "api",
    "gateway",
    "multi-device",
    "webhook",
    "baileys",
    "papagai",
    "messaging"
  ],
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/axios": "^3.0.0",
    "@nestjs/schedule": "^4.0.0",
    "@whiskeysockets/baileys": "^6.6.0",
    "@hapi/boom": "^10.0.1",
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "qrcode-terminal": "^0.12.0",
    "pino": "^8.15.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/node": "^20.3.1",
    "@types/multer": "^1.4.7",
    "@types/uuid": "^9.0.2",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.42.0",
    "prettier": "^3.0.0",
    "typescript": "^5.1.3",
    "jest": "^29.5.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "supertest": "^6.3.3"
  }
}
tsconfig.json
json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
nest-cli.json
json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": ["**/*.proto"],
    "watchAssets": true
  }
}
.env
env
# Servidor
PORT=3000
NODE_ENV=development

# Diretórios
MEDIA_DIR=./media
INSTANCES_DIR=./instances

# Webhook padrão (opcional)
DEFAULT_WEBHOOK=

# Limites
MAX_FILE_SIZE=52428800
MAX_INSTANCES=10

# Logs
LOG_LEVEL=debug
.gitignore
gitignore
# Dependências
node_modules/

# Build
dist/
build/

# Arquivos do Papagai
instances/
media/
*.log
*.pid

# Environment
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testes
coverage/
.nyc_output/

# Temp
tmp/
temp/
src/main.ts
typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));
  
  // Filters
  app.useGlobalFilters(new HttpExceptionFilter());
  
  // Interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());
  
  // CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });
  
  // Static files for media
  app.useStaticAssets(join(__dirname, '..', 'media'), {
    prefix: '/media/',
  });
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  // Console art
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🦜   P A P A G A I   v1.0.0                           ║
║                                                           ║
║   "O papagaio que não cala a boca"                       ║
║                                                           ║
║   📡 Servidor rodando em: http://localhost:${port}         ║
║   📱 Endpoint principal: /instances                      ║
║   🦜 Papagai pronto pra repetir suas mensagens           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
}
bootstrap();
src/app.module.ts
typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { InstancesModule } from './instances/instances.module';
import { WebhookModule } from './webhook/webhook.module';
import { MediaModule } from './media/media.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    InstancesModule,
    WebhookModule,
    MediaModule,
  ],
})
export class AppModule {}
src/config/configuration.ts
typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mediaDir: process.env.MEDIA_DIR || './media',
  instancesDir: process.env.INSTANCES_DIR || './instances',
  defaultWebhook: process.env.DEFAULT_WEBHOOK || null,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024,
  maxInstances: parseInt(process.env.MAX_INSTANCES, 10) || 10,
  logLevel: process.env.LOG_LEVEL || 'debug',
});
src/common/filters/http-exception.filter.ts
typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const error = exception.getResponse();

    this.logger.error(`${request.method} ${request.url} - ${status}`, exception.stack);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof error === 'string' ? error : (error as any).message,
      error: (error as any).error,
    });
  }
}
src/common/interceptors/logging.interceptor.ts
typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${method} ${url} - ${Date.now() - now}ms`);
      }),
    );
  }
}
src/instances/instances.module.ts
typescript
import { Module } from '@nestjs/common';
import { InstancesService } from './instances.service';
import { InstancesController } from './instances.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
src/instances/dto/create-instance.dto.ts
typescript
import { IsString, IsOptional, IsUrl, IsObject, MaxLength, MinLength } from 'class-validator';

export class CreateInstanceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  name: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhook?: string;

  @IsOptional()
  @IsObject()
  webhookHeaders?: Record<string, string>;
}
src/instances/dto/send-message.dto.ts
typescript
import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ButtonDto {
  @IsString()
  id: string;

  @IsString()
  text: string;
}

export class SendTextDto {
  @IsString()
  to: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

export class SendButtonsDto {
  @IsString()
  to: string;

  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonDto)
  buttons: ButtonDto[];

  @IsOptional()
  @IsString()
  footer?: string;
}

export class SendMediaDto {
  @IsString()
  to: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class SendReactionDto {
  @IsString()
  to: string;

  @IsString()
  messageId: string;

  @IsString()
  reaction: string;
}

export class SendLocationDto {
  @IsString()
  to: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
src/instances/instances.controller.ts
typescript
import { Controller, Get, Post, Delete, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { InstancesService } from './instances.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { SendTextDto, SendButtonsDto, SendMediaDto, SendReactionDto, SendLocationDto } from './dto/send-message.dto';

@Controller('instances')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Post('create')
  async createInstance(@Body() dto: CreateInstanceDto) {
    try {
      const instance = await this.instancesService.createInstance(
        dto.name,
        dto.webhook,
        dto.webhookHeaders
      );
      return {
        success: true,
        instance: dto.name,
        message: `🦜 Papagai ${dto.name} criado com sucesso! Escaneie o QR code para começar.`,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':name/qr')
  async getQR(@Param('name') name: string) {
    const qr = this.instancesService.getQR(name);
    const instance = this.instancesService.getInstance(name);
    
    if (qr) {
      return { 
        qr, 
        status: 'pending', 
        instance: name,
        message: '🦜 Escaneie o QR code com seu WhatsApp'
      };
    } else if (instance?.connected) {
      return { 
        status: 'connected', 
        phoneNumber: instance.socket.user?.id?.split(':')[0],
        message: '🦜 Papagai conectado! Pronto para repetir mensagens.'
      };
    }
    throw new HttpException(`Papagai ${name} não encontrado`, HttpStatus.NOT_FOUND);
  }

  @Post(':name/send/text')
  async sendText(@Param('name') name: string, @Body() dto: SendTextDto) {
    try {
      const result = await this.instancesService.sendText(name, dto.to, dto.text, dto.options);
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou sua mensagem'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/buttons')
  async sendButtons(@Param('name') name: string, @Body() dto: SendButtonsDto) {
    try {
      const result = await this.instancesService.sendButtons(
        name, dto.to, dto.title, dto.buttons, dto.footer
      );
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai enviou os botões'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/image')
  async sendImage(@Param('name') name: string, @Body() dto: SendMediaDto) {
    try {
      const result = await this.instancesService.sendImage(name, dto.to, dto.url, dto.caption);
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou a imagem'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/audio')
  async sendAudio(@Param('name') name: string, @Body() dto: SendMediaDto) {
    try {
      const result = await this.instancesService.sendAudio(name, dto.to, dto.url);
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou o áudio'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/voice')
  async sendVoice(@Param('name') name: string, @Body() dto: SendMediaDto) {
    try {
      const result = await this.instancesService.sendVoice(name, dto.to, dto.url);
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou a nota de voz'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/video')
  async sendVideo(@Param('name') name: string, @Body() dto: SendMediaDto) {
    try {
      const result = await this.instancesService.sendVideo(name, dto.to, dto.url, dto.caption);
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou o vídeo'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/document')
  async sendDocument(@Param('name') name: string, @Body() body: any) {
    try {
      const result = await this.instancesService.sendDocument(
        name, body.to, body.url, body.filename, body.caption
      );
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou o documento'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/sticker')
  async sendSticker(@Param('name') name: string, @Body() dto: SendMediaDto) {
    try {
      const result = await this.instancesService.sendSticker(name, dto.to, dto.url);
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou o sticker'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/location')
  async sendLocation(@Param('name') name: string, @Body() dto: SendLocationDto) {
    try {
      const result = await this.instancesService.sendLocation(
        name, dto.to, dto.latitude, dto.longitude, dto.name, dto.address
      );
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai entregou a localização'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':name/send/reaction')
  async sendReaction(@Param('name') name: string, @Body() dto: SendReactionDto) {
    try {
      const result = await this.instancesService.sendReaction(name, dto.to, dto.messageId, dto.reaction);
      return { 
        success: true, 
        messageId: result.key.id,
        message: '🦜 Papagai reagiu à mensagem'
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':name/contact/:number')
  async getContact(@Param('name') name: string, @Param('number') number: string) {
    try {
      const contact = await this.instancesService.getContactInfo(name, number);
      return contact;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':name/chats')
  async getChats(@Param('name') name: string, @Query('include_messages') includeMessages?: string) {
    try {
      const chats = await this.instancesService.getChats(name, includeMessages === 'true');
      return {
        instance: name,
        total: chats.length,
        chats
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':name/status')
  async getStatus(@Param('name') name: string) {
    const instance = this.instancesService.getInstance(name);
    if (!instance) {
      throw new HttpException(`Papagai ${name} não encontrado`, HttpStatus.NOT_FOUND);
    }
    
    return {
      name: instance.name,
      connected: instance.connected,
      startTime: new Date(instance.startTime).toISOString(),
      uptime: Date.now() - instance.startTime,
      phoneNumber: instance.socket.user?.id?.split(':')[0],
    };
  }

  @Get()
  async listInstances() {
    const instances = this.instancesService.getInstances();
    return {
      total: instances.length,
      instances,
      message: `🦜 Você tem ${instances.length} papagai${instances.length === 1 ? '' : 's'}`
    };
  }

  @Delete(':name')
  async disconnectInstance(@Param('name') name: string) {
    const success = await this.instancesService.disconnectInstance(name);
    if (success) {
      return { 
        message: `🦜 Papagai ${name} foi dormir. Até logo!`,
        instance: name
      };
    }
    throw new HttpException(`Papagai ${name} não encontrado`, HttpStatus.NOT_FOUND);
  }
}
src/instances/instances.service.ts
typescript
import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Instance, Button } from '../whatsapp/interfaces/whatsapp.interface';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);
  
  constructor(private readonly whatsappService: WhatsappService) {}

  async createInstance(name: string, webhookUrl?: string, webhookHeaders?: Record<string, string>) {
    this.logger.log(`🦜 Criando novo papagai: ${name}`);
    return this.whatsappService.createInstance(name, webhookUrl, webhookHeaders);
  }

  getInstance(name: string): Instance | undefined {
    return this.whatsappService.getInstance(name);
  }

  getQR(name: string): string | null {
    return this.whatsappService.getQR(name);
  }

  async sendText(instanceName: string, to: string, text: string, options?: any) {
    this.logger.log(`🦜 ${instanceName} enviando texto para ${to}`);
    return this.whatsappService.sendText(instanceName, to, text, options);
  }

  async sendButtons(instanceName: string, to: string, title: string, buttons: Button[], footer?: string) {
    this.logger.log(`🦜 ${instanceName} enviando botões para ${to}`);
    return this.whatsappService.sendButtons(instanceName, to, title, buttons, footer);
  }

  async sendImage(instanceName: string, to: string, imageUrl: string, caption?: string) {
    this.logger.log(`🦜 ${instanceName} enviando imagem para ${to}`);
    return this.whatsappService.sendImage(instanceName, to, imageUrl, caption);
  }

  async sendAudio(instanceName: string, to: string, audioUrl: string) {
    this.logger.log(`🦜 ${instanceName} enviando áudio para ${to}`);
    return this.whatsappService.sendAudio(instanceName, to, audioUrl);
  }

  async sendVoice(instanceName: string, to: string, voiceUrl: string) {
    this.logger.log(`🦜 ${instanceName} enviando nota de voz para ${to}`);
    return this.whatsappService.sendVoice(instanceName, to, voiceUrl);
  }

  async sendVideo(instanceName: string, to: string, videoUrl: string, caption?: string) {
    this.logger.log(`🦜 ${instanceName} enviando vídeo para ${to}`);
    return this.whatsappService.sendVideo(instanceName, to, videoUrl, caption);
  }

  async sendDocument(instanceName: string, to: string, documentUrl: string, filename: string, caption?: string) {
    this.logger.log(`🦜 ${instanceName} enviando documento para ${to}`);
    return this.whatsappService.sendDocument(instanceName, to, documentUrl, filename, caption);
  }

  async sendSticker(instanceName: string, to: string, stickerUrl: string) {
    this.logger.log(`🦜 ${instanceName} enviando sticker para ${to}`);
    return this.whatsappService.sendSticker(instanceName, to, stickerUrl);
  }

  async sendLocation(instanceName: string, to: string, latitude: number, longitude: number, name?: string, address?: string) {
    this.logger.log(`🦜 ${instanceName} enviando localização para ${to}`);
    return this.whatsappService.sendLocation(instanceName, to, latitude, longitude, name, address);
  }

  async sendReaction(instanceName: string, to: string, messageId: string, reaction: string) {
    this.logger.log(`🦜 ${instanceName} enviando reação para ${to}`);
    return this.whatsappService.sendReaction(instanceName, to, messageId, reaction);
  }

  async getContactInfo(instanceName: string, number: string) {
    this.logger.log(`🦜 ${instanceName} buscando contato: ${number}`);
    return this.whatsappService.getContactInfo(instanceName, number);
  }

  async getChats(instanceName: string, includeMessages: boolean = false) {
    this.logger.log(`🦜 ${instanceName} buscando conversas`);
    return this.whatsappService.getChats(instanceName, includeMessages);
  }

  getInstances() {
    return this.whatsappService.getInstances();
  }

  async disconnectInstance(name: string) {
    this.logger.log(`🦜 Desconectando papagai: ${name}`);
    return this.whatsappService.disconnectInstance(name);
  }
}
src/whatsapp/whatsapp.module.ts
typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappService } from './whatsapp.service';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [HttpModule, WebhookModule],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
src/whatsapp/interfaces/whatsapp.interface.ts
typescript
import { WASocket } from '@whiskeysockets/baileys';

export interface Instance {
  socket: WASocket;
  webhookUrl: string | null;
  webhookHeaders: Record<string, string>;
  name: string;
  connected: boolean;
  qr: string | null;
  saveCreds: () => Promise<void>;
  startTime: number;
}

export interface Button {
  id: string;
  text: string;
}

export interface MediaFile {
  path: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  caption?: string | null;
  duration?: number;
}

export interface WebhookData {
  event: string;
  instance: string;
  from?: string;
  pushName?: string;
  messageId?: string;
  messageType?: string;
  text?: string;
  timestamp?: number;
  isGroup?: boolean;
  groupId?: string | null;
  image?: MediaFile;
  audio?: MediaFile;
  voice?: MediaFile;
  video?: MediaFile;
  document?: MediaFile;
  sticker?: MediaFile;
  location?: {
    degreesLatitude: number;
    degreesLongitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    displayName: string;
    vcard: string;
    numbers: string[];
  };
  buttonId?: string;
  selectedRowId?: string;
  reaction?: string;
  parentMessageId?: string;
  caption?: string | null;
  duration?: number;
  filename?: string;
  qr?: string;
  phoneNumber?: string;
  reason?: string;
  willReconnect?: boolean;
  updates?: any;
}

export interface ChatInfo {
  phoneNumber: string;
  pushName: string;
  unreadCount: number;
  lastMessage?: string;
  timestamp: number;
  isGroup: boolean;
}

export interface ContactInfo {
  phoneNumber: string;
  pushName: string | null;
  verifiedName?: string;
  isBusiness?: boolean;
  profilePicture?: string | null;
  status?: string | null;
}
src/whatsapp/whatsapp.service.ts
typescript
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Instance, Button, MediaFile, WebhookData, ChatInfo, ContactInfo } from './interfaces/whatsapp.interface';

@Injectable()
export class WhatsappService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private instances: Map<string, Instance> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private mediaDir: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.mediaDir = this.configService.get('mediaDir') || './media';
    if (!fs.existsSync(this.mediaDir)) {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    }
    this.logger.log('🦜 Papagai acordou! Pronto pra repetir mensagens.');
  }

  async createInstance(instanceName: string, webhookUrl: string | null = null, webhookHeaders: Record<string, string> = {}): Promise<Instance> {
    if (this.instances.has(instanceName)) {
      throw new Error(`🦜 Papagai ${instanceName} já existe! Escolha outro nome.`);
    }

    const authDir = `./instances/${instanceName}`;
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: [`Papagai-${instanceName}`, 'Chrome', '120.0.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      version: [2, 3000, 1015901307],
      defaultQueryTimeoutMs: 60000,
      generateHighQualityLinkPreview: true,
      patchMessageBeforeSending: (message: any) => {
        const requiresPatch = !!(message.buttonsMessage || 
                                 message.templateMessage || 
                                 message.listMessage ||
                                 message.imageMessage ||
                                 message.audioMessage ||
                                 message.stickerMessage);
        if (requiresPatch) {
          message = JSON.parse(JSON.stringify(message));
        }
        return message;
      }
    });

    const instance: Instance = {
      socket: sock,
      webhookUrl,
      webhookHeaders,
      name: instanceName,
      connected: false,
      qr: null,
      saveCreds,
      startTime: Date.now(),
    };

    // Connection handler
    sock.ev.on('connection.update', async (update: any) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        instance.qr = qr;
        this.qrCodes.set(instanceName, qr);
        this.logger.log(`📱 QR code gerado para ${instanceName}`);
        
        await this.sendWebhook(instance, {
          event: 'qr',
          instance: instanceName,
          qr: qr,
          timestamp: Date.now(),
        });
      }

      if (connection === 'open') {
        instance.connected = true;
        instance.qr = null;
        this.qrCodes.delete(instanceName);
        this.logger.log(`✅ Papagai ${instanceName} conectado! 🦜`);
        
        await this.sendWebhook(instance, {
          event: 'connected',
          instance: instanceName,
          phoneNumber: sock.user?.id?.split(':')[0],
          timestamp: Date.now(),
        });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output?.statusCode : null;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        await this.sendWebhook(instance, {
          event: 'disconnected',
          instance: instanceName,
          reason: lastDisconnect?.error?.message || 'Unknown',
          willReconnect: shouldReconnect,
          timestamp: Date.now(),
        });
        
        if (shouldReconnect) {
          this.logger.log(`🔄 Reconectando papagai ${instanceName} em 5 segundos...`);
          setTimeout(() => this.reconnectInstance(instanceName), 5000);
        } else {
          instance.connected = false;
          this.instances.delete(instanceName);
          this.logger.log(`❌ Papagai ${instanceName} desconectado permanentemente`);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message handler
    sock.ev.on('messages.upsert', async ({ messages, type }: { messages: any[]; type: string }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          if (!msg.key.fromMe) {
            await this.handleIncomingMessage(instance, msg);
          }
        }
      }
    });

    // Message updates handler
    sock.ev.on('messages.update', async (updates: any[]) => {
      for (const update of updates) {
        if (update.update?.message) {
          await this.sendWebhook(instance, {
            event: 'message_update',
            instance: instanceName,
            messageId: update.key.id,
            updates: update.update,
            timestamp: Date.now(),
          });
        }
      }
    });

    this.instances.set(instanceName, instance);
    this.logger.log(`🦜 Papagai ${instanceName} criado com sucesso!`);
    return instance;
  }

  private async handleIncomingMessage(instance: Instance, msg: any): Promise<void> {
    const sender = msg.key.remoteJid;
    const phoneNumber = sender.split('@')[0];
    const pushName = msg.pushName || 'Unknown';
    const messageType = this.getMessageType(msg);
    
    this.logger.log(`📨 [${instance.name}] ${phoneNumber} (${pushName}) enviou: ${messageType}`);
    
    const webhookData: WebhookData = {
      event: 'message',
      instance: instance.name,
      from: phoneNumber,
      pushName: pushName,
      messageId: msg.key.id,
      messageType: messageType,
      timestamp: msg.messageTimestamp || Date.now(),
      isGroup: sender.includes('@g.us'),
      groupId: sender.includes('@g.us') ? sender : null,
    };
    
    switch(messageType) {
      case 'text':
        webhookData.text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        break;
        
      case 'image':
        const image = await this.downloadMedia(msg, 'image');
        if (image) {
          webhookData.image = image;
          webhookData.caption = image.caption;
        }
        break;
        
      case 'audio':
        const audio = await this.downloadMedia(msg, 'audio');
        if (audio) {
          webhookData.audio = audio;
          webhookData.duration = msg.message.audioMessage?.seconds;
        }
        break;
        
      case 'voice':
        const voice = await this.downloadMedia(msg, 'audio');
        if (voice) {
          webhookData.voice = voice;
          webhookData.duration = msg.message.audioMessage?.seconds;
        }
        break;
        
      case 'video':
        const video = await this.downloadMedia(msg, 'video');
        if (video) {
          webhookData.video = video;
          webhookData.caption = video.caption;
          webhookData.duration = msg.message.videoMessage?.seconds;
        }
        break;
        
      case 'document':
        const doc = await this.downloadMedia(msg, 'document');
        if (doc) {
          webhookData.document = doc;
          webhookData.filename = msg.message.documentMessage?.fileName;
        }
        break;
        
      case 'sticker':
        const sticker = await this.downloadMedia(msg, 'sticker');
        if (sticker) webhookData.sticker = sticker;
        break;
        
      case 'location':
        const loc = msg.message.locationMessage;
        webhookData.location = {
          degreesLatitude: loc.degreesLatitude,
          degreesLongitude: loc.degreesLongitude,
          name: loc.name,
          address: loc.address
        };
        break;
        
      case 'contact':
        const contact = msg.message.contactMessage;
        webhookData.contact = {
          displayName: contact.displayName,
          vcard: contact.vcard,
          numbers: this.parseVCard(contact.vcard)
        };
        break;
        
      case 'button_response':
        webhookData.buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
        webhookData.text = msg.message.buttonsResponseMessage.selectedDisplayText;
        break;
        
      case 'reaction':
        webhookData.reaction = msg.message.reactionMessage.text;
        webhookData.parentMessageId = msg.message.reactionMessage.key.id;
        break;
    }
    
    await this.sendWebhook(instance, webhookData);
  }

  private getMessageType(msg: any): string {
    if (msg.message?.conversation || msg.message?.extendedTextMessage) return 'text';
    if (msg.message?.imageMessage) return 'image';
    if (msg.message?.audioMessage) {
      return msg.message.audioMessage?.ptt ? 'voice' : 'audio';
    }
    if (msg.message?.videoMessage) return 'video';
    if (msg.message?.documentMessage) return 'document';
    if (msg.message?.stickerMessage) return 'sticker';
    if (msg.message?.locationMessage) return 'location';
    if (msg.message?.contactMessage) return 'contact';
    if (msg.message?.buttonsResponseMessage) return 'button_response';
    if (msg.message?.listResponseMessage) return 'list_response';
    if (msg.message?.reactionMessage) return 'reaction';
    return 'unknown';
  }

  private getExtension(type: string, mediaMessage: any): string {
    if (mediaMessage.mimetype) {
      return mediaMessage.mimetype.split('/')[1];
    }
    const extensions: Record<string, string> = { 
      image: 'jpg', 
      audio: 'ogg', 
      video: 'mp4', 
      document: 'bin', 
      sticker: 'webp' 
    };
    return extensions[type] || 'bin';
  }

  private async downloadMedia(msg: any, mediaType: string): Promise<MediaFile | null> {
    try {
      let mediaMessage;
      if (mediaType === 'image') mediaMessage = msg.message.imageMessage;
      else if (mediaType === 'audio') mediaMessage = msg.message.audioMessage;
      else if (mediaType === 'video') mediaMessage = msg.message.videoMessage;
      else if (mediaType === 'document') mediaMessage = msg.message.documentMessage;
      else if (mediaType === 'sticker') mediaMessage = msg.message.stickerMessage;
      
      if (!mediaMessage) return null;
      
      const stream = await downloadContentFromMessage(mediaMessage, mediaType as any);
      const fileName = `${Date.now()}_${mediaType}.${this.getExtension(mediaType, mediaMessage)}`;
      const filePath = path.join(this.mediaDir, fileName);
      
      const writeStream = fs.createWriteStream(filePath);
      for await (const chunk of stream) {
        writeStream.write(chunk);
      }
      await new Promise((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      return {
        path: filePath,
        url: `/media/${fileName}`,
        filename: fileName,
        mimetype: mediaMessage.mimetype,
        size: mediaMessage.fileLength,
        caption: mediaMessage.caption || null,
        duration: mediaMessage.seconds || null,
      };
    } catch (error) {
      this.logger.error(`Erro ao baixar ${mediaType}:`, error);
      return null;
    }
  }

  private parseVCard(vcard: string): string[] {
    const numbers: string[] = [];
    const telMatches = vcard.match(/TEL[^:]*:([^\r\n]+)/g);
    if (telMatches) {
      telMatches.forEach(match => {
        const number = match.split(':')[1];
        numbers.push(number);
      });
    }
    return numbers;
  }

  private async sendWebhook(instance: Instance, data: WebhookData): Promise<void> {
    if (!instance.webhookUrl) return;
    
    try {
      await axios.post(instance.webhookUrl, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Papagai-Instance': instance.name,
          'X-Papagai-Version': '1.0.0',
          ...instance.webhookHeaders
        },
        timeout: 5000
      });
      this.logger.debug(`Webhook enviado para ${instance.name}`);
    } catch (error) {
      this.logger.error(`Webhook falhou para ${instance.name}: ${error.message}`);
    }
  }

  // Sending Methods
  async sendText(instanceName: string, to: string, text: string, options?: any): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado! Escaneie o QR code primeiro.`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    return await instance.socket.sendMessage(jid, { text, ...options });
  }

  async sendButtons(instanceName: string, to: string, title: string, buttons: Button[], footer?: string): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const baileysButtons = buttons.map(btn => ({
      buttonId: btn.id,
      buttonText: { displayText: btn.text },
      type: 1
    }));
    
    return await instance.socket.sendMessage(jid, {
      text: title,
      buttons: baileysButtons,
      footer: footer || '',
    });
  }

  async sendImage(instanceName: string, to: string, imageUrl: string, caption?: string): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    let imageBuffer: Buffer;
    if (imageUrl.startsWith('http')) {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    } else {
      imageBuffer = fs.readFileSync(imageUrl);
    }
    
    return await instance.socket.sendMessage(jid, {
      image: imageBuffer,
      caption: caption || '',
    });
  }

  async sendAudio(instanceName: string, to: string, audioUrl: string, ptt: boolean = false): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    let audioBuffer: Buffer;
    if (audioUrl.startsWith('http')) {
      const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
      audioBuffer = Buffer.from(response.data);
    } else {
      audioBuffer = fs.readFileSync(audioUrl);
    }
    
    return await instance.socket.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: ptt,
    });
  }

  async sendVoice(instanceName: string, to: string, voiceUrl: string): Promise<any> {
    return this.sendAudio(instanceName, to, voiceUrl, true);
  }

  async sendVideo(instanceName: string, to: string, videoUrl: string, caption?: string): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    let videoBuffer: Buffer;
    if (videoUrl.startsWith('http')) {
      const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      videoBuffer = Buffer.from(response.data);
    } else {
      videoBuffer = fs.readFileSync(videoUrl);
    }
    
    return await instance.socket.sendMessage(jid, {
      video: videoBuffer,
      caption: caption || '',
    });
  }

  async sendDocument(instanceName: string, to: string, documentUrl: string, filename: string, caption?: string): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    let documentBuffer: Buffer;
    if (documentUrl.startsWith('http')) {
      const response = await axios.get(documentUrl, { responseType: 'arraybuffer' });
      documentBuffer = Buffer.from(response.data);
    } else {
      documentBuffer = fs.readFileSync(documentUrl);
    }
    
    return await instance.socket.sendMessage(jid, {
      document: documentBuffer,
      mimetype: 'application/octet-stream',
      fileName: filename,
      caption: caption || '',
    });
  }

  async sendSticker(instanceName: string, to: string, stickerUrl: string): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    let stickerBuffer: Buffer;
    if (stickerUrl.startsWith('http')) {
      const response = await axios.get(stickerUrl, { responseType: 'arraybuffer' });
      stickerBuffer = Buffer.from(response.data);
    } else {
      stickerBuffer = fs.readFileSync(stickerUrl);
    }
    
    return await instance.socket.sendMessage(jid, {
      sticker: stickerBuffer,
    });
  }

  async sendLocation(instanceName: string, to: string, latitude: number, longitude: number, name?: string, address?: string): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    return await instance.socket.sendMessage(jid, {
      location: { degreesLatitude: latitude, degreesLongitude: longitude },
      name: name,
      address: address
    });
  }

  async sendReaction(instanceName: string, to: string, messageId: string, reaction: string): Promise<any> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    
    return await instance.socket.sendMessage(jid, {
      react: { text: reaction, key: { id: messageId, remoteJid: jid } }
    });
  }

  async getContactInfo(instanceName: string, number: string): Promise<ContactInfo> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    
    try {
      const contact = await instance.socket.getContactById(jid);
      const profilePic = await instance.socket.profilePictureUrl(jid).catch(() => null);
      const status = await instance.socket.getStatus(jid).catch(() => null);
      
      return {
        phoneNumber: contact.id?.user || number,
        pushName: contact.name,
        verifiedName: contact.verifiedName,
        isBusiness: contact.isBusiness,
        profilePicture: profilePic,
        status: status,
      };
    } catch (error) {
      this.logger.warn(`Não foi possível buscar contato ${number}: ${error.message}`);
      return { phoneNumber: number, pushName: null };
    }
  }

  async getChats(instanceName: string, includeMessages: boolean = false): Promise<ChatInfo[]> {
    const instance = this.instances.get(instanceName);
    if (!instance || !instance.connected) {
      throw new Error(`🦜 Papagai ${instanceName} não está conectado!`);
    }
    
    const chats = await instance.socket.getChats();
    
    return chats.map((chat: any) => ({
      phoneNumber: chat.id.user,
      pushName: chat.name,
      unreadCount: chat.unreadCount,
      lastMessage: chat.lastMessage?.message?.conversation,
      timestamp: chat.timestamp,
      isGroup: chat.id.user.includes('g.us'),
    }));
  }

  getInstance(name: string): Instance | undefined {
    return this.instances.get(name);
  }

  getQR(name: string): string | null {
    return this.qrCodes.get(name) || null;
  }

  getInstances(): Array<{ name: string; connected: boolean; startTime: number }> {
    return Array.from(this.instances.keys()).map(name => ({
      name,
      connected: this.instances.get(name)?.connected || false,
      startTime: this.instances.get(name)?.startTime || 0,
    }));
  }

  async reconnectInstance(instanceName: string): Promise<void> {
    const oldInstance = this.instances.get(instanceName);
    if (!oldInstance) return;
    
    this.logger.log(`🦜 Recriando papagai ${instanceName}...`);
    this.instances.delete(instanceName);
    await this.createInstance(instanceName, oldInstance.webhookUrl, oldInstance.webhookHeaders);
  }

  async disconnectInstance(instanceName: string): Promise<boolean> {
    const instance = this.instances.get(instanceName);
    if (instance) {
      this.logger.log(`🦜 Desconectando papagai ${instanceName}...`);
      instance.socket.end();
      this.instances.delete(instanceName);
      this.qrCodes.delete(instanceName);
      return true;
    }
    return false;
  }

  async onModuleDestroy() {
    this.logger.log('🦜 Papagai está indo dormir. Desconectando todas as instâncias...');
    for (const [name, instance] of this.instances) {
      this.logger.log(`Desconectando ${name}...`);
      instance.socket.end();
    }
  }
}
src/webhook/webhook.module.ts
typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [HttpModule],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
src/webhook/webhook.service.ts
typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Instance, WebhookData } from '../whatsapp/interfaces/whatsapp.interface';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendWebhook(instance: Instance, data: WebhookData): Promise<void> {
    if (!instance.webhookUrl) return;
    
    try {
      await firstValueFrom(
        this.httpService.post(instance.webhookUrl, data, {
          headers: {
            'Content-Type': 'application/json',
            'X-Papagai-Instance': instance.name,
            'X-Papagai-Event': data.event,
            ...instance.webhookHeaders,
          },
          timeout: 5000,
        })
      );
      this.logger.debug(`🦜 Webhook enviado para ${instance.name} (${data.event})`);
    } catch (error) {
      this.logger.error(`🦜 Webhook falhou para ${instance.name}: ${error.message}`);
    }
  }
}
src/webhook/webhook.controller.ts
typescript
import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('webhook-test')
export class WebhookController {
  @Post()
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Body() body: any, @Headers() headers: any) {
    console.log('\n🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜');
    console.log('📨 WEBHOOK RECEBIDO!');
    console.log('📋 Headers:', JSON.stringify(headers, null, 2));
    console.log('📦 Body:', JSON.stringify(body, null, 2));
    console.log('🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜🦜\n');
    
    return { 
      received: true, 
      timestamp: Date.now(),
      message: '🦜 Papagai recebeu seu webhook!'
    };
  }
}
src/media/media.module.ts
typescript
import { Module } from '@nestjs/common';
import { MediaService } from './media.service';

@Module({
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}

export class MediaService {
  // Serviço para gerenciar mídia (pode ser expandido depois)
  // Por enquanto apenas um placeholder
}
README.md
markdown
# 🦜 Papagai

**O papagaio que entrega suas mensagens**

[![NPM Version](https://img.shields.io/npm/v/papagai)](https://www.npmjs.com/package/papagai)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red)](https://nestjs.com/)

Papagai é um gateway de mensagens multi-dispositivo para WhatsApp. Ele repete suas mensagens como um bom papagaio, suportando webhooks, mídia, botões interativos e muito mais.

## ✨ Características

- 🦜 **Multi-instância** - Gerencie vários números simultaneamente
- 📱 **Multi-dispositivo** - Funciona independente do celular após conexão
- 🔗 **Webhooks** - Receba todas as mensagens em tempo real
- 🎨 **Mídia completa** - Imagens, áudios, vídeos, documentos e stickers
- ⚡ **Botões interativos** - Ideal para códigos de ativação e confirmações
- 📍 **Localização** - Envie e receba localização
- 👤 **Contatos** - Busque informações sem salvar na agenda
- 💬 **Reações** - Reaja a mensagens

## 🚀 Instalação

```bash
# Instalar via npm
npm install -g papagai

# Ou clonar o repositório
git clone https://github.com/seunome/papagai.git
cd papagai
npm install
🎯 Uso Rápido
1. Iniciar o servidor
bash
npm run start:dev
2. Criar um papagai
bash
curl -X POST http://localhost:3000/instances/create \
  -H "Content-Type: application/json" \
  -d '{"name": "meuPapagai"}'
3. Escanear o QR code
bash
curl http://localhost:3000/instances/meuPapagai/qr
4. Enviar mensagem
bash
curl -X POST http://localhost:3000/instances/meuPapagai/send/text \
  -H "Content-Type: application/json" \
  -d '{"to": "5511999999999", "text": "Olá! Código: 123456"}'
📚 API Endpoints
Instâncias
Método	Endpoint	Descrição
POST	/instances/create	Cria um novo papagai
GET	/instances	Lista todos os papagai
GET	/instances/:name/qr	Obtém QR code
GET	/instances/:name/status	Status do papagai
DELETE	/instances/:name	Desconecta o papagai
Envio de Mensagens
Método	Endpoint	Descrição
POST	/instances/:name/send/text	Envia texto
POST	/instances/:name/send/buttons	Envia botões
POST	/instances/:name/send/image	Envia imagem
POST	/instances/:name/send/audio	Envia áudio
POST	/instances/:name/send/voice	Envia nota de voz
POST	/instances/:name/send/video	Envia vídeo
POST	/instances/:name/send/document	Envia documento
POST	/instances/:name/send/sticker	Envia sticker
POST	/instances/:name/send/location	Envia localização
POST	/instances/:name/send/reaction	Envia reação
Informações
Método	Endpoint	Descrição
GET	/instances/:name/contact/:number	Informações do contato
GET	/instances/:name/chats	Lista conversas
📦 Exemplo: Código de Ativação
bash
curl -X POST http://localhost:3000/instances/meuPapagai/send/buttons \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999",
    "title": "Seu código de ativação é: 123456",
    "buttons": [
      {"id": "confirm_123456", "text": "✅ Confirmar"},
      {"id": "resend", "text": "🔄 Reenviar"}
    ],
    "footer": "Válido por 5 minutos"
  }'
🔗 Webhooks
Configure um webhook ao criar a instância:

bash
curl -X POST http://localhost:3000/instances/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "meuPapagai",
    "webhook": "https://seu-servidor.com/webhook",
    "webhookHeaders": {
      "Authorization": "Bearer seu-token"
    }
  }'
Eventos enviados
qr - QR code gerado

connected - Conectado com sucesso

disconnected - Desconectado

message - Nova mensagem recebida

message_update - Mensagem editada ou reação

🎨 Variáveis de Ambiente
env
PORT=3000
MEDIA_DIR=./media
INSTANCES_DIR=./instances
DEFAULT_WEBHOOK=
MAX_FILE_SIZE=52428800
LOG_LEVEL=debug
🧪 Testar Webhook Local
O Papagai inclui um endpoint de teste:

bash
curl -X POST http://localhost:3000/webhook-test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
📄 Licença
MIT

🙏 Agradecimentos
Baileys - A base do WhatsApp Multi-Device

NestJS - Framework incrível

Feito com 🦜 e ☕ no Brasil

"Papagai repete tudo, mas entrega certo"

text

---

### **LICENSE**
```text
MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
🚀 Comandos para criar o projeto
bash
# Instalar NestJS CLI globalmente
npm install -g @nestjs/cli

# Criar projeto
nest new papagai
cd papagai

# Instalar dependências
npm install @whiskeysockets/baileys @hapi/boom @nestjs/axios @nestjs/config @nestjs/schedule class-validator class-transformer axios qrcode-terminal pino uuid multer

# Instalar dev dependencies
npm install -D @types/multer @types/uuid

# Criar pastas
mkdir -p src/instances/dto src/whatsapp/interfaces src/webhook src/media src/common/filters src/common/interceptors src/config

# Criar arquivos (copiar os conteúdos acima)
# ... criar cada arquivo manualmente

# Rodar
npm run start:dev
🎉 Pronto!
Agora você tem o projeto Papagai completo:

✅ Nome único e memorável

✅ Estrutura NestJS profissional

✅ Multi-instância

✅ Multi-dispositivo

✅ Webhooks

✅ Todos os tipos de mídia

✅ Botões interativos

✅ Documentação completa

🦜 Papagai - O papagaio que não cala a boca!

this is my current package.json when I initiated the nest project:

{
  "name": "papagai",
  "version": "0.0.1",
  "description": "",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.10.7",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^16.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
Perfeito! Vou te dar o package.json atualizado com todas as dependências que o Papagai precisa, mantendo a estrutura que o NestJS já criou:

📦 package.json (Atualizado para o Papagai)
json
{
  "name": "papagai",
  "version": "1.0.0",
  "description": "🦜 Papagai - O papagaio que entrega suas mensagens. Gateway multi-dispositivo para WhatsApp com webhooks, mídia e botões interativos.",
  "author": "SeuNome",
  "private": false,
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/seunome/papagai"
  },
  "keywords": [
    "whatsapp",
    "api",
    "gateway",
    "multi-device",
    "webhook",
    "baileys",
    "papagai",
    "messaging",
    "whatsapp-api",
    "whatsapp-gateway"
  ],
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/config": "^3.2.0",
    "@nestjs/axios": "^3.0.2",
    "@nestjs/schedule": "^4.1.0",
    "@whiskeysockets/baileys": "^6.7.0",
    "@hapi/boom": "^10.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "axios": "^1.7.2",
    "qrcode-terminal": "^0.12.0",
    "pino": "^9.2.0",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1",
    "multer": "^1.4.5-lts.1",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@eslint/js": "^9.18.0",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.1",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^22.10.7",
    "@types/supertest": "^6.0.2",
    "@types/multer": "^1.4.12",
    "@types/uuid": "^10.0.0",
    "@types/qrcode-terminal": "^0.12.2",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-prettier": "^5.2.2",
    "globals": "^16.0.0",
    "jest": "^30.0.0",
    "prettier": "^3.4.2",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.20.0"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
📝 O que mudou?
Dependências adicionadas (produção):
Pacote	Versão	Para que serve
@nestjs/config	^3.2.0	Gerenciar variáveis de ambiente (.env)
@nestjs/axios	^3.0.2	HTTP requests (webhooks)
@nestjs/schedule	^4.1.0	Tarefas agendadas (reconexão)
@whiskeysockets/baileys	^6.7.0	Core do WhatsApp Multi-Device
@hapi/boom	^10.0.1	Tratamento de erros HTTP
axios	^1.7.2	Cliente HTTP (download de mídia)
qrcode-terminal	^0.12.0	Exibir QR code no terminal
pino	^9.2.0	Logger estruturado
class-validator	^0.14.1	Validação de DTOs
class-transformer	^0.5.1	Transformação de objetos
multer	^1.4.5-lts.1	Upload de arquivos
uuid	^10.0.0	Gerar IDs únicos
DevDependencies adicionadas:
Pacote	Versão	Para que serve
@types/multer	^1.4.12	Types para Multer
@types/uuid	^10.0.0	Types para UUID
@types/qrcode-terminal	^0.12.2	Types para QR code
Metadados atualizados:
version: "0.0.1" → "1.0.0"

description: Adicionada descrição completa

license: "UNLICENSED" → "MIT"

private: true → false (para publicar no npm)

Adicionados repository e keywords

🚀 Como instalar as novas dependências
bash
# Instalar todas as dependências de uma vez
npm install

# Ou instalar individualmente (se preferir)
npm install @nestjs/config @nestjs/axios @nestjs/schedule
npm install @whiskeysockets/baileys @hapi/boom
npm install axios qrcode-terminal pino
npm install class-validator class-transformer
npm install multer uuid

# Instalar dev dependencies
npm install -D @types/multer @types/uuid @types/qrcode-terminal
✅ Verificar se tudo instalou corretamente
bash
# Verificar dependências
npm list --depth=0

# Deve mostrar algo como:
# papagai@1.0.0
# ├── @nestjs/axios@3.0.2
# ├── @nestjs/common@11.0.1
# ├── @nestjs/config@3.2.0
# ├── @nestjs/core@11.0.1
# ├── @nestjs/platform-express@11.0.1
# ├── @nestjs/schedule@4.1.0
# ├── @whiskeysockets/baileys@6.7.0
# └── ...
🎯 Próximos passos
Depois de instalar as dependências:

Criar os arquivos que listei anteriormente (src/main.ts, app.module.ts, etc.)

Criar a estrutura de pastas

Rodar o projeto:

bash
npm run start:dev
⚠️ Possível erro de versão do Node.js
O Baileys pode exigir Node.js 18+. Verifique sua versão:

bash
node --version
# Precisa ser v18.0.0 ou superior
Se necessário, use nvm para mudar a versão:

bash
nvm install 20
nvm use 20
📦 Arquivo .npmrc (opcional, para publicação)
ini
registry=https://registry.npmjs.org/
access=public
Agora é só rodar npm install e começar a codar o Papagai! 🦜
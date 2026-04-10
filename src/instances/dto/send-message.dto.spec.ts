import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  MetaMessageDto,
  MessageType,
  TextBodyDto,
  MediaDto,
  AudioDto,
  DocumentDto,
  StickerDto,
  LocationDto,
  ReactionDto,
  InteractiveDto,
} from './send-message.dto';

describe('TextBodyDto', () => {
  it('accepts a valid body', async () => {
    const dto = plainToInstance(TextBodyDto, { body: 'Hello' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing body', async () => {
    const dto = plainToInstance(TextBodyDto, {});
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects empty body', async () => {
    const dto = plainToInstance(TextBodyDto, { body: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects body exceeding 4096 characters', async () => {
    const dto = plainToInstance(TextBodyDto, { body: 'a'.repeat(4097) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('accepts body of exactly 4096 characters', async () => {
    const dto = plainToInstance(TextBodyDto, { body: 'a'.repeat(4096) });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('MediaDto', () => {
  it('accepts a valid link', async () => {
    const dto = plainToInstance(MediaDto, {
      link: 'https://example.com/img.jpg',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing link', async () => {
    const dto = plainToInstance(MediaDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'link')).toBe(true);
  });

  it('rejects non-URL link', async () => {
    const dto = plainToInstance(MediaDto, { link: 'not a url' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'link')).toBe(true);
  });

  it('accepts optional caption', async () => {
    const dto = plainToInstance(MediaDto, {
      link: 'https://example.com/img.jpg',
      caption: 'A caption',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects caption exceeding 1024 characters', async () => {
    const dto = plainToInstance(MediaDto, {
      link: 'https://example.com/img.jpg',
      caption: 'a'.repeat(1025),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'caption')).toBe(true);
  });
});

describe('AudioDto', () => {
  it('accepts a valid link', async () => {
    const dto = plainToInstance(AudioDto, {
      link: 'https://example.com/audio.ogg',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing link', async () => {
    const dto = plainToInstance(AudioDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'link')).toBe(true);
  });

  it('accepts ptt: true', async () => {
    const dto = plainToInstance(AudioDto, {
      link: 'https://example.com/audio.ogg',
      ptt: true,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects ptt as non-boolean', async () => {
    const dto = plainToInstance(AudioDto, {
      link: 'https://example.com/audio.ogg',
      ptt: 'yes',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ptt')).toBe(true);
  });
});

describe('DocumentDto', () => {
  it('accepts a valid link', async () => {
    const dto = plainToInstance(DocumentDto, {
      link: 'https://example.com/file.pdf',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing link', async () => {
    const dto = plainToInstance(DocumentDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'link')).toBe(true);
  });

  it('accepts optional filename', async () => {
    const dto = plainToInstance(DocumentDto, {
      link: 'https://example.com/file.pdf',
      filename: 'document.pdf',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects caption exceeding 1024 characters', async () => {
    const dto = plainToInstance(DocumentDto, {
      link: 'https://example.com/file.pdf',
      caption: 'a'.repeat(1025),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'caption')).toBe(true);
  });
});

describe('StickerDto', () => {
  it('accepts a valid link', async () => {
    const dto = plainToInstance(StickerDto, {
      link: 'https://example.com/sticker.webp',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing link', async () => {
    const dto = plainToInstance(StickerDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'link')).toBe(true);
  });
});

describe('LocationDto', () => {
  it('accepts valid latitude and longitude', async () => {
    const dto = plainToInstance(LocationDto, {
      latitude: -23.5,
      longitude: -46.6,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing latitude', async () => {
    const dto = plainToInstance(LocationDto, { longitude: -46.6 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects missing longitude', async () => {
    const dto = plainToInstance(LocationDto, { latitude: -23.5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('rejects latitude below -90', async () => {
    const dto = plainToInstance(LocationDto, { latitude: -91, longitude: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects latitude above 90', async () => {
    const dto = plainToInstance(LocationDto, { latitude: 91, longitude: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects longitude below -180', async () => {
    const dto = plainToInstance(LocationDto, { latitude: 0, longitude: -181 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('rejects longitude above 180', async () => {
    const dto = plainToInstance(LocationDto, { latitude: 0, longitude: 181 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('accepts boundary values latitude=90, longitude=180', async () => {
    const dto = plainToInstance(LocationDto, { latitude: 90, longitude: 180 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts optional name', async () => {
    const dto = plainToInstance(LocationDto, {
      latitude: 0,
      longitude: 0,
      name: 'HQ',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects name exceeding 255 characters', async () => {
    const dto = plainToInstance(LocationDto, {
      latitude: 0,
      longitude: 0,
      name: 'a'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});

describe('ReactionDto', () => {
  it('accepts valid message_id and emoji', async () => {
    const dto = plainToInstance(ReactionDto, {
      message_id: 'msg-abc',
      emoji: '👍',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing message_id', async () => {
    const dto = plainToInstance(ReactionDto, { emoji: '👍' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'message_id')).toBe(true);
  });

  it('rejects missing emoji', async () => {
    const dto = plainToInstance(ReactionDto, { message_id: 'msg-abc' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emoji')).toBe(true);
  });

  it('rejects emoji exceeding 8 characters', async () => {
    const dto = plainToInstance(ReactionDto, {
      message_id: 'msg-abc',
      emoji: 'a'.repeat(9),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emoji')).toBe(true);
  });
});

describe('InteractiveDto', () => {
  it('accepts a valid type', async () => {
    const dto = plainToInstance(InteractiveDto, { type: 'button' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing type', async () => {
    const dto = plainToInstance(InteractiveDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects empty type', async () => {
    const dto = plainToInstance(InteractiveDto, { type: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('accepts optional action, body, footer, header fields', async () => {
    const dto = plainToInstance(InteractiveDto, {
      type: 'list',
      action: { button: 'Select' },
      body: { text: 'Choose one' },
      footer: { text: 'footer' },
      header: { type: 'text', text: 'Header' },
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('MetaMessageDto', () => {
  it('accepts a valid text message', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'text',
      text: { body: 'Hello' },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects missing to', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      type: 'text',
      text: { body: 'hi' },
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects empty to', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '',
      type: 'text',
      text: { body: 'hi' },
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects missing type', async () => {
    const dto = plainToInstance(MetaMessageDto, { to: '5511999999999' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects invalid type', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'fax',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('accepts all valid MessageType enum values', async () => {
    for (const type of Object.values(MessageType)) {
      const dto = plainToInstance(MetaMessageDto, {
        to: '5511999999999',
        type,
      });
      const errors = await validate(dto);
      const typeErrors = errors.filter((e) => e.property === 'type');
      expect(typeErrors).toHaveLength(0);
    }
  });

  it('validates nested text.body when present', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'text',
      text: { body: '' },
    });
    const errors = await validate(dto, { validationError: { target: false } });
    const textError = errors.find((e) => e.property === 'text');
    expect(textError).toBeDefined();
  });

  it('rejects nested text.body exceeding 4096 characters', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'text',
      text: { body: 'a'.repeat(4097) },
    });
    const errors = await validate(dto, { validationError: { target: false } });
    const textError = errors.find((e) => e.property === 'text');
    expect(textError).toBeDefined();
  });

  it('validates nested image.link when present', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'image',
      image: { link: 'not-a-url' },
    });
    const errors = await validate(dto, { validationError: { target: false } });
    const imageError = errors.find((e) => e.property === 'image');
    expect(imageError).toBeDefined();
  });

  it('validates nested location latitude range', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'location',
      location: { latitude: 200, longitude: 0 },
    });
    const errors = await validate(dto, { validationError: { target: false } });
    const locationError = errors.find((e) => e.property === 'location');
    expect(locationError).toBeDefined();
  });

  it('accepts optional messaging_product and mimetype', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'text',
      text: { body: 'Hello' },
      messaging_product: 'whatsapp',
      mimetype: 'text/plain',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts contacts as any[]', async () => {
    const dto = plainToInstance(MetaMessageDto, {
      to: '5511999999999',
      type: 'contacts',
      contacts: [
        {
          name: { formatted_name: 'John' },
          phones: [{ phone: '+5511999999999' }],
        },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});

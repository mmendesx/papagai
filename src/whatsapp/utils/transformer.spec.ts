import { toMessageContent } from './transformer';

const base64Data = Buffer.from('media-bytes').toString('base64');

describe('toMessageContent', () => {
  it('transforms text messages', () => {
    expect(toMessageContent({ type: 'text', text: { body: 'Hello' } })).toEqual(
      { text: 'Hello' },
    );
  });

  it('transforms image data before link when both are present', () => {
    const result = toMessageContent({
      type: 'image',
      image: {
        data: base64Data,
        mimetype: 'image/jpeg',
        link: 'https://example.com/image.jpg',
        caption: 'Photo',
      },
    });

    expect(result).toEqual({
      image: Buffer.from(base64Data, 'base64'),
      mimetype: 'image/jpeg',
      caption: 'Photo',
    });
  });

  it('transforms audio data messages', () => {
    expect(
      toMessageContent({
        type: 'audio',
        audio: { data: base64Data, mimetype: 'audio/ogg', ptt: true },
      }),
    ).toEqual({
      audio: Buffer.from(base64Data, 'base64'),
      mimetype: 'audio/ogg',
      ptt: true,
    });
  });

  it('transforms video URL messages without changing the URL media path', () => {
    expect(
      toMessageContent({
        type: 'video',
        video: {
          link: 'https://example.com/video.mp4',
          caption: 'Clip',
        },
      }),
    ).toEqual({
      video: { url: 'https://example.com/video.mp4' },
      caption: 'Clip',
    });
  });

  it('transforms document data messages with filename preserved', () => {
    expect(
      toMessageContent({
        type: 'document',
        document: {
          data: base64Data,
          mimetype: 'application/pdf',
          filename: 'report.pdf',
          caption: 'Report',
        },
      }),
    ).toEqual({
      document: Buffer.from(base64Data, 'base64'),
      mimetype: 'application/pdf',
      fileName: 'report.pdf',
      caption: 'Report',
    });
  });

  it('transforms sticker data messages', () => {
    expect(
      toMessageContent({
        type: 'sticker',
        sticker: { data: base64Data, mimetype: 'image/webp' },
      }),
    ).toEqual({
      sticker: Buffer.from(base64Data, 'base64'),
      mimetype: 'image/webp',
    });
  });

  it('transforms location messages', () => {
    expect(
      toMessageContent({
        type: 'location',
        location: {
          latitude: -23.5505,
          longitude: -46.6333,
          name: 'Sao Paulo',
        },
      }),
    ).toEqual({
      location: {
        degreesLatitude: -23.5505,
        degreesLongitude: -46.6333,
      },
      name: 'Sao Paulo',
      address: undefined,
    });
  });

  it('transforms reaction messages', () => {
    expect(
      toMessageContent({
        type: 'reaction',
        reaction: { message_id: 'msg-1', emoji: '👍' },
      }),
    ).toEqual({
      react: {
        text: '👍',
        key: { id: 'msg-1', remoteJid: '' },
      },
    });
  });

  it('transforms button interactive messages', () => {
    expect(
      toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Choose' },
          action: {
            buttons: [{ reply: { id: 'yes', title: 'Yes' } }],
          },
        },
      }),
    ).toEqual({
      buttons: [
        { buttonId: 'yes', buttonText: { displayText: 'Yes' }, type: 1 },
      ],
      text: 'Choose',
      headerType: 4,
    });
  });

  it('transforms contacts messages', () => {
    expect(
      toMessageContent({
        type: 'contacts',
        contacts: [
          {
            name: { formatted_name: 'John Doe' },
            phones: [{ phone: '5511999999999' }],
          },
        ],
      }),
    ).toEqual({
      contacts: {
        displayName: 'John Doe',
        contacts: [
          'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL;type=CELL;waid=5511999999999:5511999999999\nEND:VCARD',
        ],
      },
    });
  });

  it('throws an explicit error for unsupported message types', () => {
    expect(() => toMessageContent({ type: 'fax' })).toThrow(
      'Unsupported message type: fax',
    );
  });
});

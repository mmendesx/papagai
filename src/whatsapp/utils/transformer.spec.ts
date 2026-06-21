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

  describe('interactive: button — reply buttons render on modern proto', () => {
    it('emits interactiveMessage/nativeFlowMessage with quick_reply buttons', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Choose an option' },
          action: {
            buttons: [
              { reply: { id: 'yes', title: 'Yes' } },
              { reply: { id: 'no', title: 'No' } },
            ],
          },
        },
      });

      expect(result.interactiveMessage).toBeDefined();
      expect(result.interactiveMessage.body).toEqual({
        text: 'Choose an option',
      });
      expect(result.interactiveMessage.header).toEqual({
        title: '',
        hasMediaAttachment: false,
      });
      expect(result.interactiveMessage.nativeFlowMessage.messageVersion).toBe(
        2,
      );

      const buttons = result.interactiveMessage.nativeFlowMessage.buttons;
      expect(buttons).toHaveLength(2);

      expect(buttons[0].name).toBe('quick_reply');
      expect(JSON.parse(buttons[0].buttonParamsJson)).toEqual({
        display_text: 'Yes',
        id: 'yes',
      });

      expect(buttons[1].name).toBe('quick_reply');
      expect(JSON.parse(buttons[1].buttonParamsJson)).toEqual({
        display_text: 'No',
        id: 'no',
      });
    });

    it('includes messageContextInfo sibling for device-list fan-out', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Pick' },
          action: { buttons: [{ reply: { id: '1', title: 'A' } }] },
        },
      });

      expect(result.messageContextInfo).toBeDefined();
    });

    it('includes optional footer when provided', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Body' },
          footer: { text: 'Powered by Papagai' },
          action: { buttons: [{ reply: { id: 'ok', title: 'OK' } }] },
        },
      });

      expect(result.interactiveMessage.footer).toEqual({
        text: 'Powered by Papagai',
      });
    });

    it('sets header title when provided', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'button',
          header: { text: 'Header text' },
          body: { text: 'Body' },
          action: { buttons: [{ reply: { id: 'ok', title: 'OK' } }] },
        },
      });

      expect(result.interactiveMessage.header.title).toBe('Header text');
    });

    it('does not emit legacy buttons or buttonsMessage fields', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Choose' },
          action: { buttons: [{ reply: { id: 'a', title: 'A' } }] },
        },
      });

      expect(result.buttons).toBeUndefined();
      expect(result.buttonsMessage).toBeUndefined();
      expect(result.listMessage).toBeUndefined();
    });
  });

  describe('interactive: list — list picker renders via nativeFlowMessage', () => {
    it('emits interactiveMessage/nativeFlowMessage with single_select button', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: 'Select a city' },
          action: {
            button: 'Pick city',
            sections: [
              {
                title: 'Brazil',
                rows: [
                  { id: 'sp', title: 'São Paulo', description: 'Largest city' },
                  { id: 'rj', title: 'Rio de Janeiro' },
                ],
              },
            ],
          },
        },
      });

      expect(result.interactiveMessage).toBeDefined();
      expect(result.interactiveMessage.body).toEqual({
        text: 'Select a city',
      });

      const buttons = result.interactiveMessage.nativeFlowMessage.buttons;
      expect(buttons).toHaveLength(1);
      expect(buttons[0].name).toBe('single_select');

      const params = JSON.parse(buttons[0].buttonParamsJson);
      expect(params.title).toBe('Pick city');
      expect(params.sections).toHaveLength(1);
      expect(params.sections[0].title).toBe('Brazil');
      expect(params.sections[0].rows).toHaveLength(2);
      expect(params.sections[0].rows[0]).toMatchObject({
        id: 'sp',
        title: 'São Paulo',
        description: 'Largest city',
      });
      expect(params.sections[0].rows[1]).toMatchObject({
        id: 'rj',
        title: 'Rio de Janeiro',
      });
    });

    it('includes messageContextInfo sibling for device-list fan-out', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: 'Pick' },
          action: {
            button: 'Select',
            sections: [{ title: 'A', rows: [{ id: '1', title: 'One' }] }],
          },
        },
      });

      expect(result.messageContextInfo).toBeDefined();
    });

    it('does not emit legacy listMessage or forward wrapper fields', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: 'Pick' },
          action: {
            button: 'Select',
            sections: [{ title: 'A', rows: [{ id: '1', title: 'One' }] }],
          },
        },
      });

      expect(result.listMessage).toBeUndefined();
      expect(result.forward).toBeUndefined();
    });

    it('defaults button text to "Select" when action.button is absent', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: 'Pick' },
          action: {
            sections: [{ title: 'A', rows: [{ id: '1', title: 'One' }] }],
          },
        },
      });

      const params = JSON.parse(
        result.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson,
      );
      expect(params.title).toBe('Select');
    });

    it('includes optional footer when provided', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: 'Pick' },
          footer: { text: 'Footer note' },
          action: {
            button: 'Go',
            sections: [],
          },
        },
      });

      expect(result.interactiveMessage.footer).toEqual({ text: 'Footer note' });
    });
  });

  describe('interactive: cta_url — CTA URL button renders via nativeFlowMessage', () => {
    it('emits interactiveMessage/nativeFlowMessage with cta_url button', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: 'Visit our site' },
          action: {
            parameters: {
              display_text: 'Open',
              url: 'https://example.com',
            },
          },
        },
      });

      expect(result.interactiveMessage).toBeDefined();
      const buttons = result.interactiveMessage.nativeFlowMessage.buttons;
      expect(buttons).toHaveLength(1);
      expect(buttons[0].name).toBe('cta_url');

      const params = JSON.parse(buttons[0].buttonParamsJson);
      expect(params.display_text).toBe('Open');
      expect(params.url).toBe('https://example.com');
      expect(params.merchant_url).toBe('https://example.com');
    });

    it('includes messageContextInfo sibling', () => {
      const result = toMessageContent({
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: 'Go' },
          action: {
            parameters: { display_text: 'Click', url: 'https://example.com' },
          },
        },
      });

      expect(result.messageContextInfo).toBeDefined();
    });
  });

  describe('interactive: unsupported type fails fast', () => {
    it('throws a clear error for an unknown interactive type', () => {
      expect(() =>
        toMessageContent({
          type: 'interactive',
          interactive: { type: 'carousel', body: { text: 'x' }, action: {} },
        }),
      ).toThrow('Unsupported interactive type: carousel');
    });

    it('does not emit a malformed proto when the type is unknown', () => {
      expect(() =>
        toMessageContent({
          type: 'interactive',
          interactive: { type: 'unknown_type', body: {}, action: {} },
        }),
      ).toThrow();
    });
  });
});

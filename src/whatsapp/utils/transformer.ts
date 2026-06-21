function buildVcard(contact: any): string {
  const formattedName = contact.name?.formatted_name ?? '';
  const phones: any[] = contact.phones ?? [];
  const telLines = phones
    .map((p: any) => `TEL;type=CELL;waid=${p.phone}:${p.phone}`)
    .join('\n');
  return `BEGIN:VCARD\nVERSION:3.0\nFN:${formattedName}\n${telLines}\nEND:VCARD`;
}

type NativeFlowButton = { name: string; buttonParamsJson: string };

/**
 * Builds an interactiveMessage envelope (modern proto) with nativeFlowMessage.
 * Shared by button, list, and CTA builders so all interactive types emit the
 * same outer shape.
 */
function buildInteractiveEnvelope(
  body: string,
  buttons: NativeFlowButton[],
  options: {
    footer?: string;
    headerTitle?: string;
  } = {},
): any {
  return {
    interactiveMessage: {
      body: { text: body },
      ...(options.footer ? { footer: { text: options.footer } } : {}),
      header: {
        title: options.headerTitle ?? '',
        hasMediaAttachment: false,
      },
      nativeFlowMessage: {
        buttons,
        messageParamsJson: '{}',
        messageVersion: 2,
      },
    },
    // Sibling at proto.Message level — Baileys merges and populates
    // messageSecret when shouldIncludeReportingToken is true.
    messageContextInfo: {},
  };
}

/**
 * Migrated from legacy `buttonsMessage` to `interactiveMessage` +
 * `nativeFlowMessage` with `quick_reply` native-flow buttons.
 *
 * NOTE FOR HUMAN VERIFICATION: the `name` value "quick_reply" is a
 * WhatsApp-server convention, not enforced by the proto (which accepts any
 * string). Verify it renders as tappable reply buttons on a live client.
 */
function buildButtonMessage(interactive: any): any {
  const action = interactive.action ?? {};
  const body = interactive.body ?? {};
  const footer = interactive.footer;
  const header = interactive.header ?? {};

  const buttons: NativeFlowButton[] = (action.buttons ?? []).map((b: any) => ({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: b.reply?.title ?? '',
      id: b.reply?.id ?? '',
    }),
  }));

  return buildInteractiveEnvelope(body.text ?? '', buttons, {
    footer: footer?.text,
    headerTitle: header.text,
  });
}

/**
 * Migrated from legacy `listMessage` (+ forward wrapper) to
 * `interactiveMessage` + `nativeFlowMessage` with a `single_select`
 * native-flow button.  The forward-wrapper hack in whatsapp.service.ts send
 * path is no longer needed and must be removed.
 *
 * The full section/row structure is embedded inside `buttonParamsJson` so the
 * WhatsApp client can render a selectable picker.
 *
 * NOTE FOR HUMAN VERIFICATION: the `name` value "single_select" is a
 * WhatsApp-server convention. Verify the picker renders on Web and Business.
 */
function buildListMessage(interactive: any): any {
  const action = interactive.action ?? {};
  const body = interactive.body ?? {};
  const footer = interactive.footer;
  const header = interactive.header ?? {};

  const sections = (action.sections ?? []).map((s: any) => ({
    title: s.title ?? '',
    rows: (s.rows ?? []).map((r: any) => ({
      header: r.id ?? '',
      title: r.title ?? '',
      description: r.description ?? '',
      id: r.id ?? '',
    })),
  }));

  const buttons: NativeFlowButton[] = [
    {
      name: 'single_select',
      buttonParamsJson: JSON.stringify({
        title: action.button ?? 'Select',
        sections,
      }),
    },
  ];

  return buildInteractiveEnvelope(body.text ?? '', buttons, {
    footer: footer?.text,
    headerTitle: header.text,
  });
}

type CtaInteractiveType = 'cta_url' | 'cta_copy' | 'otp';

const CTA_BUTTON_BUILDERS: Record<
  CtaInteractiveType,
  (params: any) => NativeFlowButton
> = {
  cta_url: (params) => ({
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: params.display_text,
      url: params.url,
      merchant_url: params.url,
    }),
  }),
  cta_copy: (params) => ({
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({
      display_text: params.display_text,
      copy_code: params.copy_code,
    }),
  }),
  otp: (params) => ({
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({
      display_text: params.display_text,
      otp_type: 'copy_code',
      text: params.copy_code,
      merchant_url: params.url,
    }),
  }),
};

function buildCtaInteractiveMessage(interactive: any): any {
  const action = interactive.action ?? {};
  const body = interactive.body ?? {};
  const footer = interactive.footer;
  const header = interactive.header ?? {};
  const params = action.parameters ?? {};

  const builder = CTA_BUTTON_BUILDERS[interactive.type as CtaInteractiveType];
  if (!builder)
    throw new Error(`Unsupported interactive type: ${interactive.type}`);

  const button = builder(params);

  return buildInteractiveEnvelope(body.text ?? '', [button], {
    footer: footer?.text,
    headerTitle: header?.text ?? header?.title ?? '',
  });
}

type MessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'reaction'
  | 'interactive';

const INTERACTIVE_BUILDERS: Record<string, (interactive: any) => any> = {
  button: buildButtonMessage,
  list: buildListMessage,
};

const MESSAGE_CONTENT_BUILDERS: Record<MessageType, (payload: any) => any> = {
  text: (p) => ({ text: p.text.body }),
  image: (p) =>
    p.image.data
      ? {
          image: Buffer.from(p.image.data, 'base64'),
          mimetype: p.image.mimetype,
          caption: p.image.caption,
        }
      : { image: { url: p.image.link }, caption: p.image.caption },
  audio: (p) =>
    p.audio.data
      ? {
          audio: Buffer.from(p.audio.data, 'base64'),
          mimetype: p.audio.mimetype ?? 'audio/mpeg',
          ptt: p.audio.ptt ?? false,
        }
      : {
          audio: { url: p.audio.link },
          mimetype: 'audio/mpeg',
          ptt: p.audio.ptt ?? false,
        },
  video: (p) =>
    p.video.data
      ? {
          video: Buffer.from(p.video.data, 'base64'),
          mimetype: p.video.mimetype,
          caption: p.video.caption,
        }
      : { video: { url: p.video.link }, caption: p.video.caption },
  document: (p) =>
    p.document.data
      ? {
          document: Buffer.from(p.document.data, 'base64'),
          mimetype: p.document.mimetype ?? 'application/octet-stream',
          fileName: p.document.filename,
          caption: p.document.caption,
        }
      : {
          document: { url: p.document.link },
          mimetype: 'application/octet-stream',
          fileName: p.document.filename,
          caption: p.document.caption,
        },
  sticker: (p) =>
    p.sticker.data
      ? {
          sticker: Buffer.from(p.sticker.data, 'base64'),
          mimetype: p.sticker.mimetype,
        }
      : { sticker: { url: p.sticker.link } },
  location: (p) => ({
    location: {
      degreesLatitude: p.location.latitude,
      degreesLongitude: p.location.longitude,
      name: p.location.name,
      address: p.location.address,
    },
  }),
  contacts: (p) => {
    const contactList: any[] = p.contacts ?? [];
    const firstContact = contactList[0] ?? {};
    return {
      contacts: {
        displayName: firstContact.name?.formatted_name ?? '',
        contacts: contactList.map((c) => ({
          displayName: c.name?.formatted_name ?? '',
          vcard: buildVcard(c),
        })),
      },
    };
  },
  reaction: (p) => ({
    react: {
      text: p.reaction.emoji,
      key: { id: p.reaction.message_id, remoteJid: '' },
    },
  }),
  interactive: (p) => {
    const interactive = p.interactive ?? {};
    const builder = INTERACTIVE_BUILDERS[interactive.type];
    // Known types (button, list) are routed above; CTA types (cta_url,
    // cta_copy, otp) fall through to buildCtaInteractiveMessage which throws
    // a clear error for any truly unknown type.
    return builder
      ? builder(interactive)
      : buildCtaInteractiveMessage(interactive);
  },
};

export function toMessageContent(payload: any): any {
  const { type } = payload;
  const builder = MESSAGE_CONTENT_BUILDERS[type as MessageType];
  if (!builder) throw new Error(`Unsupported message type: ${type}`);
  return builder(payload);
}

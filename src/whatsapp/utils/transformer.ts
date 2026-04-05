function buildVcard(contact: any): string {
  const formattedName = contact.name?.formatted_name ?? '';
  const phones: any[] = contact.phones ?? [];
  const telLines = phones
    .map((p: any) => `TEL;type=CELL;waid=${p.phone}:${p.phone}`)
    .join('\n');
  return `BEGIN:VCARD\nVERSION:3.0\nFN:${formattedName}\n${telLines}\nEND:VCARD`;
}

function buildButtonMessage(interactive: any): any {
  const action = interactive.action ?? {};
  const body = interactive.body ?? {};
  const footer = interactive.footer;
  const header = interactive.header ?? {};

  const buttons = (action.buttons ?? []).map((b: any) => ({
    buttonId: b.reply.id,
    buttonText: { displayText: b.reply.title },
    type: 1,
  }));

  return {
    buttons,
    text: body.text ?? '',
    ...(footer ? { footer: footer.text } : {}),
    ...(header.text ? { title: header.text } : {}),
    headerType: header.text ? 1 : 4,
  };
}

// Returns proto-level listMessage — the send layer wraps this in a forward for iOS compat
function buildListMessage(interactive: any): any {
  const action = interactive.action ?? {};
  const body = interactive.body ?? {};
  const footer = interactive.footer;
  const header = interactive.header ?? {};

  const sections = (action.sections ?? []).map((s: any) => ({
    title: s.title,
    rows: (s.rows ?? []).map((r: any) => ({
      rowId: r.id,
      title: r.title,
      description: r.description ?? '',
    })),
  }));

  return {
    listMessage: {
      description: body.text ?? '',
      ...(footer ? { footerText: footer.text } : {}),
      ...(header.text ? { title: header.text } : {}),
      buttonText: action.button ?? 'Select',
      sections,
      listType: 1, // SINGLE_SELECT
    },
  };
}

type CtaInteractiveType = 'cta_url' | 'cta_copy' | 'otp';
type NativeFlowButton = { name: string; buttonParamsJson: string };

const CTA_BUTTON_BUILDERS: Record<CtaInteractiveType, (params: any) => NativeFlowButton> = {
  cta_url: (params) => ({
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({ display_text: params.display_text, url: params.url, merchant_url: params.url }),
  }),
  cta_copy: (params) => ({
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({ display_text: params.display_text, copy_code: params.copy_code }),
  }),
  otp: (params) => ({
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({ display_text: params.display_text, otp_type: 'copy_code', text: params.copy_code, merchant_url: params.url }),
  }),
};

function buildCtaInteractiveMessage(interactive: any): any {
  const action = interactive.action ?? {};
  const body = interactive.body ?? {};
  const footer = interactive.footer;
  const header = interactive.header ?? {};
  const params = action.parameters ?? {};

  const builder = CTA_BUTTON_BUILDERS[interactive.type as CtaInteractiveType];
  if (!builder) throw new Error(`Unsupported interactive type: ${interactive.type}`);
  const button = builder(params);

  return {
    interactiveMessage: {
      body: { text: body.text ?? '' },
      ...(footer ? { footer: { text: footer.text } } : {}),
      header: {
        title: header?.text ?? header?.title ?? '',
        hasMediaAttachment: false,
      },
      nativeFlowMessage: {
        buttons: [button],
        messageParamsJson: '{}',
        messageVersion: 2,
      },
    },
  };
}

type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts' | 'reaction' | 'interactive';

const INTERACTIVE_BUILDERS: Partial<Record<string, (interactive: any) => any>> = {
  button: buildButtonMessage,
  list: buildListMessage,
};

const MESSAGE_CONTENT_BUILDERS: Record<MessageType, (payload: any) => any> = {
  text: (p) => ({ text: p.text.body }),
  image: (p) => ({ image: { url: p.image.link }, caption: p.image.caption }),
  audio: (p) => ({ audio: { url: p.audio.link }, mimetype: 'audio/mpeg', ptt: false }),
  video: (p) => ({ video: { url: p.video.link }, caption: p.video.caption }),
  document: (p) => ({
    document: { url: p.document.link },
    mimetype: 'application/octet-stream',
    fileName: p.document.filename,
    caption: p.document.caption,
  }),
  sticker: (p) => ({ sticker: { url: p.sticker.link } }),
  location: (p) => ({
    location: { degreesLatitude: p.location.latitude, degreesLongitude: p.location.longitude },
    name: p.location.name,
    address: p.location.address,
  }),
  contacts: (p) => {
    const contactList: any[] = p.contacts ?? [];
    const firstContact = contactList[0] ?? {};
    return {
      contacts: {
        displayName: firstContact.name?.formatted_name ?? '',
        contacts: contactList.map(buildVcard),
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
    return builder ? builder(interactive) : buildCtaInteractiveMessage(interactive);
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMessageContent(payload: any): any {
  const { type } = payload;
  const builder = MESSAGE_CONTENT_BUILDERS[type as MessageType];
  if (!builder) throw new Error(`Unsupported message type: ${type}`);
  return builder(payload);
}

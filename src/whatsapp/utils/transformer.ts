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

function buildCtaInteractiveMessage(interactive: any): any {
  const action = interactive.action ?? {};
  const body = interactive.body ?? {};
  const footer = interactive.footer;
  const header = interactive.header ?? {};
  const params = action.parameters ?? {};

  let button: { name: string; buttonParamsJson: string };

  if (interactive.type === 'cta_url') {
    button = {
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: params.display_text,
        url: params.url,
        merchant_url: params.url,
      }),
    };
  } else if (interactive.type === 'cta_copy') {
    button = {
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({
        display_text: params.display_text,
        copy_code: params.copy_code,
      }),
    };
  } else if (interactive.type === 'otp') {
    button = {
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify({
        display_text: params.display_text,
        otp_type: 'copy_code',
        text: params.copy_code,
        merchant_url: params.url,
      }),
    };
  } else {
    throw new Error(`Unsupported interactive type: ${interactive.type}`);
  }

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMessageContent(payload: any): any {
  const { type } = payload;

  switch (type) {
    case 'text':
      return { text: payload.text.body };

    case 'image':
      return {
        image: { url: payload.image.link },
        caption: payload.image.caption,
      };

    case 'audio':
      return {
        audio: { url: payload.audio.link },
        mimetype: 'audio/mpeg',
        ptt: false,
      };

    case 'video':
      return {
        video: { url: payload.video.link },
        caption: payload.video.caption,
      };

    case 'document':
      return {
        document: { url: payload.document.link },
        mimetype: 'application/octet-stream',
        fileName: payload.document.filename,
        caption: payload.document.caption,
      };

    case 'sticker':
      return { sticker: { url: payload.sticker.link } };

    case 'location':
      return {
        location: {
          degreesLatitude: payload.location.latitude,
          degreesLongitude: payload.location.longitude,
        },
        name: payload.location.name,
        address: payload.location.address,
      };

    case 'contacts': {
      const contactList: any[] = payload.contacts ?? [];
      const firstContact = contactList[0] ?? {};
      const displayName = firstContact.name?.formatted_name ?? '';
      const vcards = contactList.map(buildVcard);
      return {
        contacts: {
          displayName,
          contacts: vcards,
        },
      };
    }

    case 'reaction':
      return {
        react: {
          text: payload.reaction.emoji,
          key: {
            id: payload.reaction.message_id,
            remoteJid: '',
          },
        },
      };

    case 'interactive': {
      const interactive = payload.interactive ?? {};
      switch (interactive.type) {
        case 'button':
          return buildButtonMessage(interactive);
        case 'list':
          return buildListMessage(interactive);
        default:
          return buildCtaInteractiveMessage(interactive);
      }
    }

    default:
      throw new Error(`Unsupported message type: ${type}`);
  }
}

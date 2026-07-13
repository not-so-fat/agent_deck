export type DeckCardType = 'service' | 'credential' | 'playbook';
export type ManageDeckCardAction = 'link' | 'unlink' | 'reorder';

export type ManageDeckCardInput = {
  action: ManageDeckCardAction;
  card_type: DeckCardType;
  card_id?: string;
  position?: number;
  /** Required for action=reorder and card_type=service — full ordered service ids on the deck */
  ordered_card_ids?: string[];
};

type DeckCardBackend = {
  getBoundDeckId(): Promise<string>;
  callBackendAPI(endpoint: string, init?: RequestInit): Promise<unknown>;
};

function cardIdField(cardType: DeckCardType): string {
  switch (cardType) {
    case 'service':
      return 'serviceId';
    case 'credential':
      return 'credentialId';
    case 'playbook':
      return 'playbookId';
  }
}

function deckSegment(cardType: DeckCardType): string {
  switch (cardType) {
    case 'service':
      return 'services';
    case 'credential':
      return 'credentials';
    case 'playbook':
      return 'playbooks';
  }
}

export async function executeManageDeckCard(
  backend: DeckCardBackend,
  input: ManageDeckCardInput,
): Promise<Record<string, unknown>> {
  const deckId = await backend.getBoundDeckId();
  const { action, card_type: cardType } = input;

  if (action === 'reorder') {
    if (cardType !== 'service') {
      throw new Error('reorder is only supported for card_type=service; use link with position for other card types');
    }
    if (!input.ordered_card_ids?.length) {
      throw new Error('ordered_card_ids is required for reorder');
    }
    await backend.callBackendAPI(`/api/decks/${deckId}/services/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: input.ordered_card_ids }),
    });
    return {
      success: true,
      deck_id: deckId,
      action,
      card_type: cardType,
      ordered_card_ids: input.ordered_card_ids,
    };
  }

  const cardId = input.card_id?.trim();
  if (!cardId) {
    throw new Error('card_id is required for link and unlink');
  }

  const segment = deckSegment(cardType);
  const idField = cardIdField(cardType);

  if (action === 'link') {
    const body: Record<string, unknown> = { [idField]: cardId };
    if (input.position !== undefined) {
      body.position = input.position;
    }
    const response = await backend.callBackendAPI(`/api/decks/${deckId}/${segment}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as { trigger_warnings?: unknown[] } | undefined;
    return {
      success: true,
      deck_id: deckId,
      action,
      card_type: cardType,
      card_id: cardId,
      ...(cardType === 'playbook' ? { trigger_warnings: response?.trigger_warnings ?? [] } : {}),
    };
  }

  await backend.callBackendAPI(`/api/decks/${deckId}/${segment}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [idField]: cardId }),
  });
  return { success: true, deck_id: deckId, action, card_type: cardType, card_id: cardId };
}

export type ListCollectionInput = {
  card_type?: DeckCardType;
};

export async function executeListCollection(
  backend: DeckCardBackend,
  input: ListCollectionInput,
): Promise<Record<string, unknown>> {
  const filter = input.card_type;

  if (filter === 'service') {
    const services = await backend.callBackendAPI('/api/services');
    return { services };
  }
  if (filter === 'credential') {
    const credentials = await backend.callBackendAPI('/api/credentials/collection');
    return { credentials };
  }
  if (filter === 'playbook') {
    const playbooks = await backend.callBackendAPI('/api/playbooks/collection');
    return { playbooks };
  }

  const [services, credentials, playbooks] = await Promise.all([
    backend.callBackendAPI('/api/services'),
    backend.callBackendAPI('/api/credentials/collection'),
    backend.callBackendAPI('/api/playbooks/collection'),
  ]);
  return { services, credentials, playbooks };
}

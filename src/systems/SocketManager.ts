/**
 * SocketManager - Handle multiplayer sync for banking operations
 */

import { MODULE_ID } from "../constants";
import { log } from "../utils/logger";

// Socket event types
export const SOCKET_EVENTS = {
  TRANSFER_REQUEST: "transferRequest",
  TRANSFER_COMPLETE: "transferComplete",
  TRANSFER_REJECTED: "transferRejected",
  ACCOUNT_UPDATE: "accountUpdate",
  BANK_SYNC: "bankSync",
} as const;

// Socket payload types
export interface TransferRequestPayload {
  fromActorId: string;
  toActorId: string;
  currency: string;
  amount: number;
  requesterId: string;
  timestamp: number;
}

export interface TransferCompletePayload {
  fromActorId: string;
  toActorId: string;
  currency: string;
  amount: number;
  success: boolean;
  message?: string;
}

export interface AccountUpdatePayload {
  actorId: string;
  bankId: string;
  accountId: string;
  balance: number;
  currency: string;
}

type GameWithSocket = {
  socket?: {
    on: (event: string, callback: (data: unknown) => void) => void;
    emit: (event: string, data: unknown) => void;
  };
  user?: {
    id?: string;
    isGM?: boolean;
  };
  actors?: {
    get: (id: string) => ActorType | undefined;
  };
};

type ActorType = {
  id?: string;
  name?: string;
  isOwner?: boolean;
  system?: {
    currency?: Record<string, number>;
  };
  update?: (data: object) => Promise<unknown>;
};

type NotificationsType = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

// Callback registry
type SocketCallback = (data: unknown) => void;
const callbacks: Map<string, SocketCallback[]> = new Map();

/**
 * Initialize socket listeners
 */
export const initializeSocket = (): void => {
  const gameObj = game as GameWithSocket | undefined;
  if (!gameObj?.socket) {
    log("Socket not available");
    return;
  }

  const socketName = `module.${MODULE_ID}`;

  gameObj.socket.on(socketName, (data: unknown) => {
    const payload = data as { type?: string; data?: unknown };
    if (!payload?.type) return;

    log(`Socket received: ${payload.type}`);

    // Handle transfer requests (GM only processes these)
    if (payload.type === SOCKET_EVENTS.TRANSFER_REQUEST && gameObj.user?.isGM) {
      void handleTransferRequest(payload.data as TransferRequestPayload);
    }

    // Handle transfer completion (notify relevant users)
    if (payload.type === SOCKET_EVENTS.TRANSFER_COMPLETE) {
      handleTransferComplete(payload.data as TransferCompletePayload);
    }

    // Trigger registered callbacks
    const typeCallbacks = callbacks.get(payload.type);
    if (typeCallbacks) {
      for (const cb of typeCallbacks) {
        cb(payload.data);
      }
    }
  });

  log("Socket initialized");
};

/**
 * Emit a socket event
 */
export const emitSocket = (type: string, data: unknown): void => {
  const gameObj = game as GameWithSocket | undefined;
  if (!gameObj?.socket) {
    log("Cannot emit - socket not available");
    return;
  }

  const socketName = `module.${MODULE_ID}`;
  gameObj.socket.emit(socketName, { type, data });
  log(`Socket emitted: ${type}`);
};

/**
 * Register a callback for a socket event
 */
export const onSocketEvent = (type: string, callback: SocketCallback): void => {
  const existing = callbacks.get(type) ?? [];
  existing.push(callback);
  callbacks.set(type, existing);
};

/**
 * Request a transfer (sent by player, processed by GM)
 */
export const requestTransfer = (
  fromActorId: string,
  toActorId: string,
  currency: string,
  amount: number
): void => {
  const gameObj = game as GameWithSocket | undefined;
  const requesterId = gameObj?.user?.id ?? "unknown";

  const payload: TransferRequestPayload = {
    fromActorId,
    toActorId,
    currency,
    amount,
    requesterId,
    timestamp: Date.now(),
  };

  // If we're the GM, process directly
  if (gameObj?.user?.isGM) {
    void handleTransferRequest(payload);
  } else {
    // Send to GM for processing
    emitSocket(SOCKET_EVENTS.TRANSFER_REQUEST, payload);
  }
};

/**
 * Handle transfer request (GM only)
 */
const handleTransferRequest = async (payload: TransferRequestPayload): Promise<void> => {
  const gameObj = game as GameWithSocket | undefined;
  if (!gameObj?.actors) return;

  const fromActor = gameObj.actors.get(payload.fromActorId);
  const toActor = gameObj.actors.get(payload.toActorId);

  if (!fromActor || !toActor) {
    emitSocket(SOCKET_EVENTS.TRANSFER_COMPLETE, {
      ...payload,
      success: false,
      message: "Actor not found",
    } as TransferCompletePayload);
    return;
  }

  // Check if sender has enough currency
  const currentAmount =
    (fromActor.system?.currency?.[payload.currency] as number | undefined) ?? 0;

  if (currentAmount < payload.amount) {
    emitSocket(SOCKET_EVENTS.TRANSFER_COMPLETE, {
      ...payload,
      success: false,
      message: "Insufficient funds",
    } as TransferCompletePayload);
    return;
  }

  try {
    // Remove from sender
    if (fromActor.update) {
      await fromActor.update({
        [`system.currency.${payload.currency}`]: currentAmount - payload.amount,
      });
    }

    // Add to recipient
    const recipientAmount =
      (toActor.system?.currency?.[payload.currency] as number | undefined) ?? 0;
    if (toActor.update) {
      await toActor.update({
        [`system.currency.${payload.currency}`]: recipientAmount + payload.amount,
      });
    }

    // Notify success
    emitSocket(SOCKET_EVENTS.TRANSFER_COMPLETE, {
      fromActorId: payload.fromActorId,
      toActorId: payload.toActorId,
      currency: payload.currency,
      amount: payload.amount,
      success: true,
      message: `Transferred ${payload.amount} ${payload.currency}`,
    } as TransferCompletePayload);

    log(`Transfer complete: ${payload.amount} ${payload.currency} from ${fromActor.name ?? "?"} to ${toActor.name ?? "?"}`);
  } catch (error) {
    emitSocket(SOCKET_EVENTS.TRANSFER_COMPLETE, {
      ...payload,
      success: false,
      message: String(error),
    } as TransferCompletePayload);
  }
};

/**
 * Handle transfer completion notification
 */
const handleTransferComplete = (payload: TransferCompletePayload): void => {
  const notifications = ui.notifications as NotificationsType | undefined;

  if (payload.success) {
    notifications?.info(payload.message ?? "Transfer complete");
  } else {
    notifications?.error(payload.message ?? "Transfer failed");
  }
};

/**
 * Sync bank data across clients
 */
export const syncBankData = (bankId: string, data: unknown): void => {
  emitSocket(SOCKET_EVENTS.BANK_SYNC, { bankId, data });
};


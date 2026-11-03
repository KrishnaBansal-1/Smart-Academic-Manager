import { ClientSession, Types } from 'mongoose';
import { Notification, INotification, NotificationType } from '../models/Notification';
import { emitToUser } from './socket.service';

export interface NotifyPayload {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  payload?: Record<string, unknown>;
  dedupeKeyPrefix?: string;
}

export interface DirectNotificationInput {
  recipientId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
}

export class NotificationService {
  /**
   * Writes Notification rows inside the given session (if transactional).
   * After the database transaction commits (or immediately if no session),
   * pushes the notifications via WebSocket to room `user:<recipientId>`
   * using best effort.
   *
   * @param session Active MongoDB ClientSession or null
   * @param recipients Array of User IDs (Types.ObjectId or string)
   * @param data Notification payload
   * @returns Created notification documents
   */
  public static async notify(
    session: ClientSession | null | undefined,
    recipients: (Types.ObjectId | string)[],
    data: NotifyPayload
  ): Promise<INotification[]> {
    if (!recipients || recipients.length === 0) {
      return [];
    }

    const uniqueRecipientIds = Array.from(
      new Set(recipients.map((r) => r.toString()))
    );

    const docsToInsert = uniqueRecipientIds.map((recId) => {
      const recipientObjId = new Types.ObjectId(recId);
      const dedupeKey = data.dedupeKeyPrefix
        ? `${data.dedupeKeyPrefix}:${recId}`
        : undefined;

      return {
        recipientId: recipientObjId,
        type: data.type,
        title: data.title,
        body: data.body,
        link: data.link,
        payload: data.payload,
        dedupeKey,
      };
    });

    let insertedDocs: INotification[] = [];

    try {
      if (session) {
        insertedDocs = (await Notification.insertMany(docsToInsert, {
          session,
          ordered: false,
        })) as unknown as INotification[];
      } else {
        insertedDocs = (await Notification.insertMany(docsToInsert, {
          ordered: false,
        })) as unknown as INotification[];
      }
    } catch (insertErr: unknown) {
      // With ordered: false, duplicate keys (code 11000) or partial duplicates throw BulkWriteError
      // but successfully insert the non-duplicates.
      if (
        typeof insertErr === 'object' &&
        insertErr !== null &&
        'insertedDocs' in insertErr &&
        Array.isArray((insertErr as { insertedDocs: unknown[] }).insertedDocs)
      ) {
        insertedDocs = (insertErr as { insertedDocs: INotification[] }).insertedDocs;
      }
    }

    // Deliver via Socket.IO after commit (best effort)
    const deliverSocketPushes = () => {
      for (const doc of insertedDocs) {
        const recipientIdStr = doc.recipientId.toString();
        emitToUser(recipientIdStr, 'notification:new', doc);
      }
    };

    // If part of an active transaction, wait for commit
    const rawSession = session as unknown as { transaction?: { state?: string } } | null;
    const isTransacting = rawSession?.transaction?.state === 'TRANSACTION_IN_PROGRESS';

    if (session && isTransacting && typeof (session as unknown as { once?: unknown }).once === 'function') {
      (session as unknown as { once: (evt: string, cb: () => void) => void }).once('committed', deliverSocketPushes);
    } else {
      // In tests or single operations, deliver on next tick so the caller completes
      setImmediate(deliverSocketPushes);
    }

    return insertedDocs;
  }

  /**
   * Directly insert notification records with individual custom dedupeKeys.
   */
  public static async notifyMany(
    session: ClientSession | null | undefined,
    items: DirectNotificationInput[]
  ): Promise<INotification[]> {
    if (!items || items.length === 0) return [];

    const docs = items.map((i) => ({
      recipientId: new Types.ObjectId(i.recipientId),
      type: i.type,
      title: i.title,
      body: i.body,
      link: i.link,
      payload: i.payload,
      dedupeKey: i.dedupeKey,
    }));

    let insertedDocs: INotification[] = [];

    try {
      if (session) {
        insertedDocs = (await Notification.insertMany(docs, {
          session,
          ordered: false,
        })) as unknown as INotification[];
      } else {
        insertedDocs = (await Notification.insertMany(docs, {
          ordered: false,
        })) as unknown as INotification[];
      }
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'insertedDocs' in err &&
        Array.isArray((err as { insertedDocs: unknown[] }).insertedDocs)
      ) {
        insertedDocs = (err as { insertedDocs: INotification[] }).insertedDocs;
      }
    }

    const deliverSocketPushes = () => {
      for (const doc of insertedDocs) {
        const recipientIdStr = doc.recipientId.toString();
        emitToUser(recipientIdStr, 'notification:new', doc);
      }
    };

    const rawSession = session as unknown as { transaction?: { state?: string } } | null;
    const isTransacting = rawSession?.transaction?.state === 'TRANSACTION_IN_PROGRESS';

    if (session && isTransacting && typeof (session as unknown as { once?: unknown }).once === 'function') {
      (session as unknown as { once: (evt: string, cb: () => void) => void }).once('committed', deliverSocketPushes);
    } else {
      setImmediate(deliverSocketPushes);
    }

    return insertedDocs;
  }
}

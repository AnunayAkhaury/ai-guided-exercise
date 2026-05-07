import { Expo } from 'expo-server-sdk';
import type { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { listProfilesByRole } from './Firebase/firebase-auth.js';
import {
  listPushTokensForUsers,
  markPushTokenError,
  type PushTokenDocument
} from './Firebase/firebase-push-tokens.js';
import { messaging } from './Firebase/firebase-service.js';

type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type NotificationSendResult = {
  attempted: number;
  sent: number;
  failed: number;
};

type ExpoPushTarget = {
  token: PushTokenDocument;
  message: ExpoPushMessage;
};

const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN?.trim()
    ? {
        accessToken: process.env.EXPO_ACCESS_TOKEN.trim()
      }
    : undefined
);

function toExpoTargets(tokens: PushTokenDocument[], payload: NotificationPayload): ExpoPushTarget[] {
  return tokens
    .filter((token) => token.type === 'expo' && Expo.isExpoPushToken(token.token))
    .map((token) => ({
      token,
      message: {
        to: token.token,
        title: payload.title,
        body: payload.body,
        ...(payload.data ? { data: payload.data } : {}),
        sound: 'default',
        priority: 'high',
        channelId: 'class-updates'
      }
    }));
}

async function handleExpoTickets(targets: ExpoPushTarget[], tickets: ExpoPushTicket[]): Promise<void> {
  await Promise.allSettled(
    tickets.map(async (ticket, index) => {
      if (ticket.status !== 'error') {
        return;
      }

      const target = targets[index];
      if (!target) {
        return;
      }

      const error = ticket.details?.error || ticket.message || 'Expo push delivery failed.';
      if (error === 'DeviceNotRegistered') {
        await markPushTokenError(target.token.uid, target.token.token, error);
      }
    })
  );
}

export async function sendNotificationToUsers(
  userIds: string[],
  payload: NotificationPayload
): Promise<NotificationSendResult> {
  const tokens = await listPushTokensForUsers(userIds);
  const targets = toExpoTargets(tokens, payload);
  const webTokens = tokens.filter((token) => token.type === 'fcm_web').map((token) => token.token);

  let sent = 0;
  let failed = 0;

  for (let start = 0; start < targets.length; start += Expo.pushNotificationChunkSizeLimit) {
    const targetChunk = targets.slice(start, start + Expo.pushNotificationChunkSizeLimit);
    const tickets = await expo.sendPushNotificationsAsync(targetChunk.map((target) => target.message));
    sent += tickets.filter((ticket) => ticket.status === 'ok').length;
    failed += tickets.filter((ticket) => ticket.status === 'error').length;
    await handleExpoTickets(targetChunk, tickets);
  }

  for (let start = 0; start < webTokens.length; start += 500) {
    const tokenChunk = webTokens.slice(start, start + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: tokenChunk,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: Object.fromEntries(
        Object.entries(payload.data ?? {}).map(([key, value]) => [key, String(value)])
      )
    });
    sent += response.successCount;
    failed += response.failureCount;
  }

  return {
    attempted: targets.length + webTokens.length,
    sent,
    failed
  };
}

export async function sendNotificationToRole(
  role: string,
  payload: NotificationPayload
): Promise<NotificationSendResult> {
  const profiles = await listProfilesByRole(role);
  return sendNotificationToUsers(
    profiles.map((profile) => profile.uid),
    payload
  );
}

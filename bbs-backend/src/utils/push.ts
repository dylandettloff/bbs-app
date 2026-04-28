type PushPayload = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }

  return groups;
}

export async function sendExpoPushNotifications({
  tokens,
  title,
  body,
  data,
}: PushPayload): Promise<void> {
  const validTokens = Array.from(
    new Set(
      tokens.filter(
        (token) =>
          typeof token === 'string' &&
          /^ExponentPushToken\[[\w-]+\]$/.test(token.trim())
      )
    )
  );

  if (validTokens.length === 0) return;

  const messages: ExpoMessage[] = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  for (const group of chunk(messages, 100)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(group),
      });

      if (!response.ok) {
        const responseText = await response.text();
        strapi.log.error(
          `[push] Expo push request failed (${response.status}): ${responseText}`
        );
      }
    } catch (error) {
      strapi.log.error(`[push] Expo push request error: ${String(error)}`);
    }
  }
}

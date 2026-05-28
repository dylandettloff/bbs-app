import { sendExpoPushNotifications } from '../../../../utils/push';

async function getAllPushTokens(): Promise<string[]> {
  const publicTokenRowsRaw: any = await strapi.entityService.findMany(
    'api::push-token.push-token' as any,
    {
      fields: ['token', 'enabled'] as any,
      filters: { enabled: { $eq: true } } as any,
      limit: 10000,
    }
  );
  const publicTokenRows: any[] = Array.isArray(publicTokenRowsRaw)
    ? publicTokenRowsRaw
    : publicTokenRowsRaw
    ? [publicTokenRowsRaw]
    : [];
  const publicTokens = publicTokenRows
    .map((r) => r?.token)
    .filter((t): t is string => typeof t === 'string');

  return Array.from(new Set(publicTokens));
}

async function notifyForAnnouncment(row: any) {
  if (!row?.publishedAt) return;

  const tokens = await getAllPushTokens();
  if (tokens.length === 0) return;

  const title = row?.title ? String(row.title) : 'New Announcement';
  const body = row?.body
    ? String(row.body).replace(/<[^>]+>/g, '').slice(0, 140)
    : 'A new announcement has been posted.';

  await sendExpoPushNotifications({
    tokens,
    title,
    body,
    data: {
      type: 'announcment.created',
      announcmentId: row?.id ?? null,
    },
  });
}

export default {
  async beforeUpdate(event: any) {
    const id = event?.params?.where?.id;
    if (!id) return;
    const current: any = await strapi.entityService.findOne(
      'api::announcment.announcment' as any,
      id,
      { fields: ['id', 'publishedAt'] as any }
    );
    event.state = event.state || {};
    event.state.wasPublished = Boolean(current?.publishedAt);
  },

  async afterCreate(event: any) {
    await notifyForAnnouncment(event?.result);
  },

  async afterUpdate(event: any) {
    const isPublishedNow = Boolean(event?.result?.publishedAt);
    const wasPublished = Boolean(event?.state?.wasPublished);
    if (isPublishedNow && !wasPublished) {
      await notifyForAnnouncment(event?.result);
    }
  },
};

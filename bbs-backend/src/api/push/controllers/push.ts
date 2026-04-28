export default {
  async register(ctx: any) {
    const token = String(ctx.request.body?.token ?? '').trim();
    const platform = String(ctx.request.body?.platform ?? '').trim() || null;
    const enabled = ctx.request.body?.enabled !== false;

    if (!token) return ctx.badRequest('Missing push token.');
    if (!/^ExponentPushToken\[[\w-]+\]$/.test(token)) {
      return ctx.badRequest('Invalid Expo push token format.');
    }

    const existing = await strapi.entityService.findMany(
      'api::push-token.push-token' as any,
      {
        filters: { token: { $eq: token } } as any,
        limit: 1,
      }
    );

    if (Array.isArray(existing) && existing[0]?.id) {
      await strapi.entityService.update(
        'api::push-token.push-token' as any,
        existing[0].id,
        {
          data: { platform, enabled },
        }
      );
    } else {
      await strapi.entityService.create('api::push-token.push-token' as any, {
        data: { token, platform, enabled },
      });
    }

    ctx.body = { data: { ok: true } };
  },
};

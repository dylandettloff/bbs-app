export default {
  async profile(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    ctx.body = {
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  },

  async roster(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const counties = await strapi.entityService.findMany("api::county.county", {
      filters: ({ users_permissions_users: { id: { $eq: user.id } } } as any),
      populate: {
        cities: {
          populate: {
            students: true,
          },
        },
      },
      sort: { name: "asc" },
    });

    ctx.body = { data: counties };
  },

  async events(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const staffOnly = String(ctx.query.staffOnly ?? "true") === "true";
    const nowIso = new Date().toISOString();

    const filters: any = { starts_at: { $gte: nowIso } };
    if (staffOnly) filters.audience = { $in: ["Staff", "staff"] };

    const items = await strapi.entityService.findMany("api::event.event", {
      filters,
      sort: { starts_at: "asc" },
      limit: 100,
    });

    ctx.body = { data: items };
  },
};
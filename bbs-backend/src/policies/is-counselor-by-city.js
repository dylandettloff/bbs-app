'use strict';

module.exports = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized('You must be logged in');

  const cityId = ctx.params.id;
  if (!cityId) return ctx.badRequest('Missing city id');

  // Load the city with its county + counselors
  const city = await strapi.entityService.findOne('api::city.city', cityId, {
    populate: { county: { populate: ['counselors'] } },
  });

  const counselors = city?.county?.counselors || [];
  const allowed = counselors.some((u) => u.id === user.id);

  if (!allowed) return ctx.forbidden('Not allowed to view this city');
  return next();
};

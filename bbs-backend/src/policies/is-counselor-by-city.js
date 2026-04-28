'use strict';

module.exports = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized('You must be logged in');

  const cityId = ctx.params.id;
  if (!cityId) return ctx.badRequest('Missing city id');

  // Load the city with its county + assigned county users
  const city = await strapi.entityService.findOne('api::city.city', cityId, {
    populate: { county: { populate: ['users_permissions_users'] } },
  });

  const assignedUsers = city?.county?.users_permissions_users || [];
  const allowed = assignedUsers.some((u) => u.id === user.id);

  if (!allowed) return ctx.forbidden('Not allowed to view this city');
  return next();
};

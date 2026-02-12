'use strict';

module.exports = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized('You must be logged in');

  const countyId = ctx.params.id;
  const county = await strapi.entityService.findOne('api::county.county', countyId, {
    populate: ['counselors'],
  });

  const allowed = county?.counselors?.some(u => u.id === user.id);
  if (!allowed) return ctx.forbidden('Not allowed to view this county');

  return next();
};

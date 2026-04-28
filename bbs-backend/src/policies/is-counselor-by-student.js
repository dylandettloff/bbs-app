'use strict';

module.exports = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized('You must be logged in');

  const studentId = ctx.params.id;
  if (!studentId) return ctx.badRequest('Missing student id');

  // Load the student with city -> county -> assigned county users
  const student = await strapi.entityService.findOne('api::student.student', studentId, {
    populate: { city: { populate: { county: { populate: ['users_permissions_users'] } } } },
  });

  const assignedUsers = student?.city?.county?.users_permissions_users || [];
  const allowed = assignedUsers.some((u) => u.id === user.id);

  if (!allowed) return ctx.forbidden('Not allowed to view this student');
  return next();
};

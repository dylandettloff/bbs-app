'use strict';

module.exports = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized('You must be logged in');

  const studentId = ctx.params.id;
  if (!studentId) return ctx.badRequest('Missing student id');

  // Load the student with city -> county -> counselors
  const student = await strapi.entityService.findOne('api::student.student', studentId, {
    populate: { city: { populate: { county: { populate: ['counselors'] } } } },
  });

  const counselors = student?.city?.county?.counselors || [];
  const allowed = counselors.some((u) => u.id === user.id);

  if (!allowed) return ctx.forbidden('Not allowed to view this student');
  return next();
};

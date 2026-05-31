async function findStudentForUser(user: any) {
  const citizenId = Number(user?.username);
  const populate = {
      city: {
        fields: ['id', 'name'] as any,
        populate: {
          county: {
            fields: ['id', 'name'] as any,
          },
        },
      },
      user: {
        fields: ['id', 'username', 'email'] as any,
      },
    };

  if (Number.isInteger(citizenId)) {
    const student = await strapi.db.query('api::student.student').findOne({
      where: {
        id_number: citizenId,
      },
      populate,
    } as any);

    if (student) return student;
  }

  const studentsRaw: any = await strapi.entityService.findMany('api::student.student', {
    filters: {
      user: {
        id: {
          $eq: user.id,
        },
      },
    } as any,
    populate,
    limit: 1,
  });

  const students = Array.isArray(studentsRaw) ? studentsRaw : studentsRaw ? [studentsRaw] : [];
  return students[0] ?? null;
}

function eventMatchesStudent(event: any, student: any) {
  if (!student) return false;
  if (event?.staffOnly === true) return false;

  const partyAudience = event?.partyAudience || 'All';
  if (partyAudience !== 'All' && partyAudience !== student?.party) return false;

  if (event?.allStudents !== false) return true;

  const studentCityId = student?.city?.id;
  const studentCountyId = student?.city?.county?.id;
  const targetCities = Array.isArray(event?.targetCities) ? event.targetCities : [];
  const targetCounties = Array.isArray(event?.targetCounties) ? event.targetCounties : [];

  const cityMatch = targetCities.some((city: any) => city?.id === studentCityId);
  const countyMatch = targetCounties.some((county: any) => county?.id === studentCountyId);

  return cityMatch || countyMatch;
}

export default {
  async profile(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const student = await findStudentForUser(user);
    if (!student) return ctx.notFound('No student profile is linked to this login.');

    ctx.body = {
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        student: {
          id: student.id,
          id_number: student.id_number,
          name: student.name,
          party: student.party,
          city: student.city
            ? {
                id: student.city.id,
                name: student.city.name,
              }
            : null,
          county: student.city?.county
            ? {
                id: student.city.county.id,
                name: student.city.county.name,
              }
            : null,
        },
      },
    };
  },

  async schedule(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const student = await findStudentForUser(user);
    if (!student) return ctx.notFound('No student profile is linked to this login.');

    const eventsRaw: any = await strapi.entityService.findMany('api::event.event', {
      filters: {
        staffOnly: {
          $ne: true,
        },
      } as any,
      populate: {
        targetCities: {
          fields: ['id', 'name'] as any,
        },
        targetCounties: {
          fields: ['id', 'name'] as any,
        },
      } as any,
      sort: { starts_at: 'asc' },
      limit: 1000,
    });

    const events = Array.isArray(eventsRaw) ? eventsRaw : eventsRaw ? [eventsRaw] : [];
    ctx.body = {
      data: events.filter((event) => eventMatchesStudent(event, student)),
    };
  },
};

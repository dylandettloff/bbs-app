const IMPORT_SECRET_HEADER = 'x-import-secret';

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function parseCitizenId(value: unknown) {
  const raw = cleanText(value);
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

async function findOne(uid: string, filters: any, populate?: any) {
  const results: any = await strapi.entityService.findMany(uid as any, {
    filters,
    populate,
    limit: 1,
  } as any);

  return Array.isArray(results) ? results[0] ?? null : results ?? null;
}

async function ensureCounty(name: string) {
  const existing = await findOne('api::county.county', { name: { $eq: name } });
  if (existing) return existing;

  return strapi.entityService.create('api::county.county', {
    data: {
      name,
      publishedAt: new Date(),
    } as any,
  });
}

async function ensureCity(name: string, county: any) {
  const existing = await findOne(
    'api::city.city',
    {
      name: { $eq: name },
      county: {
        id: {
          $eq: county.id,
        },
      },
    },
    { county: true }
  );

  if (existing) return existing;

  return strapi.entityService.create('api::city.city', {
    data: {
      name,
      county: county.id,
      publishedAt: new Date(),
    } as any,
  });
}

async function ensureUser(account: any, role: any) {
  const username = cleanText(account.citizenId);
  const email = cleanText(account.email).toLowerCase();
  const password = cleanText(account.password);
  const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { username },
  });

  const data = {
    username,
    email,
    password,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: role.id,
  };

  if (existing) {
    return strapi.plugin('users-permissions').service('user').edit(existing.id, data);
  }

  return strapi.plugin('users-permissions').service('user').add(data);
}

async function ensureStudent(citizenId: number, city: any, user: any) {
  const existing = await findOne('api::student.student', {
    id_number: {
      $eq: citizenId,
    },
  });

  const data = {
    id_number: citizenId,
    name: null,
    party: null,
    city: city.id,
    user: user.id,
    publishedAt: new Date(),
  } as any;

  if (existing) {
    return strapi.entityService.update('api::student.student', existing.id, { data });
  }

  return strapi.entityService.create('api::student.student', { data });
}

export default {
  async importAccounts(ctx: any) {
    const expectedSecret = process.env.STUDENT_IMPORT_SECRET;
    const receivedSecret = ctx.request.headers[IMPORT_SECRET_HEADER];

    if (!expectedSecret) {
      return ctx.internalServerError('STUDENT_IMPORT_SECRET is not configured.');
    }

    if (!receivedSecret || receivedSecret !== expectedSecret) {
      return ctx.unauthorized('Invalid import secret.');
    }

    const accounts = Array.isArray(ctx.request.body?.accounts) ? ctx.request.body.accounts : [];
    if (accounts.length === 0) {
      return ctx.badRequest('Request body must include an accounts array.');
    }

    const role = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    if (!role) {
      return ctx.internalServerError('Authenticated users-permissions role was not found.');
    }

    const summary = {
      requested: accounts.length,
      imported: 0,
      failed: 0,
      errors: [] as Array<{ citizenId: string; message: string }>,
    };

    for (const account of accounts) {
      const citizenId = parseCitizenId(account.citizenId);
      const email = cleanText(account.email);
      const password = cleanText(account.password);
      const cityName = cleanText(account.city);
      const countyName = cleanText(account.county);

      try {
        if (!citizenId || !email || !password || !cityName || !countyName) {
          throw new Error('Missing citizenId, email, password, city, or county.');
        }

        const county = await ensureCounty(countyName);
        const city = await ensureCity(cityName, county);
        const user = await ensureUser({ citizenId, email, password }, role);
        await ensureStudent(citizenId, city, user);

        summary.imported += 1;
      } catch (error: any) {
        summary.failed += 1;
        summary.errors.push({
          citizenId: cleanText(account.citizenId),
          message: error?.message || String(error),
        });
      }
    }

    ctx.body = { data: summary };
  },
};

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

type ScheduleRow = Record<string, string>;

const scheduleCache = new Map<string, { expiresAt: number; rows: ScheduleRow[] }>();

function normalizeHeader(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text: string): ScheduleRow[] {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      if (header) row[header] = values[index] ?? '';
      return row;
    }, {} as ScheduleRow);
  });
}

function getCell(row: ScheduleRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value) return value.trim();
  }

  return '';
}

function booleanCell(value: string) {
  return ['true', 'yes', 'y', '1'].includes(String(value || '').trim().toLowerCase());
}

function countyMatches(rowCounty: string, studentCounty: string) {
  const county = String(rowCounty || '').trim();
  if (!county) return true;

  const normalized = county.toLowerCase();
  if (['all', 'all counties', 'everyone', '*'].includes(normalized)) return true;

  return county
    .split(/[,;/|]/)
    .map((item) => item.trim().toLowerCase().replace(/\s+county$/, ''))
    .includes(studentCounty.toLowerCase().replace(/\s+county$/, ''));
}

function parseScheduleDate(row: ScheduleRow, primaryAliases: string[], dateAliases: string[], timeAliases: string[]) {
  const directValue = getCell(row, primaryAliases);
  if (directValue) {
    const parsed = new Date(directValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const dateValue = getCell(row, dateAliases);
  const timeValue = getCell(row, timeAliases);
  if (!dateValue) return null;

  const parsed = new Date(timeValue ? `${dateValue} ${timeValue}` : dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function fetchScheduleRows(url: string) {
  const cacheSeconds = Number(process.env.SCHEDULE_SHEET_CACHE_SECONDS ?? 60);
  const cacheKey = url;
  const cached = scheduleCache.get(cacheKey);

  if (cacheSeconds > 0 && cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Schedule sheet request failed with ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  scheduleCache.set(cacheKey, {
    expiresAt: Date.now() + Math.max(cacheSeconds, 0) * 1000,
    rows,
  });

  return rows;
}

function scheduleUrlsForCounty(countyName: string) {
  const urls: string[] = [];
  const singleUrl = process.env.SCHEDULE_SHEET_CSV_URL;

  if (singleUrl) urls.push(singleUrl);

  if (process.env.SCHEDULE_SHEET_CSV_URLS) {
    try {
      const byCounty = JSON.parse(process.env.SCHEDULE_SHEET_CSV_URLS);
      const countyUrl = byCounty[countyName] || byCounty[countyName.toLowerCase()];
      const allUrl = byCounty.all || byCounty._all;

      if (allUrl) urls.push(allUrl);
      if (countyUrl) urls.push(countyUrl);
    } catch (error) {
      strapi.log.warn(`[schedule] SCHEDULE_SHEET_CSV_URLS is not valid JSON: ${String(error)}`);
    }
  }

  return [...new Set(urls)];
}

async function liveScheduleForStudent(student: any) {
  const countyName = student?.city?.county?.name;
  const urls = countyName ? scheduleUrlsForCounty(countyName) : [];

  if (urls.length === 0) return null;

  const rowGroups = await Promise.all(urls.map(fetchScheduleRows));
  const rows = rowGroups.flat();

  return rows
    .filter((row) => !booleanCell(getCell(row, ['staffOnly', 'staff only', 'staff'])))
    .filter((row) => countyMatches(getCell(row, ['county', 'counties']), countyName))
    .map((row, index) => {
      const startsAt = parseScheduleDate(
        row,
        ['starts_at', 'start', 'start datetime', 'start date time'],
        ['date', 'start date'],
        ['start time']
      );
      const endsAt = parseScheduleDate(
        row,
        ['ends_at', 'end', 'end datetime', 'end date time'],
        ['date', 'end date'],
        ['end time']
      );

      return {
        id: getCell(row, ['id', 'externalId', 'external id']) || `sheet-${index}`,
        externalId: getCell(row, ['externalId', 'external id']) || null,
        title: getCell(row, ['title', 'event', 'activity', 'name']) || 'Untitled event',
        starts_at: startsAt,
        ends_at: endsAt,
        location: getCell(row, ['location', 'place', 'room']),
        description: getCell(row, ['description', 'details', 'notes']),
      };
    })
    .filter((event) => event.starts_at)
    .sort((a, b) => Date.parse(a.starts_at || '') - Date.parse(b.starts_at || ''));
}

async function getAuthenticatedUser(ctx: any) {
  const tokenPayload: any = await strapi
    .plugin('users-permissions')
    .service('jwt')
    .getToken(ctx);

  if (!tokenPayload?.id) return null;

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: {
      id: tokenPayload.id,
      blocked: false,
    },
  });

  return user ?? null;
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
    const user = await getAuthenticatedUser(ctx);
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
    const user = await getAuthenticatedUser(ctx);
    if (!user) return ctx.unauthorized();

    const student = await findStudentForUser(user);
    if (!student) return ctx.notFound('No student profile is linked to this login.');

    try {
      const liveSchedule = await liveScheduleForStudent(student);
      if (liveSchedule) {
        ctx.body = { data: liveSchedule };
        return;
      }
    } catch (error) {
      strapi.log.error(`[schedule] Google Sheet schedule failed: ${String(error)}`);
    }

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

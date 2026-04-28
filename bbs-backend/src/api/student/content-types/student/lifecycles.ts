import { sendExpoPushNotifications } from '../../../../utils/push';

function toUserTokens(rawUsers: any[]): string[] {
  return rawUsers.flatMap((u) =>
    Array.isArray(u?.expoPushTokens)
      ? u.expoPushTokens.filter((t: unknown) => typeof t === 'string')
      : []
  );
}

export default {
  async afterUpdate(event: any) {
    const studentId = event?.result?.id;
    if (!studentId) return;

    try {
      const student: any = await strapi.entityService.findOne(
        'api::student.student',
        studentId,
        {
          fields: ['id', 'Name'] as any,
          populate: {
            city: {
              fields: ['id', 'name'] as any,
              populate: {
                users: { fields: ['id', 'expoPushTokens'] as any },
                county: {
                  fields: ['id', 'name'] as any,
                  populate: {
                    users_permissions_users: {
                      fields: ['id', 'expoPushTokens'] as any,
                    },
                  },
                },
              },
            },
          },
        }
      );

      const cityUsers = Array.isArray(student?.city?.users) ? student.city.users : [];
      const countyUsers = Array.isArray(student?.city?.county?.users_permissions_users)
        ? student.city.county.users_permissions_users
        : [];

      const tokens = Array.from(new Set(toUserTokens([...cityUsers, ...countyUsers])));
      if (tokens.length === 0) return;

      const studentName = student?.Name || `Student #${studentId}`;
      const cityName = student?.city?.name;

      await sendExpoPushNotifications({
        tokens,
        title: 'Roster Update',
        body: cityName
          ? `${studentName} in ${cityName} was updated.`
          : `${studentName} was updated.`,
        data: {
          type: 'student.updated',
          studentId,
          cityId: student?.city?.id ?? null,
        },
      });
    } catch (error) {
      strapi.log.error(`[push] student afterUpdate failed: ${String(error)}`);
    }
  },
};

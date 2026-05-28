import { sendExpoPushNotifications } from '../../../../utils/push';

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
                county: {
                  fields: ['id', 'name'] as any,
                },
              },
            },
          },
        }
      );

      const tokenRowsRaw: any = await strapi.entityService.findMany(
        'api::push-token.push-token' as any,
        {
          fields: ['token', 'enabled'] as any,
          filters: { enabled: { $eq: true } } as any,
          limit: 10000,
        }
      );
      const tokenRows: any[] = Array.isArray(tokenRowsRaw)
        ? tokenRowsRaw
        : tokenRowsRaw
        ? [tokenRowsRaw]
        : [];
      const tokens = Array.from(
        new Set(
          tokenRows
            .map((row) => row?.token)
            .filter((token): token is string => typeof token === 'string')
        )
      );
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

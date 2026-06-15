export default ({ env }) => ({
  'users-permissions': {
    config: {
      ratelimit: {
        enabled: true,
        interval: {
          min: env.int('AUTH_RATE_LIMIT_INTERVAL_MINUTES', 1),
        },
        max: env.int('AUTH_RATE_LIMIT_MAX', 2000),
      },
    },
  },
  email: {
    config: {
      provider: 'sendmail',
      providerOptions: {},
      settings: {
        defaultFrom: env(
          'EMAIL_DEFAULT_FROM',
          'no-reply@badgerboysstate.org'
        ),
        defaultReplyTo: env(
          'EMAIL_DEFAULT_REPLY_TO',
          'no-reply@badgerboysstate.org'
        ),
      },
    },
  },
});

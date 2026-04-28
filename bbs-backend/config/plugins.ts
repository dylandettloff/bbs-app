export default ({ env }) => ({
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

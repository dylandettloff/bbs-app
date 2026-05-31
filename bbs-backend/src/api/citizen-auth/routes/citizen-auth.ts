export default {
  routes: [
    {
      method: 'POST',
      path: '/citizen-auth/forgot-password',
      handler: 'api::citizen-auth.citizen-auth.forgotPassword',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/citizen-auth/reset-password',
      handler: 'api::citizen-auth.citizen-auth.resetPasswordPage',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/citizen-auth/reset-password',
      handler: 'api::citizen-auth.citizen-auth.resetPassword',
      config: {
        auth: false,
      },
    },
  ],
};

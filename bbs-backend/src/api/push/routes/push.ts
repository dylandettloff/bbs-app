export default {
  routes: [
    {
      method: 'POST',
      path: '/push/register',
      handler: 'api::push.push.register',
      config: { auth: false },
    },
  ],
};

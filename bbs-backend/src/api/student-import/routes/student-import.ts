export default {
  routes: [
    {
      method: 'POST',
      path: '/student-import/accounts',
      handler: 'api::student-import.student-import.importAccounts',
      config: {
        auth: false,
      },
    },
  ],
};

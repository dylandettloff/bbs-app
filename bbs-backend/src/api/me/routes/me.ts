export default {
  routes: [
    {
      method: "GET",
      path: "/me",
      handler: "api::me.me.profile",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/me/profile",
      handler: "api::me.me.profile",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/me/schedule",
      handler: "api::me.me.schedule",
      config: { auth: {} },
    },
  ],
};

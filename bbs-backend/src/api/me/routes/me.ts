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
      path: "/me/roster",
      handler: "api::me.me.roster",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/me/events",
      handler: "api::me.me.events",
      config: { auth: {} },
    },
  ],
};

export default {
  routes: [
    {
      method: "GET",
      path: "/manual-file",
      handler: "api::manual-file.manual-file.find",
      config: {
        auth: false,
      },
    },
  ],
};

module.exports = [
  'strapi::errors',
  { name: 'strapi::security', config: { contentSecurityPolicy: false } },
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://localhost:19006','http://localhost:8081','http://localhost:3000','http://localhost:1337'],
      headers: '*',
      methods: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'],
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

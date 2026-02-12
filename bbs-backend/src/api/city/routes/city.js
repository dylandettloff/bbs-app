'use strict';
const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::city.city', {
  config: {
    findOne: {
      policies: ['global::is-counselor-by-city'],
    },
  },
});

/**
 * press router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::press.press', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});

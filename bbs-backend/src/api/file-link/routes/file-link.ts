/**
 * file-link router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::file-link.file-link', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});

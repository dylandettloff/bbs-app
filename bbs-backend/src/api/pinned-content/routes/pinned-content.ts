/**
 * pinned-content router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::pinned-content.pinned-content' as any, {
  config: {
    find: { auth: false },
  },
});

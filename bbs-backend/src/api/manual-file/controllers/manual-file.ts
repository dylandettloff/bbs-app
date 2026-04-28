const PDF_FILTERS = {
  mime: {
    $containsi: "pdf",
  },
};

function normalizeTitle(file: any) {
  const raw = file?.caption || file?.alternativeText || file?.name || "Citizen Manual";
  return String(raw).replace(/\.[^.]+$/, "").trim() || "Citizen Manual";
}

function normalizeSummary(file: any) {
  const caption = file?.caption ? String(file.caption).trim() : "";
  const alt = file?.alternativeText ? String(file.alternativeText).trim() : "";
  return caption || alt || null;
}

async function findLatestManualFile() {
  const preferred = await strapi.entityService.findMany("plugin::upload.file", {
    filters: {
      ...PDF_FILTERS,
      $or: [
        { name: { $containsi: "manual" } },
        { name: { $containsi: "citizen" } },
        { alternativeText: { $containsi: "manual" } },
        { caption: { $containsi: "manual" } },
      ],
    },
    sort: { updatedAt: "desc" },
    limit: 1,
  });

  if (Array.isArray(preferred) && preferred[0]) return preferred[0];

  const fallback = await strapi.entityService.findMany("plugin::upload.file", {
    filters: PDF_FILTERS,
    sort: { updatedAt: "desc" },
    limit: 1,
  });

  return Array.isArray(fallback) ? fallback[0] ?? null : null;
}

export default {
  async find(ctx: any) {
    const file = await findLatestManualFile();

    if (!file?.url) {
      ctx.body = {
        data: null,
        error: {
          message: "Citizen manual PDF was not found yet.",
        },
      };
      return;
    }

    ctx.body = {
      data: {
        id: file.id,
        title: normalizeTitle(file),
        summary: normalizeSummary(file),
        url: file.url,
        filename: file.name,
        mime: file.mime,
        updatedAt: file.updatedAt,
      },
    };
  },
};

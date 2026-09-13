const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onShow() {
      return this.run(async () => {
        const p = provider();
        const [banners, categories, services, cases] = await Promise.all([
          p.list("banners"),
          config.features.category ? p.list("categories") : [],
          config.features.service ? p.list("services") : [],
          config.features.case ? p.list("cases") : [],
        ]);
        this.setData({ banners, categories, services, cases });
      });
    },
  }),
);

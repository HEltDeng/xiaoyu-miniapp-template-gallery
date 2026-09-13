const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onShow() {
      return this.run(async () =>
        this.setData({ categories: await provider().list("categories") }),
      );
    },
    select(e) {
      go("service", e.currentTarget.dataset.id);
    },
  }),
);

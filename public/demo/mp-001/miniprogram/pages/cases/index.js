const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onShow() {
      return this.run(async () =>
        this.setData({ cases: await provider().list("cases") }),
      );
    },
  }),
);

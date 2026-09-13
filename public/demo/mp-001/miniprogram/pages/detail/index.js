const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onLoad(q) {
      this.id = q.id;
    },
    onShow() {
      return this.run(async () => {
        const item = (await provider().list("services")).find(
          (x) => x.id === this.id,
        );
        if (!item) throw Error("服务不存在或已下架");
        this.setData({ item });
      });
    },
    book() {
      wx.setStorageSync(config.clientId + ":selectedService", this.id);
      go("booking");
    },
  }),
);

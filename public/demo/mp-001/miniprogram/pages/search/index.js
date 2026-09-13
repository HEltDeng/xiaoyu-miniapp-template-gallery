const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onShow() {
      return this.run(async () => {
        this.all = await provider().list("services");
        this.setData({ services: this.all });
      });
    },
    search(e) {
      const q = e.detail.value.trim().toLowerCase();
      this.setData({
        services: (this.all || []).filter((x) =>
          (x.title + " " + x.subtitle).toLowerCase().includes(q),
        ),
      });
    },
  }),
);

const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onLoad(q) {
      this.category = q.id || "";
    },
    onShow() {
      return this.run(async () => {
        const stored = wx.getStorageSync(config.clientId + ":selectedCategory");
        if (stored) {
          this.category = stored;
          wx.removeStorageSync(config.clientId + ":selectedCategory");
        }
        const p = provider();
        this.all = await p.list("services");
        this.setData({
          categories: await p.list("categories"),
          services: this.category
            ? this.all.filter((x) => x.categoryId === this.category)
            : this.all,
          selected: this.category || "",
        });
      });
    },
    filter(e) {
      const id = e.currentTarget.dataset.id;
      this.setData({
        selected: id,
        services: id ? this.all.filter((x) => x.categoryId === id) : this.all,
      });
    },
  }),
);

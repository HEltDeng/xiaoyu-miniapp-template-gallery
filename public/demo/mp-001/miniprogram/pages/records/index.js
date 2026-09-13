const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onShow() {
      return this.run(async () =>
        this.setData({ records: await provider().bookings() }),
      );
    },
    cancel(e) {
      wx.showModal({
        title: "取消这条预约？",
        content: "取消后可重新发起预约。",
        success: (r) => {
          if (r.confirm)
            this.run(async () => {
              await provider().cancel(e.currentTarget.dataset.id);
              this.setData({ records: await provider().bookings() });
            });
        },
      });
    },
  }),
);

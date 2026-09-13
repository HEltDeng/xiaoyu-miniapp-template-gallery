const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    onShow() {
      return this.run(async () => {
        const identity = await provider().identity();
        const records = config.features.booking
          ? await provider().bookings()
          : [];
        this.setData({ identity, count: records.length });
      });
    },
  }),
);

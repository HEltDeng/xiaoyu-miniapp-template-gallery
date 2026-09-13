const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    clear() {
      wx.showModal({
        title: "清除本地演示记录？",
        content: "仅删除本客户的本机预约与反馈，不影响云端数据。",
        success: (r) => {
          if (r.confirm) {
            for (const k of ["bookings", "feedback", "selectedService"])
              wx.removeStorageSync(config.clientId + ":" + k);
            wx.showToast({ title: "已清除" });
          }
        },
      });
    },
  }),
);

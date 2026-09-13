const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
const { validateBooking } = require("../../domain/models");
Page(
  page({
    onShow() {
      return this.run(async () => {
        const services = await provider().list("services");
        const saved = wx.getStorageSync(config.clientId + ":selectedService");
        this.setData({
          services,
          serviceIndex: Math.max(
            0,
            services.findIndex((x) => x.id === saved),
          ),
          today: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
          times: ["09:00", "10:30", "14:00", "15:30", "17:00"],
          timeIndex: 0,
        });
      });
    },
    changeService(e) {
      this.setData({ serviceIndex: Number(e.detail.value) });
    },
    date(e) {
      this.setData({ date: e.detail.value });
    },
    time(e) {
      this.setData({ timeIndex: Number(e.detail.value) });
    },
    consent(e) {
      this.setData({ consent: e.detail.value.includes("yes") });
    },
    submit(e) {
      if (this.data.loading) return;
      this.run(async () => {
        if (!this.data.services.length) throw Error("暂无可预约服务");
        const x = {
          ...e.detail.value,
          serviceId: this.data.services[this.data.serviceIndex].id,
          date: this.data.date || "",
          time: this.data.times[this.data.timeIndex],
          consent: !!this.data.consent,
          requestId:
            this.requestId ||
            (this.requestId =
              "req-" +
              Date.now() +
              "-" +
              Math.random().toString(36).slice(2, 8)),
        };
        validateBooking(x);
        await provider().book(x);
        this.requestId = "";
        wx.showModal({
          title:
            provider().mode === "MOCK" ? "演示预约已保存" : "预约意向已提交",
          content:
            provider().mode === "MOCK"
              ? "记录仅在本机，可在预约记录查看。"
              : "请等待商家联系确认档期。",
          showCancel: false,
          success: () => go("records"),
        });
      });
    },
  }),
);

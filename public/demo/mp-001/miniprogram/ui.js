const { config } = require("./config/client.config");
const { provider } = require("./data/index");
const route = {
  home: "home",
  service: "services",
  booking: "booking",
  profile: "profile",
  category: "category",
  search: "search",
  case: "cases",
  form: "feedback",
  settings: "settings",
  records: "records",
  detail: "detail",
};
function go(key, id) {
  const feature = { records: "booking", detail: "service" }[key] || key;
  if (!config.features[feature]) return;
  if (key === "service" && id)
    wx.setStorageSync(config.clientId + ":selectedCategory", id);
  const url = "/pages/" + route[key] + "/index";
  if (config.navigation.includes(key) && config.navigation.length >= 2)
    wx.switchTab({ url });
  else
    wx.navigateTo({ url: url + (id ? "?id=" + encodeURIComponent(id) : "") });
}
function page(extra) {
  return Object.assign(
    {
      data: {
        config,
        features: config.features,
        loading: false,
        error: "",
        mode:
          config.backendMode === "CLOUDBASE" && !config.cloudbaseEnv
            ? "MOCK"
            : config.backendMode,
      },
      nav(e) {
        go(e.currentTarget.dataset.page, e.currentTarget.dataset.id);
      },
      contact() {
        if (!config.contactPhone) {
          wx.showToast({ title: "演示商家暂未配置电话", icon: "none" });
          return;
        }
        wx.makePhoneCall({ phoneNumber: config.contactPhone });
      },
      async run(job) {
        this.setData({ loading: true, error: "" });
        try {
          await job();
        } catch (e) {
          this.setData({ error: e.message || "操作失败，请重试" });
        } finally {
          this.setData({ loading: false });
        }
      },
      retry() {
        if (this.onShow) this.onShow();
      },
      privacy() {
        go("settings");
      },
    },
    extra,
  );
}
module.exports = { page, go, provider, config };

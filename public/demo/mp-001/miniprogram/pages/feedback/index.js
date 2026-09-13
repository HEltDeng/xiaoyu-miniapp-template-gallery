const { page, provider, config, go } = require("../../ui");
void provider;
void config;
void go;
Page(
  page({
    consent(e) {
      this.setData({ consent: e.detail.value.includes("yes") });
    },
    submit(e) {
      if (this.data.loading) return;
      this.run(async () => {
        this.requestId = this.requestId || "fb-" + Date.now();
        await provider().feedback({
          requestId: this.requestId,
          message: e.detail.value.message,
          consent: !!this.data.consent,
        });
        this.requestId = "";
        wx.showToast({
          title: provider().mode === "MOCK" ? "反馈已本地保存" : "反馈已提交",
          icon: "success",
        });
        this.setData({ message: "" });
      });
    },
    upload() {
      this.run(async () => {
        if (provider().mode === "MOCK") throw Error("本地模式不上传文件");
        await new Promise((resolve, reject) =>
          wx.requirePrivacyAuthorize({ success: resolve, fail: reject }),
        );
        const r = await new Promise((resolve, reject) =>
          wx.chooseMedia({
            count: 1,
            mediaType: ["image"],
            sourceType: ["album"],
            success: resolve,
            fail: reject,
          }),
        );
        if (r.tempFiles[0].size > 5 * 1024 * 1024)
          throw Error("图片不能超过5MB");
        const fileID = await provider().upload(r.tempFiles[0].tempFilePath);
        this.setData({ uploaded: fileID });
      });
    },
  }),
);

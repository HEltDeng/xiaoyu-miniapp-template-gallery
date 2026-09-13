"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudBaseProvider = void 0;
class CloudBaseProvider {
    constructor(env) {
        this.mode = "CLOUDBASE";
        wx.cloud.init({ env, traceUser: false });
    }
    async call(action, payload = {}) {
        const r = await wx.cloud.callFunction({
            name: "factory",
            data: { action, payload },
        });
        const result = r.result;
        if (result.error)
            throw new Error(result.error);
        return result.data;
    }
    list(collection) {
        return this.call("list", { collection });
    }
    identity() {
        return this.call("identity");
    }
    book(x) {
        return this.call("book", x);
    }
    bookings() {
        return this.call("bookings");
    }
    cancel(id) {
        return this.call("cancel", { id });
    }
    feedback(x) {
        return this.call("feedback", x);
    }
    async upload(filePath) {
        const user = await this.identity();
        const r = await wx.cloud.uploadFile({
            cloudPath: "feedback/" + user.id + "/" + Date.now() + ".jpg",
            filePath,
        });
        return r.fileID;
    }
}
exports.CloudBaseProvider = CloudBaseProvider;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestApiProvider = void 0;
class RestApiProvider {
    constructor(base) {
        this.base = base;
        this.mode = "REST_API";
        this.token = "";
        if (!/^https:\/\//.test(base))
            throw new Error("REST_API 必须配置 HTTPS 地址");
        this.base = base.replace(/\/$/, "");
    }
    request(path, method = "GET", data = {}) {
        return new Promise((resolve, reject) => wx.request({
            url: this.base + path,
            method,
            data,
            timeout: 15000,
            header: { Authorization: this.token ? "Bearer " + this.token : "" },
            success: (r) => {
                if (r.statusCode >= 200 && r.statusCode < 300)
                    resolve(r.data);
                else
                    reject(new Error("服务请求失败 " + r.statusCode));
            },
            fail: () => reject(new Error("网络连接失败，请稍后重试")),
        }));
    }
    async identity() {
        const login = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
        const r = await this.request("/auth/wechat", "POST", { code: login.code });
        this.token = r.token;
        return r.user;
    }
    list(c) {
        return this.request("/catalog/" + c);
    }
    async book(x) {
        if (!this.token)
            await this.identity();
        return this.request("/bookings", "POST", { ...x });
    }
    async bookings() {
        if (!this.token)
            await this.identity();
        return this.request("/bookings");
    }
    async cancel(id) {
        if (!this.token)
            await this.identity();
        await this.request("/bookings/" + encodeURIComponent(id) + "/cancel", "POST");
    }
    async feedback(x) {
        if (!this.token)
            await this.identity();
        await this.request("/feedback", "POST", { ...x });
    }
    async upload(_path) {
        void _path;
        throw new Error("REST 上传接口需按客户服务器适配");
    }
}
exports.RestApiProvider = RestApiProvider;

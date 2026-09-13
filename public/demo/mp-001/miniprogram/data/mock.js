"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockProvider = void 0;
const seed_json_1 = __importDefault(require("./seed.json"));
const models_1 = require("../domain/models");
class MockProvider {
    constructor(storage, namespace) {
        this.storage = storage;
        this.namespace = namespace;
        this.mode = "MOCK";
    }
    key(s) {
        return this.namespace + ":" + s;
    }
    async list(c) {
        const custom = this.storage.get(this.key("catalog"));
        return (custom || seed_json_1.default)[c];
    }
    async identity() {
        return { id: "local-demo", mode: this.mode };
    }
    async bookings() {
        return (this.storage.get(this.key("bookings")) || []);
    }
    async book(x) {
        (0, models_1.validateBooking)(x);
        const rows = await this.bookings();
        const previous = rows.find((y) => y.requestId === x.requestId);
        if (previous)
            return previous;
        const s = (await this.list("services")).find((y) => y.id === x.serviceId);
        if (!s)
            throw new Error("服务不存在");
        const row = {
            ...x,
            id: "demo-" + x.requestId,
            createdAt: new Date().toISOString(),
            status: "待确认（本地演示）",
            serviceTitle: s.title,
        };
        this.storage.set(this.key("bookings"), [row, ...rows]);
        return row;
    }
    async cancel(id) {
        this.storage.set(this.key("bookings"), (await this.bookings()).map((x) => x.id === id ? { ...x, status: "已取消" } : x));
    }
    async feedback(x) {
        if (!x.consent || !x.message.trim() || x.message.length > 1000)
            throw new Error("请填写1至1000字反馈并同意隐私说明");
        const key = this.key("feedback");
        const rows = (this.storage.get(key) || []);
        if (!rows.some((r) => r.requestId === x.requestId))
            this.storage.set(key, [{ ...x }, ...rows]);
    }
    async upload(_path) {
        void _path;
        throw new Error("本地模式不上传文件，请配置云环境");
    }
}
exports.MockProvider = MockProvider;

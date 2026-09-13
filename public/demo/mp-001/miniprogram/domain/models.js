"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisabledPaymentProvider = void 0;
exports.validateBooking = validateBooking;
class DisabledPaymentProvider {
    async pay(_orderId) {
        void _orderId;
        throw new Error("真实支付未开通");
    }
}
exports.DisabledPaymentProvider = DisabledPaymentProvider;
function validateBooking(x) {
    if (!x.consent)
        throw new Error("请先阅读并同意隐私说明");
    if (!x.name.trim() || x.name.length > 40)
        throw new Error("请填写有效称呼");
    if (!/^1[3-9]\d{9}$/.test(x.phone))
        throw new Error("请输入11位手机号");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !/^\d{2}:\d{2}$/.test(x.time))
        throw new Error("请选择日期和时间");
    const d = new Date(x.date + "T" + x.time + ":00+08:00");
    if (!Number.isFinite(d.getTime()) || d.getTime() < Date.now())
        throw new Error("请选择未来的预约时间");
    if (new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== x.date ||
        !["09:00", "10:30", "14:00", "15:30", "17:00"].includes(x.time))
        throw new Error("日期或时间无效");
    if (x.note.length > 300)
        throw new Error("备注不能超过300字");
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(x.requestId))
        throw new Error("预约请求标识无效");
}

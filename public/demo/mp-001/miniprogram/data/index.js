"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provider = provider;
const client_config_1 = require("../config/client.config");
const mock_1 = require("./mock");
const cloudbase_1 = require("./cloudbase");
const rest_1 = require("./rest");
let current;
function provider() {
    if (current)
        return current;
    if (client_config_1.config.backendMode === "CLOUDBASE" && client_config_1.config.cloudbaseEnv)
        current = new cloudbase_1.CloudBaseProvider(client_config_1.config.cloudbaseEnv);
    else if (client_config_1.config.backendMode === "REST_API")
        current = new rest_1.RestApiProvider(client_config_1.config.apiBaseUrl);
    else
        current = new mock_1.MockProvider({
            get: (k) => wx.getStorageSync(k),
            set: (k, v) => wx.setStorageSync(k, v),
        }, client_config_1.config.clientId);
    return current;
}

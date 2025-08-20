// 免费代理池（建议替换为付费代理）
const proxyList = [
    'http://127.0.0.1:7890',  // 本地代理
    'http://127.0.0.1:1080',  // 本地代理
    // 可以添加更多代理
];

// 随机选择代理
export function getRandomProxy() {
    return proxyList[Math.floor(Math.random() * proxyList.length)];
}

// 代理轮换
let currentProxyIndex = 0;
export function getNextProxy() {
    const proxy = proxyList[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
    return proxy;
}

export default proxyList; 
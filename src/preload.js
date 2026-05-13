const { contextBridge, ipcRenderer } = require("electron");

// 在window对象下导出只读对象
contextBridge.exposeInMainWorld("audio_sender", {
    // 生成Silk格式的语音文件
    getSilk: (path) => ipcRenderer.invoke("LiteLoader.audio_sender.getSilk", path),
    // 转换本地文件格式并保存到数据目录下
    convertAndSaveFile: (filePath) => ipcRenderer.invoke('LiteLoader.audio_sender.convertAndSaveFile', filePath),
    // 复制文件到缓存目录
    copyFileToCache: (oldPath, newPath) => ipcRenderer.invoke("LiteLoader.audio_sender.copyFileToCache", oldPath, newPath),

    // 获取窗口Id
    getWebContentId: () => ipcRenderer.sendSync("LiteLoader.audio_sender.getWebContentId"),

    nativeCall: (event, payload, awaitCallback) => {
        const callbackId = self.crypto.randomUUID();
        const webContentId = ipcRenderer.sendSync("LiteLoader.audio_sender.getWebContentId");
        let resolve;
        if (awaitCallback) {
            resolve = new Promise((res) => {
                function onEvent(...args) {
                    if (typeof awaitCallback === "boolean") {
                        if (args[1]?.callbackId === callbackId) {
                            ipcRenderer.off(`RM_IPCFROM_MAIN${webContentId}`, onEvent);
                            res(args[2]);
                        }
                    } else if (Array.isArray(awaitCallback)) {
                        if (awaitCallback.includes(args?.[1]?.cmdName)) {
                            ipcRenderer.off(`RM_IPCFROM_MAIN${webContentId}`, onEvent);
                            res(args[2]);
                        }
                    } else {
                        if (args?.[2]?.cmdName === awaitCallback) {
                            ipcRenderer.off(`RM_IPCFROM_MAIN${webContentId}`, onEvent);
                            res(args[2]);
                        }
                    }
                }
                ipcRenderer.on(`RM_IPCFROM_MAIN${webContentId}`, onEvent);
            });
        } else {
            resolve = Promise.resolve(null);
        }
        ipcRenderer.send(
            `RM_IPCFROM_RENDERER${webContentId}`,
            {
                peerId: webContentId,
                callbackId,
                ...event,
            },
            payload,
        );
        return resolve;
    },
});

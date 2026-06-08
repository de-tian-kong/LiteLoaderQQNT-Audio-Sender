const { contextBridge, ipcRenderer, webUtils } = require("electron");

// 在window对象下导出只读对象
contextBridge.exposeInMainWorld("audio_sender", {
    // 获取拖拽文件的真实路径（替代已弃用的 file.path）
    getFilePath: (file) => webUtils.getPathForFile(file),
    // 生成Silk格式的语音文件
    getSilk: (path) => ipcRenderer.invoke("LiteLoader.audio_sender.getSilk", path),
    // 转换本地文件格式并保存到数据目录下
    convertAndSaveFile: (filePath) => ipcRenderer.invoke('LiteLoader.audio_sender.convertAndSaveFile', filePath),
    // 复制文件到缓存目录
    copyFileToCache: (oldPath, newPath) => ipcRenderer.invoke("LiteLoader.audio_sender.copyFileToCache", oldPath, newPath),
    // 清理临时文件
    cleanupTempFile: (filePath) => ipcRenderer.invoke("LiteLoader.audio_sender.cleanupTempFile", filePath),

    // 获取窗口Id
    getWebContentId: () => ipcRenderer.sendSync("LiteLoader.audio_sender.getWebContentId"),

    nativeCall: (event, payload, awaitCallback) => {
        const callbackId = self.crypto.randomUUID();
        const webContentId = ipcRenderer.sendSync("LiteLoader.audio_sender.getWebContentId");
        let resolve;
        if (awaitCallback) {
            resolve = new Promise((res, rej) => {
                const timeout = setTimeout(() => {
                    ipcRenderer.off(`RM_IPCFROM_MAIN${webContentId}`, onEvent);
                    rej(new Error("nativeCall timeout"));
                }, 30000);

                function onEvent(...args) {
                    if (typeof awaitCallback === "boolean") {
                        if (args[1]?.callbackId === callbackId) {
                            clearTimeout(timeout);
                            ipcRenderer.off(`RM_IPCFROM_MAIN${webContentId}`, onEvent);
                            res(args[2]);
                        }
                    } else if (Array.isArray(awaitCallback)) {
                        if (awaitCallback.includes(args?.[1]?.cmdName)) {
                            clearTimeout(timeout);
                            ipcRenderer.off(`RM_IPCFROM_MAIN${webContentId}`, onEvent);
                            res(args[2]);
                        }
                    } else {
                        if (args?.[2]?.cmdName === awaitCallback) {
                            clearTimeout(timeout);
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

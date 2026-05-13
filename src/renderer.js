import { Contact } from './utils/rendererUtils.js';

// 运行在 Electron 渲染进程 下的页面脚本

const logger = {
    info: function (...args) {
        console.log(`[Audio-Sender]`, ...args);
    },
    warn: function (...args) {
        console.warn(`[Audio-Sender]`, ...args);
    },
    error: function (...args) {
        console.error(`[Audio-Sender]`, ...args);
        alert(`[Audio-Sender]` + args.join(" "));
    }
};

// 拖拽发送音频文件功能
document.addEventListener('drop', async e => {
    if (document.querySelector(".audio-msg-input") != undefined) {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const currentContact = Contact.getCurrentContact();
        if (!currentContact) {
            logger.warn("无法获取当前聊天对象");
            return;
        }

        // 串行处理文件，避免同时处理多个文件导致卡顿
        for (const file of files) {
            try {
                logger.info("开始处理文件:", file.name);
                const result = await audio_sender.convertAndSaveFile(file.path);
                logger.info("转换结果:", result);

                if (result.res == "success") {
                    const silkData = await audio_sender.getSilk(result.file);
                    logger.info("Silk 编码完成:", silkData);
                    await currentContact.sendPttMessage(silkData);
                    logger.info("消息发送完成");
                } else {
                    logger.warn("转换失败:", result.msg);
                }
            } catch (error) {
                logger.error("处理文件时出错:", error);
            }
        }
    }
});

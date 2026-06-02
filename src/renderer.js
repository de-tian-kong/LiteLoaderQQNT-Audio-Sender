import { Contact } from './utils/rendererUtils.js';

// 运行在 Electron 渲染进程 下的页面脚本

const logger = {
    info: (...args) => console.log(`[Audio-Sender]`, ...args),
    warn: (...args) => console.warn(`[Audio-Sender]`, ...args),
    error: (...args) => console.error(`[Audio-Sender]`, ...args),
};

// 支持的音频文件扩展名
const AUDIO_EXTENSIONS = new Set([
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.silk',
    '.opus', '.amr', '.ape', '.alac', '.pcm'
]);

// 拖拽发送音频文件功能

// 阻止语音输入区域的 dragover 默认行为，确保 drop 事件能正常触发
document.addEventListener('dragover', e => {
    const audioInput = document.querySelector(".audio-msg-input");
    if (audioInput !== null && (audioInput.contains(e.target) || audioInput === e.target)) {
        e.preventDefault();
        e.stopPropagation();
    }
});

document.addEventListener('drop', async e => {
    const audioInput = document.querySelector(".audio-msg-input");
    if (audioInput !== null && (audioInput.contains(e.target) || audioInput === e.target)) {
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
                // 验证文件是否为支持的音频格式
                const ext = file.name.includes('.')
                    ? '.' + file.name.split('.').pop().toLowerCase()
                    : '';
                if (!AUDIO_EXTENSIONS.has(ext)) {
                    logger.warn("跳过不支持的文件格式:", file.name);
                    continue;
                }

                logger.info("开始处理文件:", file.name);
                const result = await audio_sender.convertAndSaveFile(file.path);
                logger.info("转换结果:", result);

                if (result.res == "success") {
                    const silkData = await audio_sender.getSilk(result.file);
                    if (silkData.res === "error") {
                        logger.warn("Silk 编码失败:", silkData.msg);
                        // 清理转换产生的临时文件
                        if (result.file !== file.path) {
                            await audio_sender.cleanupTempFile(result.file);
                        }
                        continue;
                    }

                    logger.info("Silk 编码完成:", silkData);
                    // 等待消息真正发送完成后再清理
                    await currentContact.sendPttMessage(silkData, undefined, true);
                    logger.info("消息发送完成");

                    // 清理临时 silk 文件
                    if (silkData.path !== file.path) {
                        await audio_sender.cleanupTempFile(silkData.path);
                    }
                    // 清理 ffmpeg 转换产生的临时文件
                    if (result.file !== file.path && result.file !== silkData.path) {
                        await audio_sender.cleanupTempFile(result.file);
                    }
                } else {
                    logger.warn("转换失败:", result.msg);
                }
            } catch (error) {
                logger.error("处理文件时出错:", error);
            }
        }
    }
});

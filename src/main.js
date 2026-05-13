// 运行在 Electron 主进程 下的插件入口
const { ipcMain } = require("electron");
const fs = require("fs");
const os = require('os');
const path = require("path");
const util = require('util');
const exec = util.promisify(require("child_process").exec);
const { encode, getDuration } = require("../silk-wasm");
const crypto = require("crypto");

const logger = {
    info: function (...args) {
        console.log(`[Audio-Sender]`, ...args);
    },
    warn: function (...args) {
        console.warn(`[Audio-Sender]`, ...args);
    },
    error: function (...args) {
        console.error(`[Audio-Sender]`, ...args);
    }
};

// 获取数据路径
const dataPath = LiteLoader.plugins["audio_sender"].path.data;
const pttPath = path.join(dataPath, "ptt");

module.exports.onBrowserWindowCreated = (window) => {
    // 创建数据文件夹
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }
    // 在数据文件夹中创建语音临时文件目录
    if (!fs.existsSync(pttPath)) {
        fs.mkdirSync(pttPath, { recursive: true });
    }
};

// 获取文件头信息
function getFileHeader(filePath) {
    const bytesToRead = 7;
    try {
        const buffer = fs.readFileSync(filePath, {
            encoding: null,
            flag: "r",
            length: bytesToRead,
        });
        const fileHeader = buffer.toString("hex", 0, bytesToRead);
        return fileHeader;
    } catch (err) {
        logger.error("读取文件错误:", err);
        return;
    }
}

// 转换音频为 Silk 格式
ipcMain.handle("LiteLoader.audio_sender.getSilk", async (event, filePath) => {
    try {
        const fileName = `${path.basename(filePath)}.silk`;

        // 读取文件并计算 MD5
        const fileBuffer = fs.readFileSync(filePath);
        const hash = crypto.createHash('md5').update(fileBuffer);
        const fileMd5 = hash.digest('hex');

        // 检查是否已经是 Silk 格式
        if (getFileHeader(filePath) === "02232153494c4b") {
            const duration = getDuration(fileBuffer);
            return {
                path: filePath,
                duration: duration,
                fileMd5: fileMd5,
            };
        }

        // 编码为 Silk 格式
        const silk = await encode(fileBuffer, 24000);
        const silkPath = path.join(pttPath, fileName);
        fs.writeFileSync(silkPath, silk.data);

        return {
            path: silkPath,
            duration: silk.duration,
            fileMd5: fileMd5,
        };
    } catch (error) {
        logger.error("getSilk error:", error);
        return { res: "error", msg: error.message || String(error) };
    }
});

// 转换本地文件格式并保存到数据目录下
ipcMain.handle(
    'LiteLoader.audio_sender.convertAndSaveFile',
    async (event, filePath) => {
        try {
            const fileName = path.basename(filePath);
            const ext = path.extname(filePath).toLowerCase();

            // 如果是 silk 格式，直接返回原文件路径
            if (ext === ".silk") {
                return { res: "success", file: filePath, origin: filePath };
            }

            // 使用 ffmpeg 转换为 WAV 格式
            const fileNewPath = path.join(dataPath, `${fileName}.wav`);
            const ffmpegCmd = `ffmpeg -y -i "${filePath}" -acodec pcm_s16le -f s16le -ac 1 -ar 24000 "${fileNewPath}" -loglevel error`;

            try {
                const { stderr } = await exec(ffmpegCmd);
                if (stderr) {
                    logger.error("FFmpeg stderr:", stderr);
                    return { res: "error", msg: `FFmpeg conversion error: ${stderr}` };
                }
            } catch (error) {
                logger.error("FFmpeg execution error:", error);
                return { res: "error", msg: `FFmpeg execution failed: ${error.message}` };
            }

            // 检查转换后的文件是否存在
            if (!fs.existsSync(fileNewPath)) {
                return { res: "error", msg: "Converted file not found" };
            }

            return { res: "success", file: fileNewPath, origin: filePath };
        } catch (error) {
            logger.error("convertAndSaveFile error:", error);
            return { res: "error", msg: error.message || String(error) };
        }
    }
);

// 复制文件到缓存目录
ipcMain.handle('LiteLoader.audio_sender.copyFileToCache', async (event, oldPath, newPath) => {
    try {
        // 获取目标文件路径中的目录部分
        const dir = path.dirname(newPath);
        // 如果目录不存在，就创建它
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // 复制文件
        fs.copyFileSync(oldPath, newPath);
        return { res: "success", path: newPath };
    } catch (error) {
        logger.error(error);
        return { res: "error", msg: error };
    }
});

// 返回窗口id
ipcMain.on("LiteLoader.audio_sender.getWebContentId", (event) => {
    logger.info("获取窗口id", event.sender.id.toString());
    event.returnValue = event.sender.id.toString();
});

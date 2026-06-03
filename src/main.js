// 运行在 Electron 主进程 下的插件入口
const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const util = require('util');
const execFile = util.promisify(require("child_process").execFile);
const { encode, getDuration } = require("../silk-wasm");
const crypto = require("crypto");

const logger = {
    info: (...args) => console.log(`[Audio-Sender]`, ...args),
    warn: (...args) => console.warn(`[Audio-Sender]`, ...args),
    error: (...args) => console.error(`[Audio-Sender]`, ...args),
};

let ffmpegAvailable = true;
let ffmpegChecked = false;

/**
 * 检测 ffmpeg 是否可用。
 * 只在首次调用时执行检测，后续调用直接跳过。
 */
async function checkFfmpegAvailability() {
    if (ffmpegChecked) return;
    ffmpegChecked = true;
    try {
        await execFile("ffmpeg", ["-version"]);
        ffmpegAvailable = true;
    } catch {
        ffmpegAvailable = false;
        logger.warn("未检测到 ffmpeg，非 silk 格式的音频文件将无法转换。请将 ffmpeg 添加至环境变量。");
    }
}

// 获取数据路径
const dataPath = LiteLoader.plugins["audio_sender"].path.data;
const pttPath = path.join(dataPath, "ptt");

// 临时文件最大保留时间（1 小时）
const TEMP_FILE_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * 获取 silk 临时文件的完整路径。
 *
 * @param { string } fileName 文件名。
 * @returns { string } 临时文件的完整路径。
 */
function getSilkTempPath(fileName) {
    return path.join(pttPath, fileName);
}

/**
 * 清理过期的临时文件。
 * 在插件启动时调用，移除上次运行遗留的旧文件。
 *
 * @param { string } dir 要扫描的目录。
 * @param { number } maxAgeMs 文件最大保留时间（毫秒）。
 */
async function cleanupOldTempFiles(dir, maxAgeMs) {
    try {
        const now = Date.now();
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const filePath = path.join(dir, entry.name);
            try {
                const stat = await fs.promises.stat(filePath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    await fs.promises.unlink(filePath);
                    logger.info("已清理过期临时文件:", entry.name);
                }
            } catch {
                // 忽略单个文件的清理错误
            }
        }
    } catch (err) {
        logger.warn("清理临时文件目录失败:", err);
    }
}

module.exports.onBrowserWindowCreated = (window) => {
    // 创建数据文件夹
    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
    }
    // 在数据文件夹中创建语音临时文件目录
    if (!fs.existsSync(pttPath)) {
        fs.mkdirSync(pttPath, { recursive: true });
    }
    // 启动时清理过期临时文件
    cleanupOldTempFiles(pttPath, TEMP_FILE_MAX_AGE_MS);
    // 检测 ffmpeg 可用性
    checkFfmpegAvailability();
};

// 获取文件头信息
async function getFileHeader(filePath) {
    const bytesToRead = 7;
    try {
        const fh = await fs.promises.open(filePath, 'r');
        try {
            const { buffer } = await fh.read(Buffer.alloc(bytesToRead), 0, bytesToRead, 0);
            return buffer.toString("hex", 0, bytesToRead);
        } finally {
            await fh.close();
        }
    } catch (err) {
        logger.error("读取文件错误:", err);
        return;
    }
}

// 转换音频为 Silk 格式
ipcMain.handle("LiteLoader.audio_sender.getSilk", async (event, filePath) => {
    try {
        if (!filePath || typeof filePath !== 'string') {
            return { res: "error", msg: "文件路径无效" };
        }

        const fileName = `${path.basename(filePath)}.silk`;

        // 先检查文件头，判断是否已经是 Silk 格式（避免不必要地读取整个文件）
        const header = await getFileHeader(filePath);
        const isSilk = header === "02232153494c4b";

        // 读取文件
        const fileBuffer = await fs.promises.readFile(filePath);

        if (isSilk) {
            // Silk 文件：MD5 基于原始文件内容
            const fileMd5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
            const duration = getDuration(fileBuffer);
            return {
                res: "success",
                path: filePath,
                duration: duration,
                fileMd5: fileMd5,
            };
        }

        // 编码为 Silk 格式
        const silk = await encode(fileBuffer, 24000);
        const silkPath = getSilkTempPath(fileName);
        await fs.promises.writeFile(silkPath, silk.data);

        // 非 Silk 文件：MD5 基于编码后的 silk 数据（与写入缓存的文件一致）
        const fileMd5 = crypto.createHash('md5').update(silk.data).digest('hex');

        return {
            res: "success",
            path: silkPath,
            duration: silk.duration,
            fileMd5: fileMd5,
        };
    } catch (error) {
        logger.error("getSilk error:", error);
        return { res: "error", msg: error.message || String(error) };
    }
});

// 转换本地文件格式并保存到临时目录下
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

            // 检查 ffmpeg 是否可用
            if (!ffmpegAvailable) {
                return { res: "error", msg: "未检测到 ffmpeg，无法转换非 silk 格式的音频文件。请将 ffmpeg 添加至环境变量后重启 QQ。" };
            }

            // 使用 ffmpeg 转换为 PCM 格式（临时文件写入 pttPath）
            const uniqueName = `${crypto.randomUUID()}_${fileName}.pcm`;
            const fileNewPath = path.join(pttPath, uniqueName);

            try {
                await execFile("ffmpeg", [
                    "-y", "-loglevel", "error",
                    "-i", filePath,
                    "-acodec", "pcm_s16le", "-f", "s16le",
                    "-ac", "1", "-ar", "24000",
                    fileNewPath
                ]);
            } catch (error) {
                logger.error("FFmpeg execution error:", error);
                return { res: "error", msg: `FFmpeg execution failed: ${error.message}` };
            }

            // 异步检查转换后的文件是否存在
            try {
                await fs.promises.access(fileNewPath, fs.constants.F_OK);
            } catch {
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
        // 路径安全校验：确保源文件在允许的目录下（防止读取任意文件）
        const resolvedSource = path.resolve(oldPath);
        const resolvedPttPath = path.resolve(pttPath);
        const resolvedDataPath = path.resolve(dataPath);
        if (!resolvedSource.startsWith(resolvedPttPath) && !resolvedSource.startsWith(resolvedDataPath)) {
            return { res: "error", msg: "源文件路径不在允许的目录范围内" };
        }

        // 获取目标文件路径中的目录部分
        const dir = path.dirname(newPath);
        // 如果目录不存在，就创建它
        await fs.promises.mkdir(dir, { recursive: true });
        // 复制文件
        await fs.promises.copyFile(oldPath, newPath);
        return { res: "success", path: newPath };
    } catch (error) {
        logger.error(error);
        return { res: "error", msg: error.message || String(error) };
    }
});

// 清理临时文件
ipcMain.handle("LiteLoader.audio_sender.cleanupTempFile", async (event, filePath) => {
    try {
        if (filePath && (filePath.startsWith(pttPath) || filePath.startsWith(dataPath))) {
            await fs.promises.unlink(filePath);
        }
    } catch (error) {
        logger.warn("清理临时文件失败:", error);
    }
});

// 返回窗口id
ipcMain.on("LiteLoader.audio_sender.getWebContentId", (event) => {
    logger.info("获取窗口id", event.sender.id.toString());
    event.returnValue = event.sender.id.toString();
});

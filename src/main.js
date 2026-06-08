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

// 支持的音频文件扩展名（与 renderer.js 保持一致）
const AUDIO_EXTENSIONS = new Set([
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.silk',
    '.opus', '.amr', '.ape', '.alac', '.pcm'
]);

// ffmpeg 超时时间（5 分钟）
const FFMPEG_TIMEOUT_MS = 5 * 60 * 1000;

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

/**
 * 校验文件路径的安全性和有效性。
 *
 * @param { string } filePath 要校验的文件路径。
 * @param { Object } [options] 可选配置。
 * @param { boolean } [options.checkExtension=true] 是否检查文件扩展名。
 * @returns { Promise<{ valid: boolean, msg?: string }>} 校验结果。
 */
async function validateFilePath(filePath, options = {}) {
    const { checkExtension = true } = options;

    if (!filePath || typeof filePath !== 'string') {
        return { valid: false, msg: "文件路径无效" };
    }

    // 检查路径中是否包含空字节（防止路径注入）
    if (filePath.includes('\0')) {
        return { valid: false, msg: "文件路径包含非法字符" };
    }

    // 解析为绝对路径
    const resolvedPath = path.resolve(filePath);

    try {
        const stat = await fs.promises.lstat(resolvedPath);
        if (stat.isSymbolicLink()) {
            return { valid: false, msg: "不支持符号链接" };
        }
        if (!stat.isFile()) {
            return { valid: false, msg: "路径不是一个文件" };
        }
        // 限制文件大小不超过 500MB
        if (stat.size > 500 * 1024 * 1024) {
            return { valid: false, msg: "文件过大，不支持超过 500MB 的文件" };
        }
    } catch {
        return { valid: false, msg: "文件不存在或无法访问" };
    }

    // 检查文件扩展名
    if (checkExtension) {
        const ext = path.extname(resolvedPath).toLowerCase();
        if (!AUDIO_EXTENSIONS.has(ext)) {
            return { valid: false, msg: `不支持的文件格式: ${ext || '(无扩展名)'}` };
        }
    }

    return { valid: true };
}

// 获取数据路径
const dataPath = LiteLoader.plugins["audio_sender"].path.data;
const pttPath = path.join(dataPath, "ptt");

// 临时文件最大保留时间（1 小时）
const TEMP_FILE_MAX_AGE_MS = 60 * 60 * 1000;
// 定期清理间隔（30 分钟）
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
let cleanupIntervalId = null;

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

module.exports.onBrowserWindowCreated = async (window) => {
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
    // 定期清理过期临时文件（每 30 分钟一次，防止长时间运行积累文件）
    if (!cleanupIntervalId) {
        cleanupIntervalId = setInterval(() => cleanupOldTempFiles(pttPath, TEMP_FILE_MAX_AGE_MS), CLEANUP_INTERVAL_MS);
    }
    // 检测 ffmpeg 可用性
    await checkFfmpegAvailability();
};

// 获取文件头信息（用于 Silk 格式检测）
async function getFileHeader(filePath) {
    const bytesToRead = 10;
    try {
        const fh = await fs.promises.open(filePath, 'r');
        try {
            const { buffer } = await fh.read(Buffer.alloc(bytesToRead), 0, bytesToRead, 0);
            return buffer.toString("hex", 0, bytesToRead);
        } finally {
            await fh.close();
        }
    } catch (err) {
        logger.error("读取文件头错误:", err);
        return;
    }
}

// 转换音频为 Silk 格式
ipcMain.handle("LiteLoader.audio_sender.getSilk", async (event, filePath) => {
    let silkTempPath = null;
    try {
        // 路径校验
        const validation = await validateFilePath(filePath);
        if (!validation.valid) {
            return { res: "error", msg: validation.msg };
        }

        const resolvedPath = path.resolve(filePath);
        const fileName = `${path.basename(resolvedPath)}.silk`;

        // 先检查文件头，判断是否已经是 Silk 格式（避免不必要地读取整个文件）
        const header = await getFileHeader(resolvedPath);
        // Silk V3 文件头: 02 23 21 53 49 4c 4b 5f 56 33 (即 \x02#!SILK_V3)
        const isSilk = header !== undefined && header.startsWith("02232153494c4b");

        if (isSilk) {
            // Silk 文件：只读取一次，同时用于 MD5 计算和时长获取
            const fileBuffer = await fs.promises.readFile(resolvedPath);
            const fileMd5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
            const duration = getDuration(fileBuffer);
            return {
                res: "success",
                path: resolvedPath,
                duration: duration,
                fileMd5: fileMd5,
            };
        }

        // 非 Silk 文件：需要完整读取以进行编码
        const fileBuffer = await fs.promises.readFile(resolvedPath);

        // 编码为 Silk 格式
        const silk = await encode(fileBuffer, 24000);
        const silkPath = getSilkTempPath(fileName);
        silkTempPath = silkPath;
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
        logger.error("Silk 编码错误:", error);
        // 清理编码过程中可能产生的临时文件
        if (silkTempPath) {
            await fs.promises.unlink(silkTempPath).catch(() => {});
        }
        return { res: "error", msg: error.message || String(error) };
    }
});

// 转换本地文件格式并保存到临时目录下
ipcMain.handle(
    'LiteLoader.audio_sender.convertAndSaveFile',
    async (event, filePath) => {
        try {
            // 路径校验
            const validation = await validateFilePath(filePath);
            if (!validation.valid) {
                return { res: "error", msg: validation.msg };
            }

            const resolvedPath = path.resolve(filePath);
            const fileName = path.basename(resolvedPath);
            const ext = path.extname(resolvedPath).toLowerCase();

            // 如果是 silk 格式，直接返回原文件路径
            if (ext === ".silk") {
                return { res: "success", file: resolvedPath, origin: resolvedPath };
            }

            // 检查 ffmpeg 是否可用
            if (!ffmpegAvailable) {
                return { res: "error", msg: "未检测到 ffmpeg，无法转换非 silk 格式的音频文件。请将 ffmpeg 添加至环境变量后重启 QQ。" };
            }

            // 使用 ffmpeg 转换为 PCM 格式（临时文件写入 pttPath）
            const safeName = fileName.replace(/[^a-zA-Z0-9\-_.一-鿿]/g, '_');
            const uniqueName = `${crypto.randomUUID()}_${safeName}.pcm`;
            const fileNewPath = path.join(pttPath, uniqueName);

            try {
                await execFile("ffmpeg", [
                    "-y", "-loglevel", "error",
                    "-i", resolvedPath,
                    "-acodec", "pcm_s16le", "-f", "s16le",
                    "-ac", "1", "-ar", "24000",
                    fileNewPath
                ], { timeout: FFMPEG_TIMEOUT_MS });
            } catch (error) {
                logger.error("FFmpeg 执行错误:", error);
                // 清理超时或失败时可能产生的不完整文件
                await fs.promises.unlink(fileNewPath).catch(() => {});
                if (error.killed) {
                    return { res: "error", msg: "FFmpeg 转换超时，文件可能过大或格式不支持" };
                }
                return { res: "error", msg: `FFmpeg 执行失败: ${error.message}` };
            }

            // 异步检查转换后的文件是否存在
            try {
                await fs.promises.access(fileNewPath, fs.constants.F_OK);
            } catch {
                return { res: "error", msg: "转换后的文件未生成" };
            }

            return { res: "success", file: fileNewPath, origin: resolvedPath };
        } catch (error) {
            logger.error("文件转换错误:", error);
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
        const relativeToPtt = path.relative(resolvedPttPath, resolvedSource);
        const relativeToData = path.relative(resolvedDataPath, resolvedSource);
        if (relativeToPtt.startsWith('..') && relativeToData.startsWith('..')) {
            return { res: "error", msg: "源文件路径不在允许的目录范围内" };
        }

        // 校验目标路径
        if (!newPath || typeof newPath !== 'string' || newPath.includes('\0')) {
            return { res: "error", msg: "目标路径无效" };
        }

        // 获取目标文件路径中的目录部分
        const dir = path.dirname(newPath);
        // 如果目录不存在，就创建它
        await fs.promises.mkdir(dir, { recursive: true });
        // 复制文件
        await fs.promises.copyFile(resolvedSource, newPath);
        return { res: "success", path: newPath };
    } catch (error) {
        logger.error("复制文件到缓存失败:", error);
        return { res: "error", msg: error.message || String(error) };
    }
});

// 清理临时文件
ipcMain.handle("LiteLoader.audio_sender.cleanupTempFile", async (event, filePath) => {
    try {
        if (!filePath || typeof filePath !== 'string' || filePath.includes('\0')) return;

        const resolved = path.resolve(filePath);
        const resolvedPttPath = path.resolve(pttPath);
        const resolvedDataPath = path.resolve(dataPath);
        const relativeToPtt = path.relative(resolvedPttPath, resolved);
        const relativeToData = path.relative(resolvedDataPath, resolved);

        if (!relativeToPtt.startsWith('..') || !relativeToData.startsWith('..')) {
            const stat = await fs.promises.stat(resolved);
            if (stat.isFile()) {
                await fs.promises.unlink(resolved);
            }
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

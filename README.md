<h1 align="center">LiteLoaderQQNT-Audio-Sender</h1>

---

LiteLoaderQQNT 音频发送插件

支持拖拽发送音频文件到聊天窗口。

## 安装 | Installation

### 手动安装

- 下载 整个仓库
- 将压缩包中的内容解压到[数据目录](https://github.com/mo-jinran/LiteLoaderQQNT-Plugin-Template/wiki/1.%E4%BA%86%E8%A7%A3%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84#liteloader%E7%9A%84%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95)下的 `plugins/audio_sender` 文件夹中
- 重启 `QQ` 完成安装

完成后的目录结构应该如下:

```
plugins (所有的插件目录)
└── audio_sender (此插件目录)
    ├── src/ (主要代码文件夹)
    ├── .../ (其他文件夹)
    ├── manifest.json (插件元数据)
    └── ... (其他文件)
```

## 使用 | Usage

1. **拖拽发送音频文件**：在聊天窗口中，直接将音频文件拖入聊天窗口即可发送。

## 注意事项 | Notes

- 需要将 [ffmpeg (包括 ffprobe)](https://ffmpeg.org) 添加至环境变量，用于将音频转换到 pcm 格式，便于后续编码。
- 支持的音频格式：wav、ogg、mp3、silk 等。

## 致谢 | Acknowledgment

1. 整体结构参考了[Audio-Sender插件](https://github.com/xtaw/LiteLoaderQQNT-Audio-Sender/)。
2. 格式转换参考了[LiteLoaderQQNT-TTS插件](https://github.com/lclichen/LiteLoaderQQNT-TTS/)。

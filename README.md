<h1 align="center">LiteLoaderQQNT-Audio-Sender</h1>

---

LiteLoaderQQNT 音频发送插件

支持拖拽发送音频文件到聊天窗口。

## 安装 | Installation

### 手动安装(从 Releases 中下载稳定版)

- 下载 [最新发布版本](https://github.com/lclichen/LiteLoaderQQNT-TTS/releases/latest) 中的 `audio_sender-release.zip`
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

### 使用 `LiteLoaderQQNT-PluginInstaller` 插件安装

- 根据 [README](https://github.com/xinyihl/LiteLoaderQQNT-PluginInstaller/blob/main/README.md) 安装 [LiteLoaderQQNT-PluginInstaller](https://github.com/xinyihl/LiteLoaderQQNT-PluginInstaller) 插件，然后选择以下方案之一

#### 1. 通过 `URL Schemes` 跳转 `QQ` 安装插件

- 根据 [README](https://github.com/PRO-2684/protocio/blob/main/README.md) 安装 [Protocio](https://github.com/PRO-2684/protocio) 插件，对 `URL Schemes` 进行解析
- 点击[链接](llqqnt://plugininstaller/lclichen/LiteLoaderQQNT-TTS/main/manifest.json)，完成安装
- 或者在[PluginInstaller的插件列表](https://xinyihl.github.io/LiteLoaderQQNT-PluginInstaller/)中寻找需要的插件完成安装

#### 2. 在 `PluginInstaller` 插件内安装

- 打开 `QQ` 的设置页面，切换至 `PluginInstaller` 标签页
- 输入下方链接，完成安装

```
https://github.com/lclichen/LiteLoaderQQNT-TTS/blob/main/manifest.json
```

## 使用 | Usage

1. **拖拽发送音频文件**：在聊天窗口中，直接将音频文件拖入聊天窗口即可发送。

## 注意事项 | Notes

- 需要将 [ffmpeg (包括 ffprobe)](https://ffmpeg.org) 添加至环境变量，用于将音频转换到 pcm 格式，便于后续编码。
- 支持的音频格式：wav、ogg、mp3、silk 等。

## 致谢 | Acknowledgment

1. 整体结构参考了[Audio-Sender插件](https://github.com/xtaw/LiteLoaderQQNT-Audio-Sender/)。
2. 格式转换参考了[LiteLoaderQQNT-TTS插件](https://github.com/lclichen/LiteLoaderQQNT-TTS/)。

## 交流反馈

点击链接加入群聊【TTS问题反馈与接口交流 857365160】：[https://qm.qq.com/q/jMGb3zgiHu](https://qm.qq.com/q/jMGb3zgiHu)

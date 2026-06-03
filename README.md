<h1 align="center">LiteLoaderQQNT-Audio-Sender</h1>

<p align="center">
  <strong>LiteLoaderQQNT 音频发送插件</strong><br>
  支持拖拽发送音频文件到 QQ 聊天窗口，自动转换为 Silk 格式。
</p>

---

## ✨ 特性

- 拖拽音频文件到语音输入区域即可发送
- 自动将常见音频格式转换为 QQ 兼容的 Silk 格式
- 原生 Silk 文件直接发送，无需二次转换
- 自动清理过期的临时文件（1 小时）
- 支持多文件批量拖拽发送

## 📦 手动安装

1. 下载 整个仓库
2. 解压到 LiteLoaderQQNT 的[数据目录](https://github.com/mo-jinran/LiteLoaderQQNT-Plugin-Template/wiki/1.%E4%BA%86%E8%A7%A3%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84#liteloader%E7%9A%84%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95)下的 `plugins/audio_sender` 文件夹中
3. 重启 QQ 完成安装

安装完成后的目录结构：

```
plugins/
└── audio_sender/
    ├── silk-wasm/          # Silk 编解码库
    ├── src/
    │   ├── main.js         # 主进程入口
    │   ├── preload.js      # 预加载脚本
    │   ├── renderer.js     # 渲染进程脚本
    │   └── utils/
    │       └── rendererUtils.js  # 工具类
    ├── icon.png
    └── manifest.json
```

## 🚀 使用方法

1. 打开一个聊天窗口
2. 点击输入栏上方的 **语音图标**，切换到语音发送界面
3. 将音频文件 **拖拽** 到语音输入区域即可自动发送

## ⚠️ 注意事项

- 非 Silk 格式的音频需要 [ffmpeg](https://ffmpeg.org) 支持，请确保 `ffmpeg` 已添加至系统环境变量
- Silk 文件会直接发送，无需 ffmpeg
- 临时文件自动保留在插件数据目录下，超过 1 小时后自动清理

## 🙏 致谢

1. 整体结构参考了 [LiteLoaderQQNT-Audio-Sender](https://github.com/xtaw/LiteLoaderQQNT-Audio-Sender/) 插件
2. 格式转换参考了 [LiteLoaderQQNT-TTS](https://github.com/lclichen/LiteLoaderQQNT-TTS/) 插件
3. 使用 [silk-wasm](https://github.com/idanran/silk-wasm) 进行 Silk 编解码

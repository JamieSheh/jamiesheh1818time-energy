# 发布到 GitHub Pages

这个项目已经准备好用 GitHub Actions 自动发布到 GitHub Pages。

## 方式一：用 Git 命令发布

先在 GitHub 新建一个公开仓库，例如：

```text
time-energy-companion
```

然后在这个项目文件夹运行：

```bash
git config user.name "你的名字"
git config user.email "你的 GitHub 邮箱"
git add .
git commit -m "Initial release"
git remote add origin https://github.com/你的用户名/time-energy-companion.git
git push -u origin main
```

推送后，在 GitHub 仓库里：

1. 打开 `Settings`
2. 进入 `Pages`
3. Source 选择 `GitHub Actions`
4. 回到 `Actions`，等待 `Deploy to GitHub Pages` 跑完

跑完后会得到一个固定网址，通常长这样：

```text
https://你的用户名.github.io/time-energy-companion/
```

## 方式二：用 GitHub Desktop

1. 打开 GitHub Desktop。
2. 选择 `Add local repository`。
3. 选择这个文件夹。
4. 点击 `Publish repository`。
5. 仓库发布后，进入 GitHub 网页设置 Pages，Source 选择 `GitHub Actions`。

## 使用提醒

- GitHub 仓库只放代码，不要上传你的个人备份 JSON。
- 你的记录默认保存在手机浏览器本地。
- 想换手机或避免丢失，请定期在 App 的“备份中心”导出完整备份。

import type { CommunityPost } from "./types.ts";

export const mockCommunityPosts: CommunityPost[] = [
  {
    id: "comm_00",
    slug: "community-start",
    title: "社区，也从这里开始",
    content: `社区，也从这里开始。

这里主要用来发一些短动态、折腾记录和随想。不一定要写成长文章，但又想留下来的东西，都会放在这里。`,
    contentFormat: "markdown",
    author: {
      name: "Alister",
      avatar: "/images/profile/avatar.webp",
    },
    createdAt: "2026-10-06T15:00:00Z",
    publishedAt: "2026-10-06T15:00:00Z",
    images: [],
  },
  {
    id: "comm_01",
    slug: "k230-canmv-debug",
    title: "K230 端侧模型部署与摄像头帧率踩坑记",
    content: `折腾了几天 CanMV K230 的模型部署，总结几个要点：

1. **量化精度与帧率平衡**：K230 的双核 RISC-V + KPU 架构下，INT8 量化模型吞吐表现很不错，跑 YOLOv8n 在 640x640 输入下能稳定在 28-30 FPS。
2. **DMA 内存拷贝瓶颈**：不要在 CPU 侧频繁转换图像色彩空间，尽量让 ISP 直出 RGB888 给 KPU 缓冲区。
3. **代码片段备忘**：
\`\`\`python
import nncase_runtime as nn
# 加载 kmodel 并绑定内存
kpu = nn.kpu()
kpu.load_kmodel("/sdcard/models/yolov8n.kmodel")
\`\`\`

总体来说性价比很高，接下来打算接上小车底盘做实车测试。`,
    contentFormat: "markdown",
    author: {
      name: "Alister",
      avatar: "/images/profile/avatar.webp",
    },
    createdAt: "2026-10-06T14:30:00Z",
    publishedAt: "2026-10-06T14:30:00Z",
    images: [
      {
        url: "/images/moments/scenery/scene-1.webp",
        alt: "K230 开发板调试环境",
      },
      {
        url: "/images/moments/scenery/scene-2.webp",
        alt: "模型推理输出",
      },
    ],
  },
  {
    id: "comm_02",
    slug: "ros2-nav2-simulation",
    title: "ROS2 Nav2 仿真局部路径规划避障测试",
    content: `在 Gazebo 里跑 Nav2 仿真，测试了 DWB Local Planner 和 TEB 的动态避障表现。

- **DWB 调参心得**：\`PathAlign\` 和 \`GoalDist\` 的权重需要精细平衡，否则小车容易在窄通道里迟疑。
- **Costmap 更新频率**：局部 costmap 设为 10Hz 时激光雷达点云同步最平滑。
- 记录了 4 张测试截图，后续实车验证再对比差异。`,
    contentFormat: "markdown",
    author: {
      name: "Alister",
      avatar: "/images/profile/avatar.webp",
    },
    createdAt: "2026-10-05T18:15:00Z",
    publishedAt: "2026-10-05T18:15:00Z",
    images: [
      {
        url: "/images/moments/scenery/scene-3.webp",
        alt: "Gazebo 仿真地图",
      },
      {
        url: "/images/moments/scenery/scene-4.webp",
        alt: "Nav2 局部路径规划",
      },
      {
        url: "/images/moments/night/window-sun.webp",
        alt: "动态障碍物避让",
      },
      {
        url: "/images/moments/girls-roll/roll-1.webp",
        alt: "目标点到达精度",
      },
    ],
  },
  {
    id: "comm_03",
    slug: "anime-review-girls-band-cry",
    title: "《Girls Band Cry》重温小记",
    content: `又把第 8 集和第 11 集看了一遍，桃香和仁菜的冲突与和解依然很击中人心。

> 「即便迷茫，也要发出自己的声音。」

3D 卡通渲染的微表情表现力超出预期，吉他音轨的混音质感也很顶。`,
    contentFormat: "markdown",
    author: {
      name: "Alister",
      avatar: "/images/profile/avatar.webp",
    },
    createdAt: "2026-10-04T21:00:00Z",
    publishedAt: "2026-10-04T21:00:00Z",
    images: [
      {
        url: "/images/moments/girls-roll/roll-2.webp",
        alt: "Girls Band Cry 剧照",
      },
    ],
  },
  {
    id: "comm_04",
    slug: "weekly-random-thoughts",
    title: "日常碎碎念与代码整理",
    content: `今天整理了一遍博客的代码和自动化脚本，把很多边缘细节顺平了。

有时候写代码就像打扫房间，哪怕别人看不见抽屉里面的整理，自己看着清爽整洁也会很开心。喝杯咖啡，继续搬砖 ☕`,
    contentFormat: "markdown",
    author: {
      name: "Alister",
      avatar: "/images/profile/avatar.webp",
    },
    createdAt: "2026-10-03T16:20:00Z",
    publishedAt: "2026-10-03T16:20:00Z",
    images: [],
  },
];

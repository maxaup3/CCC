import React, { useMemo, useState } from 'react';
import { useTheme, isLightTheme } from '../contexts/ThemeContext';

// 星座数据 - 使用归一化坐标 (0-100)，便于自适应缩放
// 每个星座的 lines 和 stars 坐标都是相对于 100x100 的基准尺寸
const constellations = [
  // ===== 12星座 =====
  {
    name: 'aries', // 白羊座 ♈
    lines: [
      [20, 50, 40, 30], [40, 30, 60, 20], [60, 20, 80, 30], [80, 30, 70, 50],
    ],
    stars: [[20, 50, 2.5], [40, 30, 2], [60, 20, 3], [80, 30, 2], [70, 50, 2.5]],
  },
  {
    name: 'taurus', // 金牛座 ♉
    lines: [
      [10, 40, 30, 35], [30, 35, 50, 40], [50, 40, 70, 30], [70, 30, 90, 35],
      [50, 40, 50, 60], [50, 60, 30, 80], [50, 60, 70, 80],
    ],
    stars: [[10, 40, 2], [30, 35, 2.5], [50, 40, 3], [70, 30, 2], [90, 35, 2.5], [50, 60, 2], [30, 80, 2], [70, 80, 2]],
  },
  {
    name: 'gemini', // 双子座 ♊
    lines: [
      [20, 20, 20, 80], [80, 20, 80, 80], // 两条竖线
      [20, 30, 80, 30], [20, 70, 80, 70], // 两条横线连接
    ],
    stars: [[20, 20, 3], [20, 50, 2], [20, 80, 2.5], [80, 20, 3], [80, 50, 2], [80, 80, 2.5]],
  },
  {
    name: 'cancer', // 巨蟹座 ♋
    lines: [
      [30, 30, 50, 50], [50, 50, 70, 30], [50, 50, 30, 70], [50, 50, 70, 70],
    ],
    stars: [[30, 30, 2.5], [70, 30, 2.5], [50, 50, 3], [30, 70, 2], [70, 70, 2]],
  },
  {
    name: 'leo', // 狮子座 ♌
    lines: [
      [10, 60, 30, 40], [30, 40, 50, 45], [50, 45, 70, 30],
      [70, 30, 85, 40], [85, 40, 90, 60], [90, 60, 75, 80],
    ],
    stars: [[10, 60, 2], [30, 40, 2.5], [50, 45, 2], [70, 30, 3], [85, 40, 2], [90, 60, 2.5], [75, 80, 2]],
  },
  {
    name: 'virgo', // 处女座 ♍
    lines: [
      [20, 20, 40, 40], [40, 40, 60, 30], [60, 30, 80, 40],
      [40, 40, 40, 70], [40, 70, 20, 90], [40, 70, 60, 90],
    ],
    stars: [[20, 20, 2.5], [40, 40, 3], [60, 30, 2], [80, 40, 2.5], [40, 70, 2], [20, 90, 2], [60, 90, 2]],
  },
  {
    name: 'libra', // 天秤座 ♎
    lines: [
      [20, 50, 80, 50], // 横梁
      [50, 50, 50, 30], // 支点
      [20, 50, 20, 70], [80, 50, 80, 70], // 两边垂下
    ],
    stars: [[20, 50, 2.5], [50, 50, 2], [80, 50, 2.5], [50, 30, 3], [20, 70, 2], [80, 70, 2]],
  },
  {
    name: 'scorpio', // 天蝎座 ♏
    lines: [
      [10, 40, 25, 50], [25, 50, 40, 45], [40, 45, 55, 55], [55, 55, 70, 50],
      [70, 50, 85, 60], [85, 60, 95, 45], // 尾巴翘起
    ],
    stars: [[10, 40, 2.5], [25, 50, 2], [40, 45, 2], [55, 55, 3], [70, 50, 2], [85, 60, 2.5], [95, 45, 2]],
  },
  {
    name: 'sagittarius', // 射手座 ♐
    lines: [
      [20, 70, 50, 50], [50, 50, 80, 30], // 箭身
      [80, 30, 70, 20], [80, 30, 90, 20], // 箭头
      [35, 60, 35, 80], [35, 60, 20, 50], // 弓
    ],
    stars: [[20, 70, 2], [50, 50, 3], [80, 30, 2.5], [70, 20, 2], [90, 20, 2], [35, 80, 2], [20, 50, 2]],
  },
  {
    name: 'capricorn', // 摩羯座 ♑
    lines: [
      [15, 30, 35, 25], [35, 25, 55, 35], [55, 35, 70, 25],
      [55, 35, 55, 60], [55, 60, 75, 75], [75, 75, 90, 65],
    ],
    stars: [[15, 30, 2], [35, 25, 2.5], [55, 35, 3], [70, 25, 2], [55, 60, 2], [75, 75, 2.5], [90, 65, 2]],
  },
  {
    name: 'aquarius', // 水瓶座 ♒
    lines: [
      [10, 35, 30, 30], [30, 30, 50, 35], [50, 35, 70, 30], [70, 30, 90, 35], // 上波浪
      [10, 55, 30, 50], [30, 50, 50, 55], [50, 55, 70, 50], [70, 50, 90, 55], // 下波浪
    ],
    stars: [[10, 35, 2], [30, 30, 2.5], [50, 35, 2], [70, 30, 2.5], [90, 35, 2], [10, 55, 2], [50, 55, 3], [90, 55, 2]],
  },
  {
    name: 'pisces', // 双鱼座 ♓
    lines: [
      [20, 30, 35, 40], [35, 40, 20, 50], // 上鱼
      [80, 50, 65, 60], [65, 60, 80, 70], // 下鱼
      [35, 40, 50, 50], [50, 50, 65, 60], // 连接线
    ],
    stars: [[20, 30, 2.5], [35, 40, 2], [20, 50, 2], [80, 50, 2], [65, 60, 3], [80, 70, 2.5], [50, 50, 2]],
  },
  // ===== 其他著名星座 =====
  {
    name: 'ursa-major', // 大熊座（北斗七星）
    lines: [
      [5, 70, 25, 60], [25, 60, 40, 70], [40, 70, 55, 50],
      [55, 50, 70, 35], [70, 35, 85, 20], [85, 20, 95, 5],
    ],
    stars: [[5, 70, 2.5], [25, 60, 2], [40, 70, 2], [55, 50, 2.5], [70, 35, 2], [85, 20, 2], [95, 5, 2.5]],
  },
  {
    name: 'orion', // 猎户座
    lines: [
      [40, 10, 60, 10], // 肩膀
      [40, 10, 30, 40], [60, 10, 70, 40], // 身体
      [25, 50, 45, 50], [45, 50, 65, 50], // 腰带
      [30, 40, 15, 90], [70, 40, 85, 90], // 腿
    ],
    stars: [[40, 10, 2.5], [60, 10, 2], [30, 40, 2], [70, 40, 2], [25, 50, 2], [45, 50, 3], [65, 50, 2], [15, 90, 2], [85, 90, 2]],
  },
  {
    name: 'cygnus', // 天鹅座（北十字）
    lines: [
      [50, 5, 50, 50], [50, 50, 50, 95], // 竖线
      [10, 40, 50, 50], [50, 50, 90, 60], // 横线（翅膀）
    ],
    stars: [[50, 5, 2.5], [50, 50, 3], [50, 95, 2], [10, 40, 2], [90, 60, 2]],
  },
  {
    name: 'cassiopeia', // 仙后座 (W形)
    lines: [
      [10, 50, 30, 30], [30, 30, 50, 50], [50, 50, 70, 30], [70, 30, 90, 50],
    ],
    stars: [[10, 50, 2.5], [30, 30, 2], [50, 50, 3], [70, 30, 2], [90, 50, 2.5]],
  },
];

interface GeneratingOverlayProps {
  position: { x: number; y: number };
  width: number;
  height: number;
  progress: number;
  taskId: string;
  elapsedTime?: number;
  estimatedTime?: number;
}

const GeneratingOverlay: React.FC<GeneratingOverlayProps> = ({
  position,
  width,
  height,
  progress,
  elapsedTime = 0,
  estimatedTime = 0,
}) => {
  const { themeStyle } = useTheme();
  const isLight = isLightTheme(themeStyle);

  // 随机选择两个星座和位置（组件挂载时确定）
  const [constellationsData] = useState(() => {
    // 随机选择两个不同的星座
    const indices = [...Array(constellations.length).keys()];
    const idx1 = Math.floor(Math.random() * indices.length);
    indices.splice(idx1, 1);
    const idx2 = Math.floor(Math.random() * indices.length);

    const constellation1 = constellations[idx1];
    const constellation2 = constellations[indices[idx2]];

    // 第一个星座位置：左上区域
    const pos1X = 5 + Math.random() * 35;
    const pos1Y = 5 + Math.random() * 35;

    // 第二个星座位置：右下区域（避免重叠）
    const pos2X = 50 + Math.random() * 35;
    const pos2Y = 45 + Math.random() * 35;

    // 预生成星座星星的动画参数
    const addStarAnimations = (constellation: typeof constellation1) => ({
      ...constellation,
      stars: constellation.stars.map(([x, y, size]) => ({
        x, y, size,
        duration: 3 + Math.random() * 3, // 3-6秒
        delay: Math.random() * 3, // 0-3秒延迟
      })),
    });

    return [
      { constellation: addStarAnimations(constellation1), posX: pos1X, posY: pos1Y },
      { constellation: addStarAnimations(constellation2), posX: pos2X, posY: pos2Y },
    ];
  });

  // 随机生成星星位置 - 使用更大的网格和更多随机性
  const randomStars = useMemo(() => {
    const stars: Array<{ left: number; top: number; size: number; duration: number; delay: number }> = [];
    // 使用 5x4 网格，每个格子有 60% 几率放一颗星星，增加随机感
    const cols = 5;
    const rows = 4;
    const cellWidth = 90 / cols;  // 每个格子宽度（覆盖 5%-95%）
    const cellHeight = 85 / rows; // 每个格子高度（覆盖 5%-90%）

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // 60% 几率在这个格子放星星，增加不规则感
        if (Math.random() > 0.4) {
          stars.push({
            left: 5 + col * cellWidth + Math.random() * cellWidth,
            top: 5 + row * cellHeight + Math.random() * cellHeight,
            size: Math.random() > 0.7 ? 3 : 2,
            duration: 3 + Math.random() * 3, // 3-6秒闪烁
            delay: Math.random() * 3, // 0-3秒延迟
          });
        }
      }
    }
    return stars;
  }, []);

  // 格式化时间
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  // 计算剩余时间
  const remainingTime = useMemo(() => {
    if (!estimatedTime) return null;
    const remaining = estimatedTime * (1 - progress / 100);
    return remaining > 0 ? remaining : 0;
  }, [estimatedTime, progress]);

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x - width / 2,
        top: position.y - height / 2,
        width: width,
        height: height,
        background: isLight
          ? 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(20, 20, 35, 0.95) 100%)'
          : 'linear-gradient(135deg, rgba(13, 13, 20, 0.95) 0%, rgba(8, 8, 15, 0.95) 100%)',
        borderRadius: 0,
        overflow: 'hidden',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: '32px 40px',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* 百分比 + 剩余时间 */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.8)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{Math.round(progress)}%</span>
        {remainingTime !== null && estimatedTime > 0 && remainingTime > 0 && (
          <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ fontWeight: 400, opacity: 0.7 }}>剩余 {formatTime(remainingTime)}</span>
          </>
        )}
      </div>

      {/* 进度条 */}
      <div
        style={{
          width: '100%',
          maxWidth: 320,
          height: 6,
          background: isLight
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(255, 255, 255, 0.08)',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 进度条填充 */}
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: isLight
              ? 'linear-gradient(90deg, rgba(200, 200, 255, 0.8) 0%, rgba(255, 255, 255, 0.9) 100%)'
              : 'linear-gradient(90deg, rgba(150, 150, 255, 0.85) 0%, rgba(255, 255, 255, 0.8) 100%)',
            borderRadius: 3,
            transition: 'width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            boxShadow: isLight
              ? '0 0 12px rgba(200, 200, 255, 0.4)'
              : '0 0 12px rgba(150, 150, 255, 0.5)',
          }}
        />

        {/* 进度条背景光晕 */}
        {progress < 100 && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: 40,
              background: isLight
                ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 100%)'
                : 'linear-gradient(90deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 100%)',
              filter: 'blur(1px)',
              animation: 'shimmer 2s infinite',
            }}
          />
        )}
      </div>

      {/* 星空闪烁效果 - 随机位置 */}
      {randomStars.map((star, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: star.size,
            height: star.size,
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '50%',
            left: `${star.left}%`,
            top: `${star.top}%`,
            animation: `twinkle ${star.duration}s ease-in-out infinite`,
            animationDelay: `${star.delay}s`,
            boxShadow: '0 0 3px rgba(255, 255, 255, 0.5)',
          }}
        />
      ))}

      {/* 两个星座彩蛋 - 自适应缩放，第一个完成后才开始第二个 */}
      {constellationsData.map((constellationData, constellationIndex) => {
        // 第一个星座的连线总时长 = 线条数 * 2秒
        const firstConstellationDuration = constellationsData[0].constellation.lines.length * 2;
        // 第二个星座的基础延迟 = 第一个星座完成时间
        const baseDelay = constellationIndex === 0 ? 0 : firstConstellationDuration;

        // 计算缩放比例：基于遮罩尺寸，星座占据约 50% 的空间
        const baseSize = Math.min(width, height);
        const constellationSize = baseSize * 0.5; // 星座占 50%
        const scale = constellationSize / 100; // 归一化坐标是 0-100

        return (
          <React.Fragment key={`constellation-${constellationIndex}`}>
            <svg
              style={{
                position: 'absolute',
                left: `${constellationData.posX}%`,
                top: `${constellationData.posY}%`,
                width: constellationSize,
                height: constellationSize,
                pointerEvents: 'none',
                overflow: 'visible',
              }}
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              {constellationData.constellation.lines.map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth={1 / scale}
                  style={{
                    animation: `fadeInLine 8s ease-in-out forwards`,
                    animationDelay: `${baseDelay + i * 2}s`,
                    opacity: 0,
                  }}
                />
              ))}
            </svg>
            {/* 星座星星 - 与普通星星保持一致，自适应缩放 */}
            {constellationData.constellation.stars.map((star, i) => {
              const starSize = Math.max(2, star.size * scale * 0.8);
              return (
                <div
                  key={`const-${constellationIndex}-${i}`}
                  style={{
                    position: 'absolute',
                    width: starSize,
                    height: starSize,
                    background: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '50%',
                    left: `calc(${constellationData.posX}% + ${star.x * scale}px)`,
                    top: `calc(${constellationData.posY}% + ${star.y * scale}px)`,
                    animation: `twinkle ${star.duration}s ease-in-out infinite`,
                    animationDelay: `${star.delay}s`,
                    boxShadow: '0 0 3px rgba(255, 255, 255, 0.5)',
                  }}
                />
              );
            })}
          </React.Fragment>
        );
      })}

      <style>
        {`
          @keyframes shimmer {
            0% {
              left: 0;
            }
            100% {
              left: 100%;
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 0.6;
            }
            50% {
              opacity: 1;
            }
          }
          @keyframes twinkle {
            0%, 100% {
              opacity: 0.2;
              transform: scale(1);
            }
            50% {
              opacity: 0.9;
              transform: scale(1.2);
            }
          }
          @keyframes fadeInLine {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

export default GeneratingOverlay;

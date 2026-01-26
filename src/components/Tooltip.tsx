/**
 * 通用 Tooltip 组件 - 基于 Figma 设计
 * 从 BottomDialog 中提取，可复用
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  isLight?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children, position = 'top', isLight = false }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;

      if (position === 'bottom') {
        y = rect.bottom;
      } else if (position === 'left') {
        x = rect.left;
        y = rect.top + rect.height / 2;
      } else if (position === 'right') {
        x = rect.right;
        y = rect.top + rect.height / 2;
      }

      setCoords({ x, y });
    }
    setShow(true);
  }, [position]);

  const handleMouseLeave = useCallback(() => {
    setShow(false);
  }, []);

  // 主题颜色
  const bgColor = isLight ? '#FFFFFF' : '#181818';
  const textColor = isLight ? 'rgba(0, 0, 0, 0.85)' : '#FFFFFF';
  const shadowColor = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.4)';

  // 计算位置和变换
  const positionStyles = useMemo(() => {
    const base = {
      left: position === 'left' ? coords.x - 8 : position === 'right' ? coords.x + 8 : coords.x,
      top: position === 'top' ? coords.y - 8 : position === 'bottom' ? coords.y + 8 : coords.y,
    };

    const transforms: Record<string, string> = {
      top: 'translate(-50%, -100%)',
      bottom: 'translate(-50%, 0)',
      left: 'translate(-100%, -50%)',
      right: 'translate(0, -50%)',
    };

    return {
      ...base,
      transform: transforms[position],
    };
  }, [position, coords]);

  // 箭头样式
  const arrowStyles = useMemo(() => {
    const arrowMap: Record<string, React.CSSProperties> = {
      top: {
        bottom: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `6px solid ${bgColor}`,
      },
      bottom: {
        top: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: `6px solid ${bgColor}`,
      },
      left: {
        right: -6,
        top: '50%',
        transform: 'translateY(-50%)',
        borderTop: '6px solid transparent',
        borderBottom: '6px solid transparent',
        borderLeft: `6px solid ${bgColor}`,
      },
      right: {
        left: -6,
        top: '50%',
        transform: 'translateY(-50%)',
        borderTop: '6px solid transparent',
        borderBottom: '6px solid transparent',
        borderRight: `6px solid ${bgColor}`,
      },
    };
    return arrowMap[position];
  }, [position, bgColor]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {show && createPortal(
        <div
          style={{
            position: 'fixed',
            ...positionStyles,
            background: bgColor,
            color: textColor,
            padding: '4px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 400,
            fontFamily: '"PingFang SC", -apple-system, sans-serif',
            lineHeight: '16px',
            whiteSpace: 'nowrap',
            zIndex: 9999,
            boxShadow: `0 2px 8px ${shadowColor}`,
            pointerEvents: 'none',
            animation: 'tooltipFadeIn 0.15s ease',
          }}
        >
          {text}
          {/* 箭头 */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              ...arrowStyles,
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(Tooltip);

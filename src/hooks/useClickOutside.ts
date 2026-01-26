/**
 * Click Outside Hook
 * 统一处理点击外部关闭下拉菜单的逻辑
 */
import { useEffect, RefObject } from 'react';

/**
 * 监听点击外部事件
 * @param isOpen - 是否打开状态
 * @param onClose - 关闭回调
 * @param triggerRef - 触发元素 ref
 * @param dropdownSelector - 下拉菜单选择器 (data-* 属性)
 */
export const useClickOutside = (
  isOpen: boolean,
  onClose: () => void,
  triggerRef: RefObject<HTMLElement>,
  dropdownSelector?: string
) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击了触发元素
      const clickedInTrigger = triggerRef.current?.contains(target);
      if (clickedInTrigger) return;

      // 如果有下拉菜单选择器，检查是否点击了下拉菜单
      if (dropdownSelector) {
        const dropdown = document.querySelector(dropdownSelector);
        const clickedInDropdown = dropdown?.contains(target);
        if (clickedInDropdown) return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, dropdownSelector]);
};

/**
 * 监听多个下拉菜单的点击外部事件
 */
export const useMultipleClickOutside = (
  dropdowns: Array<{
    isOpen: boolean;
    onClose: () => void;
    triggerRef: RefObject<HTMLElement>;
    selector: string;
  }>
) => {
  useEffect(() => {
    const openDropdowns = dropdowns.filter(d => d.isOpen);
    if (openDropdowns.length === 0) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      openDropdowns.forEach(({ onClose, triggerRef, selector }) => {
        const clickedInTrigger = triggerRef.current?.contains(target);
        const dropdown = document.querySelector(selector);
        const clickedInDropdown = dropdown?.contains(target);

        if (!clickedInTrigger && !clickedInDropdown) {
          onClose();
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdowns]);
};

export default useClickOutside;

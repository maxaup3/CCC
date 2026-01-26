import React, { useMemo } from 'react';
import { VideoCapability } from '../types';
import BaseDropdown, { DropdownItem } from './BaseDropdown';

interface CapabilitySelectorProps {
  selectedCapability: VideoCapability;
  onSelect: (capability: VideoCapability) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const CapabilitySelector: React.FC<CapabilitySelectorProps> = ({
  selectedCapability,
  onSelect,
  onClose,
  position,
}) => {
  const capabilities = useMemo<DropdownItem<VideoCapability>[]>(() => [
    {
      id: 'text-to-video',
      name: '文生视频',
      description: '从文本描述生成视频',
    },
    {
      id: 'image-to-video',
      name: '图生视频',
      description: '从参考图生成视频',
    },
    {
      id: 'first-last-frame',
      name: '首尾帧',
      description: '根据首尾两帧生成视频',
    },
  ], []);

  return (
    <BaseDropdown<VideoCapability>
      items={capabilities}
      selectedId={selectedCapability}
      onSelect={onSelect}
      onClose={onClose}
      position={position}
      width={200}
      dataAttribute="capability-dropdown"
    />
  );
};

export default React.memo(CapabilitySelector);

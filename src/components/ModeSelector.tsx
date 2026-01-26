import React, { useMemo } from 'react';
import { GenerationMode } from '../types';
import BaseDropdown, { DropdownItem } from './BaseDropdown';

interface ModeSelectorProps {
  selectedMode: GenerationMode;
  onSelect: (mode: GenerationMode) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onSelect,
  onClose,
  position,
}) => {
  const modes = useMemo<DropdownItem<GenerationMode>[]>(() => [
    {
      id: 'image',
      name: '图像生成',
      description: '生成静态图片',
    },
    {
      id: 'video',
      name: '视频生成',
      description: '生成动态视频',
    },
  ], []);

  return (
    <BaseDropdown<GenerationMode>
      items={modes}
      selectedId={selectedMode}
      onSelect={onSelect}
      onClose={onClose}
      position={position}
      width={180}
      dataAttribute="mode-dropdown"
    />
  );
};

export default React.memo(ModeSelector);

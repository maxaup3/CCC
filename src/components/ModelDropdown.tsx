import React, { useMemo } from 'react';
import { Model } from '../types';
import { Typography } from '../styles/constants';
import { useThemedStyles } from '../hooks/useThemedStyles';
import BaseDropdown, { DropdownItem } from './BaseDropdown';

interface ModelDropdownProps {
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const ModelDropdown: React.FC<ModelDropdownProps> = ({
  models,
  selectedModel,
  onSelect,
  onClose,
  position,
}) => {
  const { isLight } = useThemedStyles();

  // 转换 models 为 DropdownItem 格式
  const items = useMemo<DropdownItem<string>[]>(() => {
    return models.slice(0, 5).map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description || '模型一句话介绍',
      extra: model.estimatedTime ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)',
            fontFamily: Typography.englishBody.fontFamily,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {model.estimatedTime}
        </span>
      ) : undefined,
    }));
  }, [models, isLight]);

  return (
    <BaseDropdown<string>
      items={items}
      selectedId={selectedModel}
      onSelect={onSelect}
      onClose={onClose}
      position={position}
      width={240}
      dataAttribute="model-dropdown"
    />
  );
};

export default React.memo(ModelDropdown);

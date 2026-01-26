export interface ImageLayer {
  id: string;
  name: string;
  url: string;
  type?: 'image' | 'video'; // 图层类型：图片或视频
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  locked: boolean;
  selected: boolean;
  description?: string;
  tags?: string[];
  aspectRatio?: string;
  resolution?: string;
  dateAdded?: string;
  generationConfig?: GenerationConfig; // 生成该图层时使用的配置
}

export interface Comment {
  id: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  createdAt: string;
  isEditing?: boolean;
}

export type GenerationMode = 'image' | 'video';
export type VideoCapability = 'text-to-video' | 'image-to-video' | 'first-last-frame';

export interface GenerationConfig {
  mode: GenerationMode; // 生成模式：图片或视频
  model: string;
  lora?: string; // 图像模式的 Lora（已弃用，保留兼容）
  loraWeight?: number; // Lora权重，默认0.8
  imageLora?: string; // 图像模式专属 Lora（已弃用，保留兼容）
  imageLoraWeight?: number; // 图像模式 Lora 权重（已弃用，保留兼容）
  imageLoras?: { id: string; weight: number }[]; // 图像模式 Loras（最多6个）
  videoLora?: string; // 视频模式专属 Lora（已弃用，保留兼容）
  videoLoraWeight?: number; // 视频模式 Lora 权重（已弃用，保留兼容）
  videoLoras?: { id: string; weight: number }[]; // 视频模式 Loras（最多6个）
  referenceImage?: string; // 单个参考图（兼容旧代码）
  referenceImages?: string[]; // 多个参考图（图像模式，最多10张）
  aspectRatio: string;
  count: number;
  prompt: string;
  enhancePrompt?: boolean;
  audioVideoSync?: boolean; // 音画同步
  // 视频专属配置
  videoCapability?: VideoCapability; // 视频能力：文生/图生/首尾帧
  videoDuration?: number; // 视频时长（秒）：3/5/10
  videoQuality?: 'fast' | 'quality'; // 视频生成模式
  videoSound?: boolean; // 是否开启声音
  videoResolution?: string; // 视频分辨率，如 '720p', '1440p'
  videoStartFrame?: string; // 首帧图片（用于图生视频和首尾帧）
  videoEndFrame?: string; // 尾帧图片（仅用于首尾帧）
  // 批次生成信息
  batchId?: string; // 批次ID，用于标识同一批生成的图片
  batchIndex?: number; // 当前图片在批次中的索引（0-based）
  batchTotal?: number; // 批次中的总图片数
}

export interface GenerationTask {
  id: string;
  config: GenerationConfig;
  progress: number; // 0-100
  status: 'pending' | 'generating' | 'completed' | 'failed';
  position: { x: number; y: number };
  width: number;
  height: number;
  resultLayerId?: string;
  shapeId?: string; // tldraw shape ID（用于跟踪生成遮罩位置）
  createdAt: string;
  startedAt?: number; // 开始时间戳（ms）
  estimatedDuration?: number; // 预计时长（秒）
}

export type EditMode = 'normal' | 'edit';

export interface Model {
  id: string;
  name: string;
  mode?: 'image' | 'video'; // 模型适用的模式
  description?: string;
  imageUrl?: string;
  tags?: string[];
  isUser?: boolean;
  isFavorite?: boolean;
  estimatedTime?: string; // 预估生成时间，如 "30s", "1 min", "2 min"
  compatibleModels?: string[]; // Lora 兼容的模型 ID 列表（仅用于 Lora）
}


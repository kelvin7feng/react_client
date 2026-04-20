export type EditorMode = 'view' | 'crop' | 'mosaic' | 'doodle' | 'text';

export const DOODLE_COLORS = [
  '#FFFFFF',
  '#000000',
  '#FF2442',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#00C7BE',
  '#007AFF',
  '#AF52DE',
];

// 画笔大小：小 / 中 / 大 三档
export const DOODLE_SIZES = [4, 10, 18];

export const TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#FF2442',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#AF52DE',
];

// 文字大小：小/中/大 三档
export const TEXT_FONT_SIZES = [18, 26, 36];

// 文字样式：normal 纯文字、filled 色块底 + 反色文字、outlined 当前色 + 深色描边
export type TextStyleKind = 'normal' | 'filled' | 'outlined';

export const TEXT_STYLES: TextStyleKind[] = ['normal', 'filled', 'outlined'];

export type DoodlePath = {
  d: string;
  color: string;
  size: number;
};

export type TextItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  style: TextStyleKind;
};

export type CropRatio = { id: string; label: string; value: number | null };

export const CROP_RATIOS: CropRatio[] = [
  { id: 'original', label: '原图', value: null },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '9:16', label: '9:16', value: 9 / 16 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
];

export type Rect = { x: number; y: number; width: number; height: number };

export type MosaicPath = {
  d: string;
  size: number;
  mode: 'draw' | 'erase';
  // draw 笔画必带；记录绘制时的打码类型，便于后续切换 kind 时保持独立
  kind?: MosaicKind;
};

// 马赛克样式：两大类
// - pixel：基于不同像素化强度生成底图
// - text：用重复文字铺陈的"文字贴纸式"打码
export type MosaicKind =
  | 'block'
  | 'blur'
  | 'coarse'
  | 'fortune'
  | 'rich'
  | 'slim';

export type MosaicKindConfig =
  | {
      id: 'block' | 'blur' | 'coarse';
      label: string;
      type: 'pixel';
      blockCount: number;
    }
  | {
      id: 'fortune' | 'rich' | 'slim';
      label: string;
      type: 'text';
      text: string;
      // icon 按钮上显示的单字（可与 text 不同，用于区分同一首字）
      iconChar: string;
      bgColor: string;
      textColor: string;
    };

export const MOSAIC_KINDS: MosaicKindConfig[] = [
  // 像素类
  { id: 'block', label: '方块', type: 'pixel', blockCount: 28 },
  { id: 'blur', label: '模糊', type: 'pixel', blockCount: 60 },
  { id: 'coarse', label: '颗粒', type: 'pixel', blockCount: 14 },
  // 文字类：统一白底 + 不同主题色字
  {
    id: 'fortune',
    label: '发财',
    type: 'text',
    text: '发财',
    iconChar: '发',
    bgColor: '#ffffff',
    textColor: '#ff1744',
  },
  {
    id: 'rich',
    label: '暴富',
    type: 'text',
    text: '暴富',
    iconChar: '富',
    bgColor: '#ffffff',
    textColor: '#ff2d55',
  },
  {
    id: 'slim',
    label: '暴瘦',
    type: 'text',
    text: '暴瘦',
    iconChar: '瘦',
    bgColor: '#ffffff',
    textColor: '#00b894',
  },
];

// 画笔大小：小 / 中 / 大 三档
export const MOSAIC_SIZES = [14, 28, 44];

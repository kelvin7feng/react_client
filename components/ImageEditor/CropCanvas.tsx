import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Image,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  GestureResponderEvent,
  PanResponderGestureState,
  TouchableOpacity,
  Text,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImageManipulator from 'expo-image-manipulator';

import type { Rect } from './types';

type HandleMode =
  | 'tl'
  | 'tr'
  | 'bl'
  | 'br'
  | 't'
  | 'b'
  | 'l'
  | 'r'
  | 'move';

export type CropCanvasHandle = {
  apply: () => Promise<string>;
  hasChanges: () => boolean;
};

type Props = {
  uri: string;
  ratio: number | null;
  /** 用户拖动裁剪框并松手，且实际有拖动过时触发。父组件可据此即时应用裁剪。 */
  onCropEnd?: () => void;
  /** 是否显示右下方的还原按钮（图片被裁剪过时为 true）。 */
  canReset?: boolean;
  /** 点击还原按钮时触发。 */
  onReset?: () => void;
  /**
   * 是否在图片四周预留安全间距。
   * 首次进入裁剪模式时不需要，实际裁剪后再开启，便于拖动边/角手柄。
   */
  padded?: boolean;
};

const MIN_SIZE = 60;
const HANDLE_TOUCH = 28;
/** 图片/裁剪框与编辑区边缘预留的间距，便于拖动边角手柄。 */
const CANVAS_PADDING = 20;

const CropCanvas = forwardRef<CropCanvasHandle, Props>((
  { uri, ratio, onCropEnd, canReset, onReset, padded = false },
  ref
) => {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [container, setContainer] = useState<{ w: number; h: number } | null>(
    null
  );
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  const cropRef = useRef<Rect>(crop);
  const startRef = useRef<Rect>(crop);
  const modeRef = useRef<HandleMode>('move');
  const imgBoxRef = useRef<Rect | null>(null);
  const movedRef = useRef(false);
  const onCropEndRef = useRef<typeof onCropEnd>(undefined);
  useEffect(() => {
    onCropEndRef.current = onCropEnd;
  }, [onCropEnd]);

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => setImgSize({ w, h }),
      () => setImgSize({ w: 1, h: 1 })
    );
  }, [uri]);

  const imgBox: Rect | null = useMemo(() => {
    if (!imgSize || !container) return null;
    // padded=true 时给图片四周预留 CANVAS_PADDING，便于拖动边/角手柄；
    // padded=false（初次进入裁剪）时贴边显示，最大化利用编辑区。
    const pad = padded ? CANVAS_PADDING : 0;
    const availW = Math.max(1, container.w - pad * 2);
    const availH = Math.max(1, container.h - pad * 2);
    const scale = Math.min(availW / imgSize.w, availH / imgSize.h);
    const w = imgSize.w * scale;
    const h = imgSize.h * scale;
    const box = {
      x: (container.w - w) / 2,
      y: (container.h - h) / 2,
      width: w,
      height: h,
    };
    imgBoxRef.current = box;
    return box;
  }, [imgSize, container, padded]);

  useEffect(() => {
    if (!imgBox) return;
    if (ratio === null) {
      setCrop({ ...imgBox });
      return;
    }
    const boxRatio = imgBox.width / imgBox.height;
    let w: number;
    let h: number;
    if (ratio >= boxRatio) {
      w = imgBox.width;
      h = w / ratio;
    } else {
      h = imgBox.height;
      w = h * ratio;
    }
    setCrop({
      x: imgBox.x + (imgBox.width - w) / 2,
      y: imgBox.y + (imgBox.height - h) / 2,
      width: w,
      height: h,
    });
  }, [ratio, imgBox]);

  const detectMode = (lx: number, ly: number): HandleMode => {
    const c = cropRef.current;
    const nearLeft = Math.abs(lx - c.x) <= HANDLE_TOUCH;
    const nearRight = Math.abs(lx - (c.x + c.width)) <= HANDLE_TOUCH;
    const nearTop = Math.abs(ly - c.y) <= HANDLE_TOUCH;
    const nearBottom = Math.abs(ly - (c.y + c.height)) <= HANDLE_TOUCH;
    if (nearTop && nearLeft) return 'tl';
    if (nearTop && nearRight) return 'tr';
    if (nearBottom && nearLeft) return 'bl';
    if (nearBottom && nearRight) return 'br';
    if (nearTop && lx >= c.x && lx <= c.x + c.width) return 't';
    if (nearBottom && lx >= c.x && lx <= c.x + c.width) return 'b';
    if (nearLeft && ly >= c.y && ly <= c.y + c.height) return 'l';
    if (nearRight && ly >= c.y && ly <= c.y + c.height) return 'r';
    return 'move';
  };

  const clampToImage = (r: Rect): Rect => {
    const ib = imgBoxRef.current;
    if (!ib) return r;
    let { x, y, width, height } = r;
    if (width < MIN_SIZE) width = MIN_SIZE;
    if (height < MIN_SIZE) height = MIN_SIZE;
    if (width > ib.width) width = ib.width;
    if (height > ib.height) height = ib.height;
    if (x < ib.x) x = ib.x;
    if (y < ib.y) y = ib.y;
    if (x + width > ib.x + ib.width) x = ib.x + ib.width - width;
    if (y + height > ib.y + ib.height) y = ib.y + ib.height - height;
    return { x, y, width, height };
  };

  const applyResize = (dx: number, dy: number): Rect => {
    const s = startRef.current;
    const ib = imgBoxRef.current;
    if (!ib) return s;
    const m = modeRef.current;

    if (m === 'move') {
      return clampToImage({ ...s, x: s.x + dx, y: s.y + dy });
    }

    if (ratio !== null) {
      const corner = m === 'tl' || m === 'tr' || m === 'bl' || m === 'br';
      if (corner) {
        const signX = m === 'tr' || m === 'br' ? 1 : -1;
        const signY = m === 'bl' || m === 'br' ? 1 : -1;
        let newW = s.width + signX * dx;
        let newH = newW / ratio;
        if (newH < MIN_SIZE) {
          newH = MIN_SIZE;
          newW = newH * ratio;
        }
        if (newW < MIN_SIZE) {
          newW = MIN_SIZE;
          newH = newW / ratio;
        }
        let newX = s.x;
        let newY = s.y;
        if (signX < 0) newX = s.x + s.width - newW;
        if (signY < 0) newY = s.y + s.height - newH;
        return clampToImage({ x: newX, y: newY, width: newW, height: newH });
      }
      const signH = m === 'l' ? -1 : m === 'r' ? 1 : 0;
      const signV = m === 't' ? -1 : m === 'b' ? 1 : 0;
      if (signH !== 0) {
        let newW = s.width + signH * dx;
        if (newW < MIN_SIZE) newW = MIN_SIZE;
        const newH = newW / ratio;
        const newX = signH < 0 ? s.x + s.width - newW : s.x;
        const newY = s.y + (s.height - newH) / 2;
        return clampToImage({ x: newX, y: newY, width: newW, height: newH });
      }
      let newH = s.height + signV * dy;
      if (newH < MIN_SIZE) newH = MIN_SIZE;
      const newW = newH * ratio;
      const newX = s.x + (s.width - newW) / 2;
      const newY = signV < 0 ? s.y + s.height - newH : s.y;
      return clampToImage({ x: newX, y: newY, width: newW, height: newH });
    }

    let nx = s.x;
    let ny = s.y;
    let nw = s.width;
    let nh = s.height;
    if (m === 'tl' || m === 'l' || m === 'bl') {
      nx = s.x + dx;
      nw = s.width - dx;
    }
    if (m === 'tr' || m === 'r' || m === 'br') {
      nw = s.width + dx;
    }
    if (m === 'tl' || m === 't' || m === 'tr') {
      ny = s.y + dy;
      nh = s.height - dy;
    }
    if (m === 'bl' || m === 'b' || m === 'br') {
      nh = s.height + dy;
    }
    if (nw < MIN_SIZE) {
      if (m === 'tl' || m === 'l' || m === 'bl') nx = s.x + s.width - MIN_SIZE;
      nw = MIN_SIZE;
    }
    if (nh < MIN_SIZE) {
      if (m === 'tl' || m === 't' || m === 'tr') ny = s.y + s.height - MIN_SIZE;
      nh = MIN_SIZE;
    }
    return clampToImage({ x: nx, y: ny, width: nw, height: nh });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const { locationX, locationY } = e.nativeEvent;
          modeRef.current = detectMode(locationX, locationY);
          startRef.current = cropRef.current;
          movedRef.current = false;
        },
        onPanResponderMove: (_e, g: PanResponderGestureState) => {
          if (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2) {
            movedRef.current = true;
          }
          setCrop(applyResize(g.dx, g.dy));
        },
        onPanResponderRelease: () => {
          startRef.current = cropRef.current;
          if (movedRef.current) {
            movedRef.current = false;
            onCropEndRef.current?.();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ratio]
  );

  const isFullImage = useMemo(() => {
    if (!imgBox) return true;
    const tol = 1;
    return (
      Math.abs(crop.x - imgBox.x) < tol &&
      Math.abs(crop.y - imgBox.y) < tol &&
      Math.abs(crop.width - imgBox.width) < tol &&
      Math.abs(crop.height - imgBox.height) < tol
    );
  }, [crop, imgBox]);

  useImperativeHandle(
    ref,
    () => ({
      async apply() {
        if (!imgSize || !imgBox) return uri;
        // 未做实际裁剪时直接返回原图，避免重复编码导致画质损失
        if (isFullImage) return uri;
        const scale = imgSize.w / imgBox.width;
        const originX = Math.max(0, Math.round((crop.x - imgBox.x) * scale));
        const originY = Math.max(0, Math.round((crop.y - imgBox.y) * scale));
        const width = Math.min(
          imgSize.w - originX,
          Math.round(crop.width * scale)
        );
        const height = Math.min(
          imgSize.h - originY,
          Math.round(crop.height * scale)
        );
        if (width <= 0 || height <= 0) return uri;
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX, originY, width, height } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        return result.uri;
      },
      hasChanges() {
        return !isFullImage;
      },
    }),
    [uri, imgSize, imgBox, crop, isFullImage]
  );

  const handlePositions = [
    { key: 'tl', x: crop.x, y: crop.y },
    { key: 'tr', x: crop.x + crop.width, y: crop.y },
    { key: 'bl', x: crop.x, y: crop.y + crop.height },
    { key: 'br', x: crop.x + crop.width, y: crop.y + crop.height },
  ];

  const edgePositions = [
    {
      key: 't',
      left: crop.x + crop.width / 2 - 15,
      top: crop.y - 1,
      width: 30,
      height: 3,
    },
    {
      key: 'b',
      left: crop.x + crop.width / 2 - 15,
      top: crop.y + crop.height - 2,
      width: 30,
      height: 3,
    },
    {
      key: 'l',
      left: crop.x - 1,
      top: crop.y + crop.height / 2 - 15,
      width: 3,
      height: 30,
    },
    {
      key: 'r',
      left: crop.x + crop.width - 2,
      top: crop.y + crop.height / 2 - 15,
      width: 3,
      height: 30,
    },
  ];

  return (
    <View
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setContainer({ w: width, h: height });
      }}
    >
      {imgBox ? (
        <>
          {/*
            不再在此处渲染 <Image>，完全依赖外层 ImageEditor 的 baseImage 底图。
            裁剪由 ImageManipulator 基于 uri 完成，不依赖 DOM 中的 Image 元素。
            避免从其它模式切到 crop 时 Image 重新挂载产生的白/黑闪。
          */}
          <View
            style={StyleSheet.absoluteFill}
            {...panResponder.panHandlers}
            pointerEvents="box-only"
          >
            {/* 裁剪区域外遮罩 */}
            <View
              style={[
                styles.mask,
                { left: 0, top: 0, right: 0, height: crop.y },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.mask,
                {
                  left: 0,
                  top: crop.y + crop.height,
                  right: 0,
                  bottom: 0,
                },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.mask,
                {
                  left: 0,
                  top: crop.y,
                  width: crop.x,
                  height: crop.height,
                },
              ]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.mask,
                {
                  left: crop.x + crop.width,
                  top: crop.y,
                  right: 0,
                  height: crop.height,
                },
              ]}
              pointerEvents="none"
            />

            {/* 裁剪框 */}
            <View
              style={{
                position: 'absolute',
                left: crop.x,
                top: crop.y,
                width: crop.width,
                height: crop.height,
                borderWidth: 1,
                borderColor: '#fff',
              }}
              pointerEvents="none"
            >
              {/* 三分线 */}
              <View style={[styles.gridLineH, { top: '33.33%' }]} />
              <View style={[styles.gridLineH, { top: '66.66%' }]} />
              <View style={[styles.gridLineV, { left: '33.33%' }]} />
              <View style={[styles.gridLineV, { left: '66.66%' }]} />
            </View>

            {/* 边手柄视觉 */}
            {edgePositions.map((p) => (
              <View
                key={p.key}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: p.width,
                  height: p.height,
                  backgroundColor: '#fff',
                }}
              />
            ))}

            {/* 角手柄视觉 */}
            {handlePositions.map((p) => (
              <View
                key={p.key}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: p.x - 10,
                  top: p.y - 10,
                  width: 20,
                  height: 20,
                  borderColor: '#fff',
                  borderWidth: 3,
                }}
              />
            ))}
          </View>
          {canReset && onReset ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onReset}
              style={[
                styles.resetBtn,
                {
                  top: imgBox.y + imgBox.height + 8,
                  left: Math.max(
                    0,
                    imgBox.x + imgBox.width - 72
                  ),
                },
              ]}
            >
              <Ionicons name="refresh-outline" size={14} color="#fff" />
              <Text style={styles.resetBtnText}>还原</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </View>
  );
});

CropCanvas.displayName = 'CropCanvas';

export default CropCanvas;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 透明背景，让外层 ImageEditor 的持久底图在本组件 Image.getSize 期间仍然可见，避免切换模式时闪烁
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  resetBtn: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  resetBtnText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
});

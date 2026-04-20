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
} from 'react-native';
import Svg, {
  Defs,
  Mask,
  Path,
  Rect as SvgRect,
  Image as SvgImage,
  G,
  Pattern,
  Text as SvgText,
} from 'react-native-svg';
import * as ImageManipulator from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';

import type { MosaicPath, MosaicKind, Rect } from './types';
import { MOSAIC_KINDS } from './types';

const TEXT_MOSAIC_KINDS = MOSAIC_KINDS.filter((cfg) => cfg.type === 'text');

export type MosaicCanvasHandle = {
  apply: () => Promise<string>;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  setMode: (m: 'draw' | 'erase') => void;
  setBrushSize: (size: number) => void;
  hasEdits: () => boolean;
};

type Props = {
  uri: string;
  initialKind?: MosaicKind;
  kind?: MosaicKind;
  onStateChange?: (state: {
    mode: 'draw' | 'erase';
    brushSize: number;
    kind: MosaicKind;
    canUndo: boolean;
    canRedo: boolean;
  }) => void;
};

const MosaicCanvas = forwardRef<MosaicCanvasHandle, Props>(
  ({ uri, initialKind = 'block', kind: controlledKind, onStateChange }, ref) => {
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(
      null
    );
    const [container, setContainer] = useState<{ w: number; h: number } | null>(
      null
    );
    // 为所有"用到过的 pixel 类型"各自缓存一份像素化底图
    const [pixelatedUris, setPixelatedUris] = useState<Record<string, string>>(
      {}
    );
    const [textOverlayUris, setTextOverlayUris] = useState<Record<string, string>>(
      {}
    );
    const [paths, setPaths] = useState<MosaicPath[]>([]);
    const [redoStack, setRedoStack] = useState<MosaicPath[]>([]);
    const [mode, setModeState] = useState<'draw' | 'erase'>('draw');
    const [brushSize, setBrushSizeState] = useState(24);
    const kind = controlledKind ?? initialKind;

    const currentPathRef = useRef('');
    const captureViewRef = useRef<View>(null);
    const livePreviewRef = useRef<LivePreviewHandle>(null);
    const textOverlayCaptureRefs = useRef<Partial<Record<MosaicKind, View | null>>>(
      {}
    );
    const textOverlayGeneratingRef = useRef(false);
    const modeRef = useRef(mode);
    const brushRef = useRef(brushSize);
    const kindRef = useRef<MosaicKind>(kind);
    kindRef.current = kind;

    useEffect(() => {
      modeRef.current = mode;
    }, [mode]);
    useEffect(() => {
      brushRef.current = brushSize;
    }, [brushSize]);
    useEffect(() => {
      onStateChange?.({
        mode,
        brushSize,
        kind,
        canUndo: paths.length > 0,
        canRedo: redoStack.length > 0,
      });
    }, [
      mode,
      brushSize,
      kind,
      paths.length,
      redoStack.length,
      onStateChange,
    ]);

    useEffect(() => {
      Image.getSize(
        uri,
        (w, h) => setImgSize({ w, h }),
        () => setImgSize({ w: 1, h: 1 })
      );
    }, [uri]);

    const imgBox: Rect | null = useMemo(() => {
      if (!imgSize || !container) return null;
      const scale = Math.min(container.w / imgSize.w, container.h / imgSize.h);
      const w = imgSize.w * scale;
      const h = imgSize.h * scale;
      return {
        x: (container.w - w) / 2,
        y: (container.h - h) / 2,
        width: w,
        height: h,
      };
    }, [imgSize, container]);

    // 主 SVG 的历史图层集合：仅收集真正被绘制过的 kind（首次出现顺序）。
    // 不再把当前选中的 kind 加进来——否则切换按钮时主 SVG 会为尚未落笔的 kind
    // 同步构建整个 Mask + Pattern + 图层，阻塞 onPress 导致按钮响应慢。
    // 实时预览由独立的 LivePreview 子组件负责，与 kind 切换完全解耦。
    const activeKinds = useMemo<MosaicKind[]>(() => {
      const seen = new Set<MosaicKind>();
      const ordered: MosaicKind[] = [];
      for (const p of paths) {
        if (p.mode === 'draw' && p.kind && !seen.has(p.kind)) {
          seen.add(p.kind);
          ordered.push(p.kind);
        }
      }
      return ordered;
    }, [paths]);

    // 文字类马赛克改为 Pattern 填充，避免整屏挂载大量 SvgText 节点。
    const textPatternMetrics = useMemo<
      Partial<Record<MosaicKind, ReturnType<typeof buildTextPatternMetrics>>>
    >(() => {
      if (!imgBox) return {};
      const metrics: Partial<
        Record<MosaicKind, ReturnType<typeof buildTextPatternMetrics>>
      > = {};
      for (const cfg of MOSAIC_KINDS) {
        if (cfg.type !== 'text') continue;
        metrics[cfg.id] = buildTextPatternMetrics(
          imgBox.width,
          imgBox.height,
          cfg.text
        );
      }
      return metrics;
    }, [imgBox?.width, imgBox?.height]);

    // 换源（裁剪后等）时清空 pixel 缓存，避免旧图错配
    useEffect(() => {
      setPixelatedUris({});
    }, [uri]);

    // 位图缓存仅依赖当前显示尺寸；尺寸变化后重新生成。
    useEffect(() => {
      setTextOverlayUris({});
      textOverlayGeneratingRef.current = false;
    }, [imgBox?.width, imgBox?.height]);

    // 为所有"用到过的 pixel 类型"生成并缓存像素化底图
    useEffect(() => {
      if (!imgSize) return;
      const pending: string[] = [];
      for (const k of activeKinds) {
        if (pixelatedUris[k]) continue;
        const cfg = MOSAIC_KINDS.find((c) => c.id === k);
        if (cfg && cfg.type === 'pixel') pending.push(k);
      }
      if (pending.length === 0) return;

      let cancelled = false;
      (async () => {
        for (const k of pending) {
          const cfg = MOSAIC_KINDS.find((c) => c.id === k);
          if (!cfg || cfg.type !== 'pixel') continue;
          try {
            const blockCount = cfg.blockCount;
            const upscaleWidth = Math.min(imgSize.w, 1200);
            const small = await ImageManipulator.manipulateAsync(
              uri,
              [{ resize: { width: blockCount } }],
              { compress: 1, format: ImageManipulator.SaveFormat.PNG }
            );
            const big = await ImageManipulator.manipulateAsync(
              small.uri,
              [{ resize: { width: upscaleWidth } }],
              { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
            );
            if (cancelled) return;
            setPixelatedUris((prev) =>
              prev[k] ? prev : { ...prev, [k]: big.uri }
            );
          } catch {
            if (cancelled) return;
            setPixelatedUris((prev) => (prev[k] ? prev : { ...prev, [k]: uri }));
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [imgSize, uri, activeKinds, pixelatedUris]);

    // 文字类马赛克在后台预渲染成位图，切换时直接复用图片，避免实时绘制文字纹理。
    useEffect(() => {
      if (!imgBox) return;
      if (textOverlayGeneratingRef.current) return;
      const nextCfg = TEXT_MOSAIC_KINDS.find((cfg) => !textOverlayUris[cfg.id]);
      if (!nextCfg) return;
      const host = textOverlayCaptureRefs.current[nextCfg.id];
      const metrics = textPatternMetrics[nextCfg.id];
      if (!host || !metrics) return;

      let cancelled = false;
      textOverlayGeneratingRef.current = true;

      (async () => {
        try {
          await waitForNextFrame();
          await waitForNextFrame();
          const result = await captureRef(host, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
          });
          if (cancelled) return;
          setTextOverlayUris((prev) =>
            prev[nextCfg.id] ? prev : { ...prev, [nextCfg.id]: result }
          );
        } catch {
          // 失败时保留 Pattern 兜底，不影响功能。
        } finally {
          textOverlayGeneratingRef.current = false;
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [imgBox, textOverlayUris, textPatternMetrics]);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: (e) => {
            const { locationX, locationY } = e.nativeEvent;
            currentPathRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
            // 仅驱动独立的预览层，绝不触发主 SVG 重渲染
            livePreviewRef.current?.start(currentPathRef.current, {
              size: brushRef.current,
              mode: modeRef.current,
              kind: kindRef.current,
            });
          },
          onPanResponderMove: (e) => {
            const { locationX, locationY } = e.nativeEvent;
            currentPathRef.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
            livePreviewRef.current?.update(currentPathRef.current);
          },
          onPanResponderRelease: () => {
            const d = currentPathRef.current;
            if (d && d.includes('L')) {
              setPaths((prev) => [
                ...prev,
                {
                  d,
                  size: brushRef.current,
                  mode: modeRef.current,
                  // 只有 draw 笔画需要记录 kind；erase 对所有层生效
                  kind:
                    modeRef.current === 'draw' ? kindRef.current : undefined,
                },
              ]);
              setRedoStack([]);
            }
            currentPathRef.current = '';
            // 延迟 2 帧再清，等主 SVG 把新 paths 渲染完成，避免抬手瞬间闪烁
            livePreviewRef.current?.handoff();
          },
          onPanResponderTerminate: () => {
            currentPathRef.current = '';
            livePreviewRef.current?.clear();
          },
        }),
      []
    );

    useImperativeHandle(
      ref,
      () => ({
        async apply() {
          if (paths.length === 0) return uri;
          if (!captureViewRef.current) return uri;
          try {
            const result = await captureRef(captureViewRef, {
              format: 'jpg',
              quality: 0.9,
              result: 'tmpfile',
            });
            return result;
          } catch {
            return uri;
          }
        },
        undo() {
          setPaths((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setRedoStack((r) => [...r, last]);
            return prev.slice(0, -1);
          });
        },
        redo() {
          setRedoStack((r) => {
            if (r.length === 0) return r;
            const last = r[r.length - 1];
            setPaths((p) => [...p, last]);
            return r.slice(0, -1);
          });
        },
        reset() {
          setPaths([]);
          setRedoStack([]);
        },
        setMode(m) {
          setModeState(m);
        },
        setBrushSize(s) {
          setBrushSizeState(s);
        },
        hasEdits() {
          return paths.length > 0;
        },
      }),
      [uri, paths]
    );

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
            {TEXT_MOSAIC_KINDS.map((cfg) => {
              const metrics = textPatternMetrics[cfg.id];
              if (!metrics || textOverlayUris[cfg.id]) return null;
              return (
                <View
                  key={`text-overlay-cache-${cfg.id}`}
                  ref={(node) => {
                    textOverlayCaptureRefs.current[cfg.id] = node;
                  }}
                  collapsable={false}
                  pointerEvents="none"
                  style={[
                    styles.bitmapCacheHost,
                    { width: imgBox.width, height: imgBox.height },
                  ]}
                >
                  <Svg
                    width={imgBox.width}
                    height={imgBox.height}
                    viewBox={`0 0 ${imgBox.width} ${imgBox.height}`}
                  >
                    <Defs>
                      <Pattern
                        id={`cacheTextPattern-${cfg.id}`}
                        x={0}
                        y={0}
                        width={metrics.tileWidth}
                        height={metrics.tileHeight}
                        patternUnits="userSpaceOnUse"
                      >
                        <SvgRect
                          x={0}
                          y={0}
                          width={metrics.tileWidth}
                          height={metrics.tileHeight}
                          fill={cfg.bgColor}
                        />
                        {metrics.positions.map((pos, i) => (
                          <SvgText
                            key={`${cfg.id}-cache-text-${i}`}
                            x={pos.x}
                            y={pos.y}
                            fontSize={metrics.fontSize}
                            fontWeight="bold"
                            fill={cfg.textColor}
                            textAnchor="middle"
                            transform={`rotate(${metrics.rotate} ${pos.x} ${pos.y})`}
                          >
                            {cfg.text}
                          </SvgText>
                        ))}
                      </Pattern>
                    </Defs>
                    <SvgRect
                      x={0}
                      y={0}
                      width={imgBox.width}
                      height={imgBox.height}
                      fill={`url(#cacheTextPattern-${cfg.id})`}
                    />
                  </Svg>
                </View>
              );
            })}
            <View
              ref={captureViewRef}
              collapsable={false}
              style={{
                position: 'absolute',
                left: imgBox.x,
                top: imgBox.y,
                width: imgBox.width,
                height: imgBox.height,
                // 透明：避免在内层 Image 加载前遮住外层 baseImage 造成黑闪
                backgroundColor: 'transparent',
              }}
            >
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
              <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
                <Svg
                  width={imgBox.width}
                  height={imgBox.height}
                  viewBox={`0 0 ${imgBox.width} ${imgBox.height}`}
                >
                  <Defs>
                    {activeKinds.map((k) => (
                      <Mask id={`mosaicMask-${k}`} key={`mask-${k}`}>
                        <SvgRect
                          x={0}
                          y={0}
                          width={imgBox.width}
                          height={imgBox.height}
                          fill="black"
                        />
                        {/* 按时间顺序处理：
                            - 属于本层 kind 的 draw → white（在本层显示）
                            - 其他 kind 的 draw → black（在本层被"覆盖"抹去）
                            - 任何 erase → black（从所有层擦除） */}
                        {paths.map((p, i) => {
                          const isMine =
                            p.mode === 'draw' && p.kind === k;
                          return (
                            <Path
                              key={i}
                              d={p.d}
                              stroke={isMine ? 'white' : 'black'}
                              strokeWidth={p.size}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          );
                        })}
                      </Mask>
                    ))}
                    {activeKinds.map((k) => {
                      const cfg = MOSAIC_KINDS.find((c) => c.id === k);
                      if (!cfg || cfg.type !== 'text' || textOverlayUris[cfg.id]) {
                        return null;
                      }
                      const metrics = textPatternMetrics[cfg.id];
                      if (!metrics) return null;
                      return (
                        <Pattern
                          id={`mosaicTextPattern-${cfg.id}`}
                          key={`pattern-${cfg.id}`}
                          x={0}
                          y={0}
                          width={metrics.tileWidth}
                          height={metrics.tileHeight}
                          patternUnits="userSpaceOnUse"
                        >
                          <SvgRect
                            x={0}
                            y={0}
                            width={metrics.tileWidth}
                            height={metrics.tileHeight}
                            fill={cfg.bgColor}
                          />
                          {metrics.positions.map((pos, i) => (
                            <SvgText
                              key={`${cfg.id}-pattern-text-${i}`}
                              x={pos.x}
                              y={pos.y}
                              fontSize={metrics.fontSize}
                              fontWeight="bold"
                              fill={cfg.textColor}
                              textAnchor="middle"
                              transform={`rotate(${metrics.rotate} ${pos.x} ${pos.y})`}
                            >
                              {cfg.text}
                            </SvgText>
                          ))}
                        </Pattern>
                      );
                    })}
                  </Defs>
                  {/* 按 kind 首次出现的顺序叠加每层图层（正确性与顺序无关，因每个像素最多被一层显示） */}
                  {activeKinds.map((k) => {
                    const cfg = MOSAIC_KINDS.find((c) => c.id === k);
                    if (!cfg) return null;
                    if (cfg.type === 'pixel') {
                      const p = pixelatedUris[k];
                      if (!p) return null;
                      return (
                        <SvgImage
                          key={`layer-${k}`}
                          href={{ uri: p }}
                          x={0}
                          y={0}
                          width={imgBox.width}
                          height={imgBox.height}
                          preserveAspectRatio="xMidYMid slice"
                          mask={`url(#mosaicMask-${k})`}
                        />
                      );
                    }
                    const overlayUri = textOverlayUris[cfg.id];
                    if (overlayUri) {
                      return (
                        <SvgImage
                          key={`layer-${k}`}
                          href={{ uri: overlayUri }}
                          x={0}
                          y={0}
                          width={imgBox.width}
                          height={imgBox.height}
                          preserveAspectRatio="none"
                          mask={`url(#mosaicMask-${k})`}
                        />
                      );
                    }
                    return (
                      <G key={`layer-${k}`} mask={`url(#mosaicMask-${k})`}>
                        <SvgRect
                          x={0}
                          y={0}
                          width={imgBox.width}
                          height={imgBox.height}
                          fill={`url(#mosaicTextPattern-${cfg.id})`}
                        />
                      </G>
                    );
                  })}
                </Svg>
                {/* 实时预览层：与主 SVG 完全解耦，切换 kind 只改 SvgImage.href，
                    绘制中只改 Path.d；不会引起主 SVG 重渲染 */}
                <LivePreview
                  ref={livePreviewRef}
                  width={imgBox.width}
                  height={imgBox.height}
                  currentKind={kind}
                  pixelatedUris={pixelatedUris}
                  textOverlayUris={textOverlayUris}
                />
              </View>
            </View>
          </>
        ) : null}
      </View>
    );
  }
);

MosaicCanvas.displayName = 'MosaicCanvas';

export default MosaicCanvas;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bitmapCacheHost: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    backgroundColor: 'transparent',
  },
});

// 根据画布尺寸生成 Pattern 参数，用极少节点实现整屏文字平铺。
function buildTextPatternMetrics(width: number, height: number, text: string) {
  const fontSize = Math.max(10, Math.round(Math.min(width, height) * 0.045));
  const charW = fontSize * 1.0;
  const stepX = (charW * text.length + fontSize * 0.5) * 0.7;
  const stepY = fontSize * 1.1;
  return {
    fontSize,
    rotate: -14,
    tileWidth: stepX * 2,
    tileHeight: stepY * 2,
    positions: [
      { x: stepX * 0.25, y: fontSize * 0.9 },
      { x: stepX * 1.25, y: fontSize * 0.9 },
      { x: stepX * 0.75, y: stepY + fontSize * 0.9 },
      { x: stepX * 1.75, y: stepY + fontSize * 0.9 },
    ],
  };
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

// =============================================================================
// LivePreview：独立渲染"正在绘制的实时马赛克"
// -----------------------------------------------------------------------------
// 关键设计：
// 1. 不参与主 SVG 的 JSX 树；通过 ref 的 start/update/handoff/clear 驱动，
//    切换 kind、滑动绘制这两个高频路径都不会触发主 MosaicCanvas 或其主 SVG
//    重渲染。
// 2. 底图直接使用上层已经预渲染好的图片：
//      - pixel 类 → pixelatedUris[kind]
//      - text 类  → textOverlayUris[kind]
//    切换 kind 时只是换 <SvgImage> 的 href 属性，native SVG 节点复用。
// 3. 绘制过程中只 setState 一个 path 字符串，Path 节点常驻（空闲时 d = "M 0 0"），
//    节点不会反复 mount/unmount，大量减少首次按压卡顿。
// 4. 抬手 handoff：延迟 2 帧再清空，等主 SVG 用新 paths 渲染完成，避免瞬间留白。
// =============================================================================
type LivePreviewHandle = {
  start: (
    d: string,
    opts: { size: number; mode: 'draw' | 'erase'; kind: MosaicKind }
  ) => void;
  update: (d: string) => void;
  clear: () => void;
  handoff: () => void;
};

type LivePreviewProps = {
  width: number;
  height: number;
  currentKind: MosaicKind;
  pixelatedUris: Record<string, string>;
  textOverlayUris: Record<string, string>;
};

const LIVE_EMPTY_PATH = 'M 0 0';

const LivePreview = forwardRef<LivePreviewHandle, LivePreviewProps>(
  (
    { width, height, currentKind, pixelatedUris, textOverlayUris },
    ref
  ) => {
    const [d, setD] = useState('');
    const [size, setSize] = useState(24);
    const [mode, setMode] = useState<'draw' | 'erase'>('draw');
    // kind 单独维护一份内部 state，绘制期间即便父组件的 currentKind 变化也按"start
    // 时的 kind"显示，避免一笔画到一半换格式；默认同步于 prop。
    const [strokeKind, setStrokeKind] = useState<MosaicKind>(currentKind);
    const handoffRafRef = useRef<number | null>(null);

    // 当父组件切换 kind 而此时没有正在绘制时，同步到内部 state，让"下一笔"用新 kind
    useEffect(() => {
      if (!d) setStrokeKind(currentKind);
    }, [currentKind, d]);

    useImperativeHandle(
      ref,
      () => ({
        start: (nd, opts) => {
          if (handoffRafRef.current != null) {
            cancelAnimationFrame(handoffRafRef.current);
            handoffRafRef.current = null;
          }
          setSize(opts.size);
          setMode(opts.mode);
          setStrokeKind(opts.kind);
          setD(nd);
        },
        update: (nd) => setD(nd),
        clear: () => {
          if (handoffRafRef.current != null) {
            cancelAnimationFrame(handoffRafRef.current);
            handoffRafRef.current = null;
          }
          setD('');
        },
        handoff: () => {
          if (handoffRafRef.current != null) {
            cancelAnimationFrame(handoffRafRef.current);
          }
          handoffRafRef.current = requestAnimationFrame(() => {
            handoffRafRef.current = requestAnimationFrame(() => {
              handoffRafRef.current = null;
              setD('');
            });
          });
        },
      }),
      []
    );

    const cfg = MOSAIC_KINDS.find((c) => c.id === strokeKind);
    const visible = d.length > 0;
    const pathD = visible ? d : LIVE_EMPTY_PATH;

    const bitmapUri = !cfg
      ? null
      : cfg.type === 'pixel'
        ? pixelatedUris[strokeKind] ?? null
        : textOverlayUris[strokeKind] ?? null;

    const mosaicReady = mode === 'draw' && !!bitmapUri;
    const showMosaic = visible && mosaicReady;
    const showLine = visible && !mosaicReady;
    const lineStroke =
      mode === 'erase' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.8)';

    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
      >
        {/* 底图 + mask：节点常驻，仅通过 opacity 与 path.d 驱动可见性 */}
        <View
          style={[StyleSheet.absoluteFill, { opacity: showMosaic ? 1 : 0 }]}
        >
          <Svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <Defs>
              <Mask id="livePreviewMask">
                <SvgRect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  fill="black"
                />
                <Path
                  d={pathD}
                  stroke="white"
                  strokeWidth={size}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Mask>
            </Defs>
            {bitmapUri ? (
              <SvgImage
                href={{ uri: bitmapUri }}
                x={0}
                y={0}
                width={width}
                height={height}
                preserveAspectRatio={
                  cfg?.type === 'pixel' ? 'xMidYMid slice' : 'none'
                }
                mask="url(#livePreviewMask)"
              />
            ) : null}
          </Svg>
        </View>
        {/* 提示线：擦除模式或位图尚未就绪时使用 */}
        <View
          style={[StyleSheet.absoluteFill, { opacity: showLine ? 1 : 0 }]}
        >
          <Svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <Path
              d={pathD}
              stroke={lineStroke}
              strokeWidth={size}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
      </View>
    );
  }
);

LivePreview.displayName = 'LivePreview';

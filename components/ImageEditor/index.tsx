import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';

const SCREEN_WIDTH = Dimensions.get('window').width;

import CropCanvas, { CropCanvasHandle } from './CropCanvas';
import MosaicCanvas, { MosaicCanvasHandle } from './MosaicCanvas';
import DoodleCanvas, { DoodleCanvasHandle } from './DoodleCanvas';
import TextCanvas, { TextCanvasHandle } from './TextCanvas';
import DraggableThumbList from './DraggableThumbList';
import {
  DOODLE_COLORS,
  DOODLE_SIZES,
  EditorMode,
  TEXT_COLORS,
  TEXT_FONT_SIZES,
  MOSAIC_SIZES,
  MOSAIC_KINDS,
  MosaicKind,
  MosaicKindConfig,
} from './types';

type Props = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onCancel: () => void;
  onDone: (images: string[]) => void;
  /** 入场动画（从右滑入）完成后触发，父组件可据此关闭下层相册等。 */
  onOpened?: () => void;
  /** 出场动画（向右滑出）完成后触发。 */
  onClosed?: () => void;
};

export default function ImageEditor({
  visible,
  images,
  initialIndex = 0,
  onCancel,
  onDone,
  onOpened,
  onClosed,
}: Props) {
  const [mode, setMode] = useState<EditorMode>('view');
  const [workingImages, setWorkingImages] = useState<string[]>(images);
  /** 编辑器打开时的原始图片快照，仅用于"还原"等操作回到最初状态。 */
  const [originalImages, setOriginalImages] = useState<string[]>(images);
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [processing, setProcessing] = useState(false);
  /** canvas 切换（如裁剪完成）时用于淡出/淡入的过渡动画值。 */
  const canvasOpacity = useRef(new Animated.Value(1)).current;

  const [doodleColor, setDoodleColor] = useState<string>(DOODLE_COLORS[2]);
  const [doodleSize, setDoodleSize] = useState<number>(DOODLE_SIZES[1]);
  const [textColor, setTextColor] = useState<string>(TEXT_COLORS[0]);
  const [textFontSize, setTextFontSize] = useState<number>(TEXT_FONT_SIZES[1]);
  const [mosaicSize, setMosaicSize] = useState<number>(MOSAIC_SIZES[1]);
  const [mosaicKind, setMosaicKind] = useState<MosaicKind>('block');
  const [mosaicKindRailWidth, setMosaicKindRailWidth] = useState(0);
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const cropRef = useRef<CropCanvasHandle>(null);
  const mosaicRef = useRef<MosaicCanvasHandle>(null);
  const doodleRef = useRef<DoodleCanvasHandle>(null);
  const textRef = useRef<TextCanvasHandle>(null);
  const deleteBarRef = useRef<View>(null);

  const [dragState, setDragState] = useState({
    dragging: false,
    overDelete: false,
  });

  useEffect(() => {
    if (visible) {
      setWorkingImages(images);
      setOriginalImages(images);
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setMode('view');
      setCanUndo(false);
      setCanRedo(false);
      setToolsExpanded(false);
      canvasOpacity.setValue(1);
    }
  }, [visible, images, initialIndex, canvasOpacity]);

  useEffect(() => {
    if (mode === 'text' && visible) {
      const t = setTimeout(() => {
        if (textRef.current && !textRef.current.hasEdits()) {
          textRef.current.addText();
        }
      }, 180);
      return () => clearTimeout(t);
    }
  }, [mode, currentIndex, visible]);

  const currentUri = workingImages[currentIndex] ?? '';

  const applyCurrent = useCallback(async (): Promise<string | null> => {
    if (mode === 'crop' && cropRef.current) {
      if (cropRef.current.hasChanges()) return cropRef.current.apply();
    }
    if (mode === 'mosaic' && mosaicRef.current) {
      if (mosaicRef.current.hasEdits()) return mosaicRef.current.apply();
    }
    if (mode === 'doodle' && doodleRef.current) {
      if (doodleRef.current.hasEdits()) return doodleRef.current.apply();
    }
    if (mode === 'text' && textRef.current) {
      if (textRef.current.hasEdits()) return textRef.current.apply();
    }
    return null;
  }, [mode]);

  /** 当前模式下是否存在未提交的编辑，用于避免无变更时出现 loading 闪烁。 */
  const hasPendingEdits = useCallback(() => {
    if (mode === 'crop') return !!cropRef.current?.hasChanges();
    if (mode === 'mosaic') return !!mosaicRef.current?.hasEdits();
    if (mode === 'doodle') return !!doodleRef.current?.hasEdits();
    if (mode === 'text') return !!textRef.current?.hasEdits();
    return false;
  }, [mode]);

  const commitCurrent = useCallback(async () => {
    if (processing) return;
    // 无实际编辑时直接返回，避免切换功能时预览区闪现 loading 指示器
    if (!hasPendingEdits()) return;
    setProcessing(true);
    try {
      const newUri = await applyCurrent();
      if (newUri) {
        setWorkingImages((prev) => {
          const next = [...prev];
          next[currentIndex] = newUri;
          return next;
        });
      }
    } finally {
      setProcessing(false);
    }
  }, [applyCurrent, currentIndex, processing, hasPendingEdits]);

  const switchToMode = useCallback(
    async (next: EditorMode) => {
      if (next === mode || processing) return;
      await commitCurrent();
      setMode(next);
      setCanUndo(false);
      setCanRedo(false);
    },
    [mode, processing, commitCurrent]
  );

  const switchToIndex = useCallback(
    async (nextIndex: number) => {
      if (nextIndex === currentIndex || processing) return;
      if (nextIndex < 0 || nextIndex >= workingImages.length) return;
      await commitCurrent();
      setCurrentIndex(nextIndex);
      setMode('view');
      setCanUndo(false);
      setCanRedo(false);
    },
    [currentIndex, processing, commitCurrent, workingImages.length]
  );

  const handleReorder = useCallback((from: number, to: number) => {
    if (from === to) return;
    setWorkingImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    // 原图列表同步重排，确保还原按钮对应的还是各自的初始图
    setOriginalImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setCurrentIndex((prev) => {
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });
  }, []);

  /**
   * 淡出 canvas → 执行变更 → 淡入，给裁剪等结果切换一个平滑的过渡。
   * 通过动画的方式放慢视觉变化速度，提升体验。
   */
  const runCanvasTransition = useCallback(
    async (mutate: () => void | Promise<void>) => {
      await new Promise<void>((resolve) => {
        Animated.timing(canvasOpacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }).start(() => resolve());
      });
      await mutate();
      // 留一点时间让新 canvas 加载图片尺寸后再淡入，避免"先空白后裁剪框"的跳变
      await new Promise<void>((resolve) => setTimeout(resolve, 60));
      await new Promise<void>((resolve) => {
        Animated.timing(canvasOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start(() => resolve());
      });
    },
    [canvasOpacity]
  );

  /** 用户在裁剪画布上松手后立即应用裁剪，带淡出/淡入过渡 */
  const handleCropEnd = useCallback(async () => {
    if (processing) return;
    if (!cropRef.current) return;
    if (!cropRef.current.hasChanges()) return;
    setProcessing(true);
    try {
      const newUri = await cropRef.current.apply();
      await runCanvasTransition(() => {
        if (newUri) {
          setWorkingImages((prev) => {
            const next = [...prev];
            next[currentIndex] = newUri;
            return next;
          });
        }
      });
    } finally {
      setProcessing(false);
    }
  }, [currentIndex, processing, runCanvasTransition]);

  /** 点击裁剪模式下右下方"还原"按钮，将当前图还原到最初始尺寸。 */
  const handleCropReset = useCallback(async () => {
    if (processing) return;
    const original = originalImages[currentIndex];
    if (!original) return;
    if (workingImages[currentIndex] === original) return;
    setProcessing(true);
    try {
      await runCanvasTransition(() => {
        setWorkingImages((prev) => {
          const next = [...prev];
          next[currentIndex] = original;
          return next;
        });
      });
    } finally {
      setProcessing(false);
    }
  }, [processing, originalImages, workingImages, currentIndex, runCanvasTransition]);

  /** 当前图片是否被编辑过（与初始原图不一致），用于显示还原按钮。 */
  const canResetCurrent =
    !!originalImages[currentIndex] &&
    workingImages[currentIndex] !== originalImages[currentIndex];

  const handleDeleteAt = useCallback(
    (idx: number) => {
      const next = workingImages.filter((_, i) => i !== idx);
      if (next.length === 0) {
        onDone([]);
        return;
      }
      const nextOriginals = originalImages.filter((_, i) => i !== idx);
      let newCur = currentIndex;
      if (idx < currentIndex) newCur = currentIndex - 1;
      else if (idx === currentIndex)
        newCur = Math.min(currentIndex, next.length - 1);
      setWorkingImages(next);
      setOriginalImages(nextOriginals);
      setCurrentIndex(newCur);
      setMode('view');
      setCanUndo(false);
      setCanRedo(false);
    },
    [workingImages, originalImages, currentIndex, onDone]
  );

  const handleDone = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const newUri = await applyCurrent();
      const finalImages = [...workingImages];
      if (newUri) finalImages[currentIndex] = newUri;
      onDone(finalImages);
    } finally {
      setProcessing(false);
    }
  }, [processing, applyCurrent, workingImages, currentIndex, onDone]);

  const handleUndo = useCallback(() => {
    if (mode === 'mosaic') mosaicRef.current?.undo();
    else if (mode === 'doodle') doodleRef.current?.undo();
    else if (mode === 'text') textRef.current?.undo();
  }, [mode]);

  const handleRedo = useCallback(() => {
    if (mode === 'mosaic') mosaicRef.current?.redo();
    else if (mode === 'doodle') doodleRef.current?.redo();
    else if (mode === 'text') textRef.current?.redo();
  }, [mode]);

  const undoEnabled =
    mode !== 'crop' && mode !== 'view' && canUndo;
  const redoEnabled =
    mode !== 'crop' && mode !== 'view' && canRedo;
  const mosaicKindContentWidth = MOSAIC_KINDS.length * 38;
  const mosaicKindScrollEnabled =
    mosaicKindRailWidth > 0
      ? mosaicKindContentWidth > mosaicKindRailWidth
      : true;
  const showSubToolbar =
    toolsExpanded && (mode === 'doodle' || mode === 'mosaic');

  const collapseTools = useCallback(async () => {
    if (processing) return;
    await commitCurrent();
    setMode('view');
    setCanUndo(false);
    setCanRedo(false);
    setToolsExpanded(false);
  }, [processing, commitCurrent]);

  // 入场 / 出场动画（从右向左滑入，从左向右滑出）
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onOpened?.();
      });
    } else if (mounted) {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 240,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          onClosed?.();
        }
      });
    }
  }, [visible, slideAnim, mounted, onOpened, onClosed]);

  // Android 物理返回键 → 触发取消
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          transform: [{ translateX: slideAnim }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safe}>
          {/* 顶部：取消 / 页码 / 撤销·恢复 */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.headerBtn}>取消</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {currentIndex + 1}/{workingImages.length}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={handleUndo}
                disabled={!undoEnabled}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                style={styles.headerIconBtn}
              >
                <Ionicons
                  name="arrow-undo"
                  size={20}
                  color={undoEnabled ? '#fff' : '#555'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRedo}
                disabled={!redoEnabled}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                style={styles.headerIconBtn}
              >
                <Ionicons
                  name="arrow-redo"
                  size={20}
                  color={redoEnabled ? '#fff' : '#555'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 预览画布 */}
          <Animated.View style={[styles.canvas, { opacity: canvasOpacity }]}>
            {/*
              持久底图：用 expo-image 以获得稳定的 crossfade + 缓存，切换 uri 时不会瞬间空白。
              各模式的交互层（CropCanvas 等）自带同一 uri 的 Image，会覆盖在其上。
              切换模式时底图始终存在，不会出现任何刷新/闪烁。
            */}
            {currentUri ? (
              <ExpoImage
                source={{ uri: currentUri }}
                style={styles.baseImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
              />
            ) : null}

            {mode === 'view' ? null : mode === 'crop' ? (
              <CropCanvas
                key={`crop-${currentIndex}-${currentUri}`}
                ref={cropRef}
                uri={currentUri}
                ratio={null}
                onCropEnd={handleCropEnd}
                canReset={canResetCurrent}
                onReset={handleCropReset}
              />
            ) : mode === 'mosaic' ? (
              <MosaicCanvas
                key={`mosaic-${currentIndex}-${currentUri}`}
                ref={mosaicRef}
                uri={currentUri}
                kind={mosaicKind}
                onStateChange={(s) => {
                  setCanUndo(s.canUndo);
                  setCanRedo(s.canRedo);
                }}
              />
            ) : mode === 'doodle' ? (
              <DoodleCanvas
                key={`doodle-${currentIndex}-${currentUri}`}
                ref={doodleRef}
                uri={currentUri}
                initialColor={doodleColor}
                initialSize={doodleSize}
                onStateChange={(s) => {
                  setCanUndo(s.canUndo);
                  setCanRedo(s.canRedo);
                }}
              />
            ) : (
              <TextCanvas
                key={`text-${currentIndex}-${currentUri}`}
                ref={textRef}
                uri={currentUri}
                initialColor={textColor}
                initialFontSize={textFontSize}
                onStateChange={(s) => {
                  setCanUndo(s.canUndo);
                  setCanRedo(s.canRedo);
                }}
              />
            )}
            {processing ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : null}

            {/* 紧凑工具条（按模式显示），悬浮在 canvas 底部，不影响布局 */}
            {showSubToolbar ? (
              <View style={styles.subToolbar}>
              {mode === 'doodle' ? (
                <>
                  <View style={styles.sizeRow}>
                    {DOODLE_SIZES.map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          setDoodleSize(s);
                          doodleRef.current?.setBrushSize(s);
                        }}
                        style={[
                          styles.sizeBtn,
                          doodleSize === s && styles.sizeBtnActive,
                        ]}
                      >
                        <View
                          style={{
                            width: s + 2,
                            height: s + 2,
                            borderRadius: (s + 2) / 2,
                            backgroundColor:
                              doodleSize === s ? '#fff' : '#888',
                          }}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.subDivider} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.colorScroll}
                    contentContainerStyle={styles.colorRow}
                  >
                    {DOODLE_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => {
                          setDoodleColor(c);
                          doodleRef.current?.setColor(c);
                        }}
                        style={[
                          styles.colorDot,
                          { backgroundColor: c },
                          doodleColor === c && styles.colorDotActive,
                        ]}
                      />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {mode === 'mosaic' ? (
                <>
                  <View style={styles.sizeRow}>
                    {MOSAIC_SIZES.map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          setMosaicSize(s);
                          mosaicRef.current?.setBrushSize(s);
                        }}
                        style={[
                          styles.sizeBtn,
                          mosaicSize === s && styles.sizeBtnActive,
                        ]}
                      >
                        <View
                          style={{
                            width: s / 2,
                            height: s / 2,
                            borderRadius: s / 4,
                            backgroundColor:
                              mosaicSize === s ? '#fff' : '#888',
                          }}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.subDivider} />
                  <ScrollView
                    horizontal
                    scrollEnabled={mosaicKindScrollEnabled}
                    showsHorizontalScrollIndicator={false}
                    alwaysBounceHorizontal={false}
                    directionalLockEnabled
                    keyboardShouldPersistTaps="always"
                    canCancelContentTouches={false}
                    style={styles.colorScroll}
                    contentContainerStyle={styles.kindRow}
                    onLayout={(e) =>
                      setMosaicKindRailWidth(e.nativeEvent.layout.width)
                    }
                  >
                    {MOSAIC_KINDS.map((k) => {
                      const active = mosaicKind === k.id;
                      return (
                        <TouchableOpacity
                          key={k.id}
                          onPress={() => setMosaicKind(k.id)}
                          style={[
                            styles.kindBtn,
                            active && styles.kindBtnActive,
                          ]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          pressRetentionOffset={{
                            top: 12,
                            bottom: 12,
                            left: 12,
                            right: 12,
                          }}
                          accessibilityLabel={k.label}
                        >
                          <MosaicKindIcon kind={k} active={active} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}
              </View>
            ) : null}
          </Animated.View>

          {/* 缩略图列表（支持长按拖拽排序/删除） */}
          <DraggableThumbList
            images={workingImages}
            currentIndex={currentIndex}
            onSelect={switchToIndex}
            onReorder={handleReorder}
            onDelete={handleDeleteAt}
            deleteTargetRef={deleteBarRef}
            onDragStateChange={setDragState}
          />

          {/* 底部功能栏 */}
          {toolsExpanded ? (
            <View style={styles.funcBar}>
              <TouchableOpacity
                style={styles.funcBtn}
                onPress={collapseTools}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={22} color="#ccc" />
                <Text style={styles.funcText}>返回</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.funcBtn}
                onPress={() => switchToMode('doodle')}
              >
                <Ionicons
                  name="brush-outline"
                  size={22}
                  color={mode === 'doodle' ? '#ff2442' : '#ccc'}
                />
                <Text
                  style={[
                    styles.funcText,
                    mode === 'doodle' && styles.funcTextActive,
                  ]}
                >
                  涂画
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.funcBtn}
                onPress={async () => {
                  if (mode !== 'text') {
                    // 切到文字模式，useEffect 会在初次进入时自动弹输入框
                    await switchToMode('text');
                  } else {
                    // 已在文字模式，再次点击直接弹出添加输入框
                    textRef.current?.addText();
                  }
                }}
              >
                <Ionicons
                  name="text-outline"
                  size={22}
                  color={mode === 'text' ? '#ff2442' : '#ccc'}
                />
                <Text
                  style={[
                    styles.funcText,
                    mode === 'text' && styles.funcTextActive,
                  ]}
                >
                  文字
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.funcBtn}
                onPress={() => switchToMode('crop')}
              >
                <Ionicons
                  name="crop"
                  size={22}
                  color={mode === 'crop' ? '#ff2442' : '#ccc'}
                />
                <Text
                  style={[
                    styles.funcText,
                    mode === 'crop' && styles.funcTextActive,
                  ]}
                >
                  裁剪
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.funcBtn}
                onPress={() => switchToMode('mosaic')}
              >
                <Ionicons
                  name="grid"
                  size={22}
                  color={mode === 'mosaic' ? '#ff2442' : '#ccc'}
                />
                <Text
                  style={[
                    styles.funcText,
                    mode === 'mosaic' && styles.funcTextActive,
                  ]}
                >
                  马赛克
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.funcBtn, styles.funcDone]}
                onPress={handleDone}
                disabled={processing}
              >
                <Text style={styles.funcDoneText}>完成</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.funcBarCollapsed}>
              <TouchableOpacity
                style={styles.editEntryBtn}
                onPress={() => setToolsExpanded(true)}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.editEntryText}>编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.funcBtn, styles.funcDone]}
                onPress={handleDone}
                disabled={processing}
              >
                <Text style={styles.funcDoneText}>完成</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>

        {/* 屏幕底部的删除区域，长按拖动缩略图时出现 */}
        <View
          ref={deleteBarRef}
          pointerEvents="none"
          style={[
            styles.screenDeleteBar,
            !dragState.dragging && styles.screenDeleteBarHidden,
            dragState.overDelete && styles.screenDeleteBarActive,
          ]}
        >
          <Ionicons
            name={dragState.overDelete ? 'trash' : 'trash-outline'}
            size={22}
            color="#fff"
          />
          <Text style={styles.screenDeleteText}>
            {dragState.overDelete ? '松开删除' : '删除'}
          </Text>
        </View>
    </Animated.View>
  );
}

// 马赛克格式按钮的 icon：
// - pixel 类：用小方格/圆点网格表示颗粒度
// - text 类：显示一个小色块 + 首字
function MosaicKindIcon({
  kind,
  active,
}: {
  kind: MosaicKindConfig;
  active: boolean;
}) {
  const color = active ? '#111' : '#fff';
  if (kind.type === 'pixel') {
    if (kind.id === 'block') {
      return <GridIcon rows={3} cols={3} color={color} round={false} />;
    }
    if (kind.id === 'blur') {
      return <GridIcon rows={3} cols={3} color={color} round />;
    }
    // coarse
    return <GridIcon rows={2} cols={2} color={color} round={false} />;
  }
  // text：始终显示真实配色（白底 + 主题色字），以体现"文字贴纸"风格
  // 由于背景为白色，与选中态按钮白底会融合，加细边框区分
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        backgroundColor: kind.bgColor,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: kind.textColor,
          fontSize: 12,
          fontWeight: '800',
          lineHeight: 14,
        }}
      >
        {kind.iconChar}
      </Text>
    </View>
  );
}

function GridIcon({
  rows,
  cols,
  color,
  round,
}: {
  rows: number;
  cols: number;
  color: string;
  round: boolean;
}) {
  const size = 22;
  const gap = 2;
  const cellW = (size - gap * (cols - 1)) / cols;
  const cellH = (size - gap * (rows - 1)) / rows;
  const items = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            left: c * (cellW + gap),
            top: r * (cellH + gap),
            width: cellW,
            height: cellH,
            backgroundColor: color,
            borderRadius: round ? Math.max(cellW, cellH) / 2 : 1.5,
          }}
        />
      );
    }
  }
  return <View style={{ width: size, height: size }}>{items}</View>;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 100,
    elevation: 100,
  },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
  },
  headerBtn: {
    color: '#fff',
    fontSize: 15,
    minWidth: 40,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 70,
    justifyContent: 'flex-end',
  },
  headerIconBtn: {
    marginLeft: 14,
  },
  canvas: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  baseImage: {
    ...StyleSheet.absoluteFillObject,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subToolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(10,10,10,0.8)',
  },
  subDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: '#333',
    marginHorizontal: 10,
  },
  colorScroll: {
    flex: 1,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    paddingVertical: 6,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#444',
  },
  colorDotActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sizeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    marginHorizontal: 3,
  },
  sizeBtnActive: {
    backgroundColor: '#444',
    borderWidth: 1,
    borderColor: '#fff',
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  kindBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 3,
  },
  kindBtnActive: {
    backgroundColor: '#fff',
  },
  addTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#ff2442',
  },
  addTextBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  funcBar: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    backgroundColor: '#0a0a0a',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222',
  },
  funcBarCollapsed: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#0a0a0a',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222',
  },
  editEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#2c2c2e',
  },
  editEntryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  funcBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 48,
  },
  funcText: {
    color: '#ccc',
    fontSize: 11,
    marginTop: 3,
  },
  funcTextActive: {
    color: '#ff2442',
    fontWeight: '600',
  },
  funcDone: {
    backgroundColor: '#ff2442',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 64,
  },
  funcDoneText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  screenDeleteBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 34 : 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8a1c2a',
    zIndex: 999,
    elevation: 12,
  },
  screenDeleteBarHidden: {
    opacity: 0,
    transform: [{ translateY: 80 }],
  },
  screenDeleteBarActive: {
    backgroundColor: '#ff2442',
  },
  screenDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

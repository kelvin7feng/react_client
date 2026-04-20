import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import type { Rect, TextItem, TextStyleKind } from './types';
import { TEXT_COLORS, TEXT_STYLES, TEXT_FONT_SIZES } from './types';

export type TextCanvasHandle = {
  apply: () => Promise<string>;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  addText: () => void;
  setColor: (c: string) => void;
  setFontSize: (s: number) => void;
  hasEdits: () => boolean;
};

type Props = {
  uri: string;
  initialColor?: string;
  initialFontSize?: number;
  onStateChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
};

const TextCanvas = forwardRef<TextCanvasHandle, Props>(
  (
    { uri, initialColor = '#FFFFFF', initialFontSize = 24, onStateChange },
    ref
  ) => {
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(
      null
    );
    const [container, setContainer] = useState<{ w: number; h: number } | null>(
      null
    );
    const [items, setItems] = useState<TextItem[]>([]);
    const [undoStack, setUndoStack] = useState<TextItem[][]>([]);
    const [redoStack, setRedoStack] = useState<TextItem[][]>([]);
    const [color, setColorState] = useState(initialColor);
    const [fontSize, setFontSizeState] = useState(initialFontSize);
    const [textStyle, setTextStyleState] = useState<TextStyleKind>('normal');

    const [inputVisible, setInputVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    // 长按激活的文字 id（显示右上角 × 删除按钮）；截图时置空
    const [activeTextId, setActiveTextId] = useState<string | null>(null);
    // 截图时为 true：隐藏矩形框 / 删除按钮等辅助 UI，避免被 captureRef 捕获
    const [capturing, setCapturing] = useState(false);

    const captureViewRef = useRef<View>(null);
    const itemsRef = useRef(items);

    useEffect(() => {
      itemsRef.current = items;
    }, [items]);

    useEffect(() => {
      onStateChange?.({
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      });
    }, [undoStack.length, redoStack.length, onStateChange]);

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

    const pushHistory = useCallback(() => {
      setUndoStack((prev) => [...prev, itemsRef.current]);
      setRedoStack([]);
    }, []);

    const commitAdd = useCallback(
      (text: string) => {
        if (!imgBox) return;
        pushHistory();
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newItem: TextItem = {
          id,
          text,
          x: imgBox.width / 2 - text.length * fontSize * 0.3,
          y: imgBox.height / 2 - fontSize,
          color,
          fontSize,
          style: textStyle,
        };
        setItems((prev) => [...prev, newItem]);
      },
      [color, fontSize, textStyle, imgBox, pushHistory]
    );

    const commitUpdate = useCallback(
      (
        id: string,
        text: string,
        nextColor?: string,
        nextStyle?: TextStyleKind,
        nextFontSize?: number
      ) => {
        pushHistory();
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  text,
                  ...(nextColor !== undefined ? { color: nextColor } : {}),
                  ...(nextStyle !== undefined ? { style: nextStyle } : {}),
                  ...(nextFontSize !== undefined
                    ? { fontSize: nextFontSize }
                    : {}),
                }
              : it
          )
        );
      },
      [pushHistory]
    );

    const commitDelete = useCallback(
      (id: string) => {
        pushHistory();
        setItems((prev) => prev.filter((it) => it.id !== id));
      },
      [pushHistory]
    );

    const moveItem = useCallback((id: string, x: number, y: number) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, x, y } : it))
      );
    }, []);

    const beginMove = useCallback(() => {
      pushHistory();
    }, [pushHistory]);

    const handleInputConfirm = () => {
      const text = inputValue.trim();
      if (editingId) {
        if (!text) {
          commitDelete(editingId);
        } else {
          // 编辑时把当前选中的颜色/样式/字号一并应用到该文字
          commitUpdate(editingId, text, color, textStyle, fontSize);
        }
      } else {
        if (text) commitAdd(text);
      }
      setInputVisible(false);
      setInputValue('');
      setEditingId(null);
    };

    const cycleTextStyle = () => {
      const idx = TEXT_STYLES.indexOf(textStyle);
      const next = TEXT_STYLES[(idx + 1) % TEXT_STYLES.length];
      setTextStyleState(next);
    };

    const cycleFontSize = () => {
      const idx = TEXT_FONT_SIZES.indexOf(fontSize);
      const nextIdx =
        idx < 0 ? 0 : (idx + 1) % TEXT_FONT_SIZES.length;
      setFontSizeState(TEXT_FONT_SIZES[nextIdx]);
    };

    const handleInputDelete = () => {
      if (editingId) commitDelete(editingId);
      setInputVisible(false);
      setInputValue('');
      setEditingId(null);
    };

    const openAdd = () => {
      setEditingId(null);
      setInputValue('');
      setInputVisible(true);
    };

    const openEdit = (id: string) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it) return;
      setActiveTextId(null);
      setEditingId(id);
      setInputValue(it.text);
      // 进入编辑时，同步当前文字的颜色/字号/样式到 Modal 内的预览与选中态
      setColorState(it.color);
      setFontSizeState(it.fontSize);
      setTextStyleState(it.style);
      setInputVisible(true);
    };

    useImperativeHandle(
      ref,
      () => ({
        async apply() {
          if (items.length === 0) return uri;
          if (!captureViewRef.current) return uri;
          // 截图前清除激活态与矩形辅助框，保证最终图片干净
          setActiveTextId(null);
          setCapturing(true);
          // 等待一帧让 UI 重新渲染（Pressable/外框被隐藏）
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve())
          );
          try {
            const result = await captureRef(captureViewRef, {
              format: 'jpg',
              quality: 0.9,
              result: 'tmpfile',
            });
            return result;
          } catch {
            return uri;
          } finally {
            setCapturing(false);
          }
        },
        undo() {
          setUndoStack((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setRedoStack((r) => [...r, itemsRef.current]);
            setItems(last);
            return prev.slice(0, -1);
          });
        },
        redo() {
          setRedoStack((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setUndoStack((u) => [...u, itemsRef.current]);
            setItems(last);
            return prev.slice(0, -1);
          });
        },
        reset() {
          setItems([]);
          setUndoStack([]);
          setRedoStack([]);
        },
        addText() {
          openAdd();
        },
        setColor(c) {
          setColorState(c);
        },
        setFontSize(s) {
          setFontSizeState(s);
        },
        hasEdits() {
          return items.length > 0;
        },
      }),
      [uri, items]
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
            {/* 点击图片空白处取消文字激活态 */}
            {!capturing ? (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setActiveTextId(null)}
              />
            ) : null}
            {items.map((it) => (
              <DraggableText
                key={it.id}
                item={it}
                boundsW={imgBox.width}
                boundsH={imgBox.height}
                active={!capturing && activeTextId === it.id}
                showFrame={!capturing}
                onTap={openEdit}
                onLongPress={(id) => setActiveTextId(id)}
                onBeginMove={beginMove}
                onMove={moveItem}
                onDelete={(id) => {
                  setActiveTextId(null);
                  commitDelete(id);
                }}
              />
            ))}
          </View>
        ) : null}

        <Modal
          visible={inputVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setInputVisible(false)}
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalBackdrop}>
              {/* 顶部栏：编辑模式下右侧提供删除；新增文字时不渲染任何按钮 */}
              <View style={styles.modalTopBar}>
                {editingId ? (
                  <TouchableOpacity
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={handleInputDelete}
                  >
                    <Text style={[styles.modalTopBtn, { color: '#ff6b6b' }]}>
                      删除
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* 中间留白，点击可取消 */}
              <TouchableOpacity
                activeOpacity={1}
                style={styles.modalMiddle}
                onPress={() => {
                  setInputVisible(false);
                  setInputValue('');
                  setEditingId(null);
                }}
              />

              {/* 底部：输入框 +（T 样式 / 字号 / 颜色列表 / 完成）一行 */}
              <View style={styles.inputBar}>
                <TextPreviewInput
                  value={inputValue}
                  onChangeText={setInputValue}
                  color={color}
                  kind={textStyle}
                  fontSize={fontSize}
                />
                <View style={styles.bottomRow}>
                  <TouchableOpacity
                    onPress={cycleTextStyle}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.styleBtn}
                    accessibilityLabel="切换文字样式"
                  >
                    <StyleIcon kind={textStyle} color={color} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={cycleFontSize}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.sizeBtn}
                    accessibilityLabel="切换文字大小"
                  >
                    <FontSizeIcon size={fontSize} />
                  </TouchableOpacity>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.colorBar}
                    contentContainerStyle={styles.colorBarContent}
                    keyboardShouldPersistTaps="always"
                  >
                    {TEXT_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setColorState(c)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        style={styles.colorDotTouch}
                      >
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: c },
                            color === c && styles.colorDotActive,
                          ]}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={handleInputConfirm}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.doneBtn}
                  >
                    <Text style={styles.doneBtnText}>完成</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }
);

TextCanvas.displayName = 'TextCanvas';

export default TextCanvas;

type DraggableTextProps = {
  item: TextItem;
  boundsW: number;
  boundsH: number;
  active: boolean;
  showFrame: boolean;
  onTap: (id: string) => void;
  onLongPress: (id: string) => void;
  onBeginMove: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
};

function DraggableText({
  item,
  boundsW,
  boundsH,
  active,
  showFrame,
  onTap,
  onLongPress,
  onBeginMove,
  onMove,
  onDelete,
}: DraggableTextProps) {
  // UI 线程上持有的位置，拖动过程直接驱动 transform，避免 JS 线程抖动
  const tx = useSharedValue(item.x);
  const ty = useSharedValue(item.y);
  const startX = useSharedValue(item.x);
  const startY = useSharedValue(item.y);
  const moved = useSharedValue(false);
  const longPressed = useSharedValue(false);

  // 外部更新 item（如撤销/重做/手动编辑）时，同步到 shared value
  useEffect(() => {
    tx.value = item.x;
    ty.value = item.y;
  }, [item.x, item.y, tx, ty]);

  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(0)
      .onBegin(() => {
        'worklet';
        startX.value = tx.value;
        startY.value = ty.value;
        moved.value = false;
        longPressed.value = false;
      })
      .onUpdate((e) => {
        'worklet';
        const dx = e.translationX;
        const dy = e.translationY;
        if (!moved.value && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
          moved.value = true;
          runOnJS(onBeginMove)(item.id);
        }
        if (moved.value) {
          const nx = Math.max(-40, Math.min(boundsW - 10, startX.value + dx));
          const ny = Math.max(-10, Math.min(boundsH - 10, startY.value + dy));
          tx.value = nx;
          ty.value = ny;
        }
      })
      .onEnd(() => {
        'worklet';
        if (moved.value) {
          runOnJS(onMove)(item.id, tx.value, ty.value);
        } else if (!longPressed.value) {
          runOnJS(onTap)(item.id);
        }
      });

    const longPress = Gesture.LongPress()
      .minDuration(350)
      .onStart(() => {
        'worklet';
        longPressed.value = true;
        runOnJS(onLongPress)(item.id);
      });

    return Gesture.Simultaneous(pan, longPress);
  }, [
    item.id,
    boundsW,
    boundsH,
    onTap,
    onLongPress,
    onBeginMove,
    onMove,
    tx,
    ty,
    startX,
    startY,
    moved,
    longPressed,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const wrapStyle = getWrapStyleForKind(item.style, item.color);
  const textColor = getTextColorForKind(item.style, item.color);
  const textExtra = getTextExtraForKind(item.style, item.color);

  // 辅助矩形框：截图时不显示
  const frameStyle = showFrame ? styles.textFrame : null;
  const frameActiveStyle = showFrame && active ? styles.textFrameActive : null;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.textWrap, animatedStyle]}>
        <View style={[styles.textInner, wrapStyle, frameStyle, frameActiveStyle]}>
          <Text
            style={[
              styles.textContent,
              {
                color: textColor,
                fontSize: item.fontSize,
              },
              textExtra,
            ]}
          >
            {item.text}
          </Text>
        </View>
        {showFrame && active ? (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="删除该文字"
          >
            <Text style={styles.deleteBtnText}>×</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

// 文字样式相关的工具与子组件
function getContrastText(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // 使用相对亮度，阈值 0.6
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000' : '#fff';
}

function getWrapStyleForKind(kind: TextStyleKind, color: string) {
  if (kind === 'filled') {
    return {
      backgroundColor: color,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    } as const;
  }
  if (kind === 'outlined') {
    // 半透明深色底 + 圆角，突出可读性，并和 normal 明显区分
    return {
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    } as const;
  }
  return null;
}

function getTextColorForKind(kind: TextStyleKind, color: string) {
  if (kind === 'filled') return getContrastText(color);
  return color;
}

function getTextExtraForKind(kind: TextStyleKind, _color: string) {
  if (kind === 'outlined') {
    // 有半透明底兜底，去掉阴影
    return {
      textShadowColor: 'transparent',
      textShadowRadius: 0,
    } as const;
  }
  if (kind === 'filled') {
    return {
      textShadowColor: 'transparent',
      textShadowRadius: 0,
    } as const;
  }
  return null;
}

type StyleIconProps = { kind: TextStyleKind; color: string };
function StyleIcon({ kind, color }: StyleIconProps) {
  if (kind === 'filled') {
    return (
      <View style={[styles.styleIconBox, { backgroundColor: color }]}>
        <Text style={[styles.styleIconText, { color: getContrastText(color) }]}>
          T
        </Text>
      </View>
    );
  }
  if (kind === 'outlined') {
    return (
      <View
        style={[
          styles.styleIconBox,
          { backgroundColor: 'rgba(0,0,0,0.6)' },
        ]}
      >
        <Text style={[styles.styleIconText, { color }]}>T</Text>
      </View>
    );
  }
  return (
    <View style={styles.styleIconBox}>
      <Text style={[styles.styleIconText, { color }]}>T</Text>
    </View>
  );
}

type TextPreviewInputProps = {
  value: string;
  onChangeText: (t: string) => void;
  color: string;
  kind: TextStyleKind;
  fontSize: number;
};
function TextPreviewInput({
  value,
  onChangeText,
  color,
  kind,
  fontSize,
}: TextPreviewInputProps) {
  const wrapStyle =
    kind === 'filled'
      ? {
          backgroundColor: color,
          borderRadius: 8,
          alignSelf: 'flex-start' as const,
        }
      : kind === 'outlined'
        ? {
            backgroundColor: 'rgba(0,0,0,0.45)',
            borderRadius: 8,
            alignSelf: 'flex-start' as const,
          }
        : null;
  const textColor =
    kind === 'filled' ? getContrastText(color) : color;
  const extra =
    kind === 'filled' || kind === 'outlined'
      ? { textShadowColor: 'transparent', textShadowRadius: 0 }
      : null;

  const placeholderColor =
    kind === 'filled'
      ? 'rgba(0,0,0,0.35)'
      : kind === 'outlined'
        ? 'rgba(255,255,255,0.5)'
        : 'rgba(255,255,255,0.5)';

  return (
    <View style={[styles.inputFieldWrap, wrapStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="请输入文字"
        placeholderTextColor={placeholderColor}
        style={[styles.inputField, { color: textColor, fontSize }, extra]}
        autoFocus
        maxLength={60}
        multiline
      />
    </View>
  );
}

// 字号切换按钮的图标：一大一小的"A"字符，体现"点击改变大小"
type FontSizeIconProps = { size: number };
function FontSizeIcon({ size }: FontSizeIconProps) {
  // 把实际字号映射为图标显示用字号（14-22），避免图标过大
  const idx = TEXT_FONT_SIZES.indexOf(size);
  const scale = idx < 0 ? 0 : idx / Math.max(1, TEXT_FONT_SIZES.length - 1);
  const displaySize = 14 + Math.round(scale * 8); // 14 / 18 / 22
  return (
    <View style={styles.sizeIconBox}>
      <Text style={[styles.sizeIconText, { fontSize: displaySize }]}>A</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  textWrap: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  textInner: {
    alignSelf: 'flex-start',
  },
  textFrame: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    borderStyle: 'solid',
    borderRadius: 4,
  },
  textFrameActive: {
    borderColor: '#fff',
    borderWidth: 1.5,
  },
  deleteBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff2442',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: -1,
  },
  textContent: {
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 54 : 18,
    paddingHorizontal: 18,
    paddingBottom: 12,
    minHeight: Platform.OS === 'ios' ? 54 + 24 : 18 + 24,
  },
  modalTopBtn: {
    color: '#fff',
    fontSize: 15,
    minWidth: 40,
  },
  modalMiddle: {
    flex: 1,
  },
  inputBar: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
  },
  inputFieldWrap: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  inputField: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 240,
    textAlignVertical: 'top',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  styleBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  styleIconBox: {
    width: 26,
    height: 26,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleIconText: {
    fontSize: 16,
    fontWeight: '800',
  },
  sizeBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  sizeIconBox: {
    width: 26,
    height: 26,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeIconText: {
    color: '#fff',
    fontWeight: '800',
    lineHeight: 24,
  },
  colorBar: {
    flex: 1,
  },
  colorBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  colorDotTouch: {
    padding: 4,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  colorDotActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },
  doneBtn: {
    marginLeft: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ff2442',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

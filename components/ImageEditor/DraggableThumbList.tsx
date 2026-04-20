import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

const DEFAULT_THUMB_SIZE = 56;
const DEFAULT_THUMB_GAP = 8;
const DEFAULT_LIST_H_PADDING = 12;

type Props = {
  images: string[];
  currentIndex: number;
  onSelect: (i: number) => void;
  onReorder: (from: number, to: number) => void;
  onDelete: (i: number) => void;
  /** 由父组件渲染的删除目标区域 ref，用于命中测试 */
  deleteTargetRef?: RefObject<View | null>;
  /** 拖动状态变化回调 */
  onDragStateChange?: (state: {
    dragging: boolean;
    overDelete: boolean;
  }) => void;
  /** 缩略图尺寸，默认 56。 */
  thumbSize?: number;
  /** 缩略图之间的间距，默认 8。 */
  thumbGap?: number;
  /** 横向内边距，默认 12。 */
  listHorizontalPadding?: number;
  /** 视觉样式，编辑器内默认 dark；发布页可用 light。 */
  variant?: 'dark' | 'light';
  /** 顶部提示文案。传 null 时隐藏。 */
  hintText?: string | null;
  /** 拖动中的提示文案。 */
  draggingHintText?: string;
  /** 额外尾部内容，例如“添加图片”按钮。 */
  trailingContent?: ReactNode;
};

export default function DraggableThumbList({
  images,
  currentIndex,
  onSelect,
  onReorder,
  onDelete,
  deleteTargetRef,
  onDragStateChange,
  thumbSize = DEFAULT_THUMB_SIZE,
  thumbGap = DEFAULT_THUMB_GAP,
  listHorizontalPadding = DEFAULT_LIST_H_PADDING,
  variant = 'dark',
  hintText = '长按图片可拖动排序 / 删除',
  draggingHintText = '拖动中…',
  trailingContent,
}: Props) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overDelete, setOverDelete] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const rootRef = useRef<View>(null);
  const listRef = useRef<View>(null);

  const scrollXRef = useRef(0);
  const listWin = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const deleteWin = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const rootWin = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const dragAbsX = useSharedValue(0);
  const dragAbsY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const rootOffsetX = useSharedValue(0);
  const rootOffsetY = useSharedValue(0);
  const deleteRegion = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });
  const isOverDeleteSV = useSharedValue(false);
  const slotWidth = thumbSize + thumbGap;
  const thumbRadius = Math.max(6, Math.round(thumbSize * 0.1));

  const measureLayouts = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, w, h) => {
      rootWin.current = { x, y, w, h };
      rootOffsetX.value = x;
      rootOffsetY.value = y;
    });
    listRef.current?.measureInWindow((x, y, w, h) => {
      listWin.current = { x, y, w, h };
    });
    deleteTargetRef?.current?.measureInWindow((x, y, w, h) => {
      deleteWin.current = { x, y, w, h };
      deleteRegion.value = { x, y, w, h };
    });
  }, [rootOffsetX, rootOffsetY, deleteRegion, deleteTargetRef]);

  useEffect(() => {
    const t = setTimeout(measureLayouts, 50);
    return () => clearTimeout(t);
  }, [draggingIndex, images.length, measureLayouts]);

  // 将最新的回调收进 ref，避免将不稳定的函数引用放进 useEffect 依赖里。
  // 父组件常常传入内联箭头函数（每次 render 都是新引用），若作为依赖会让本 effect
  // 每次 render 都触发 setDragState → Context 更新 → 父组件再 render → 又传新函数，
  // 从而造成 "Maximum update depth exceeded" 死循环。
  const onDragStateChangeRef = useRef(onDragStateChange);
  useEffect(() => {
    onDragStateChangeRef.current = onDragStateChange;
  }, [onDragStateChange]);

  useEffect(() => {
    onDragStateChangeRef.current?.({
      dragging: draggingIndex !== null,
      overDelete,
    });
  }, [draggingIndex, overDelete]);

  const handleDragEnd = useCallback(
    (i: number, absX: number, absY: number) => {
      if (i < 0) {
        setDraggingIndex(null);
        setOverDelete(false);
        return;
      }
      const del = deleteWin.current;
      const inDelete =
        del.w > 0 &&
        absX >= del.x &&
        absX <= del.x + del.w &&
        absY >= del.y &&
        absY <= del.y + del.h;
      if (inDelete) {
        onDelete(i);
      } else {
        const list = listWin.current;
        if (list.w > 0) {
          const localX =
            absX - list.x + scrollXRef.current - listHorizontalPadding;
          let target = Math.floor(localX / slotWidth);
          target = Math.max(0, Math.min(images.length - 1, target));
          if (target !== i) {
            onReorder(i, target);
          }
        }
      }
      setDraggingIndex(null);
      setOverDelete(false);
    },
    [images.length, listHorizontalPadding, onDelete, onReorder, slotWidth]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollXRef.current = e.nativeEvent.contentOffset.x;
  };

  const renderThumb = (uri: string, i: number) => {
    const pan = Gesture.Pan()
      .activateAfterLongPress(300)
      .onStart((e) => {
        isDragging.value = true;
        dragAbsX.value = e.absoluteX;
        dragAbsY.value = e.absoluteY;
        runOnJS(measureLayouts)();
        runOnJS(setDraggingIndex)(i);
      })
      .onUpdate((e) => {
        dragAbsX.value = e.absoluteX;
        dragAbsY.value = e.absoluteY;
        const r = deleteRegion.value;
        if (r.w > 0) {
          const over =
            e.absoluteX >= r.x &&
            e.absoluteX <= r.x + r.w &&
            e.absoluteY >= r.y &&
            e.absoluteY <= r.y + r.h;
          if (over !== isOverDeleteSV.value) {
            isOverDeleteSV.value = over;
            runOnJS(setOverDelete)(over);
          }
        }
      })
      .onEnd((e) => {
        isDragging.value = false;
        isOverDeleteSV.value = false;
        runOnJS(handleDragEnd)(i, e.absoluteX, e.absoluteY);
      })
      .onFinalize(() => {
        isDragging.value = false;
        isOverDeleteSV.value = false;
      });

    const isActiveDrag = draggingIndex === i;
    const isSelected = currentIndex === i;

    return (
      <GestureDetector key={`${i}-${uri}`} gesture={pan}>
        <View style={[styles.slot, { width: slotWidth }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onSelect(i)}
            style={[
              styles.thumbWrap,
              {
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbRadius,
              },
              isSelected && styles.thumbWrapActive,
              isActiveDrag && styles.thumbWrapDragging,
            ]}
          >
            <Image source={{ uri }} style={styles.thumb} />
          </TouchableOpacity>
        </View>
      </GestureDetector>
    );
  };

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragAbsX.value - rootOffsetX.value - thumbSize / 2 },
      { translateY: dragAbsY.value - rootOffsetY.value - thumbSize / 2 },
      { scale: isDragging.value ? 1.15 : 1 },
    ],
    opacity: isDragging.value ? 1 : 0,
  }));

  const dragging = draggingIndex !== null;

  return (
    <View
      ref={rootRef}
      onLayout={measureLayouts}
      style={[styles.root, variant === 'light' && styles.rootLight]}
      pointerEvents="box-none"
    >
      {hintText ? (
        <View style={styles.hint}>
          <Text
            style={[
              styles.hintText,
              variant === 'light' && styles.hintTextLight,
            ]}
          >
            {dragging ? draggingHintText : hintText}
          </Text>
        </View>
      ) : null}

      <View ref={listRef} onLayout={measureLayouts} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.thumbList,
            { paddingHorizontal: listHorizontalPadding },
          ]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!dragging}
        >
          {images.map((uri, i) => renderThumb(uri, i))}
          {trailingContent}
        </ScrollView>
      </View>

      {dragging ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.floating,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbRadius + 2,
            },
            floatingStyle,
          ]}
        >
          <Image
            source={{ uri: images[draggingIndex!] }}
            style={styles.floatingImage}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#000',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222',
  },
  rootLight: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  hint: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  hintText: {
    color: '#666',
    fontSize: 11,
  },
  hintTextLight: {
    color: '#999',
  },
  thumbList: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  slot: {
    alignItems: 'center',
  },
  thumbWrap: {
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbWrapActive: {
    borderColor: '#ff2442',
  },
  thumbWrapDragging: {
    opacity: 0.25,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  floating: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999,
  },
  floatingImage: {
    width: '100%',
    height: '100%',
  },
});

import {
  createContext,
  Dispatch,
  ReactNode,
  RefObject,
  SetStateAction,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

export type DeleteDragState = {
  dragging: boolean;
  overDelete: boolean;
};

export const DELETE_DRAG_IDLE_STATE: DeleteDragState = {
  dragging: false,
  overDelete: false,
};

type DeleteDragOverlayContextValue = {
  deleteTargetRef: RefObject<View | null>;
  dragState: DeleteDragState;
  setDragState: Dispatch<SetStateAction<DeleteDragState>>;
};

const DeleteDragOverlayContext =
  createContext<DeleteDragOverlayContextValue | null>(null);

export function DeleteDragOverlayProvider({
  children,
}: {
  children: ReactNode;
}) {
  const deleteTargetRef = useRef<View>(null);
  const [dragState, setDragState] =
    useState<DeleteDragState>(DELETE_DRAG_IDLE_STATE);

  const value = useMemo(
    () => ({
      deleteTargetRef,
      dragState,
      setDragState,
    }),
    [dragState]
  );

  return (
    <DeleteDragOverlayContext.Provider value={value}>
      {children}
    </DeleteDragOverlayContext.Provider>
  );
}

export function useDeleteDragOverlay() {
  const ctx = useContext(DeleteDragOverlayContext);
  if (!ctx) {
    throw new Error('useDeleteDragOverlay must be used within provider');
  }
  return ctx;
}

// 发布页底部"存草稿 / 发布"按钮栏的可视高度（padding + button）
// 与 app/(tabs)/publish.tsx 中 styles.footer 的 paddingVertical + 按钮高度保持一致
const PUBLISH_FOOTER_HEIGHT = 53;

export function DeleteDragOverlayHost() {
  const insets = useSafeAreaInsets();
  const { deleteTargetRef, dragState } = useDeleteDragOverlay();

  // 发布页已配置 tabBarStyle: 'none'（全屏覆盖 Tab 栏），
  // 所以删除条只需要覆盖发布页底部的"存草稿 / 发布"按钮栏 + 系统安全区。
  const barHeight = PUBLISH_FOOTER_HEIGHT + insets.bottom;

  return (
    <View
      ref={deleteTargetRef}
      collapsable={false}
      pointerEvents="none"
      style={[
        styles.bar,
        {
          height: barHeight,
          // 让图标+文字视觉上落在"发布按钮"那一行的中心，不被 home indicator / 导航栏挤偏
          paddingBottom: insets.bottom,
        },
        !dragState.dragging && styles.barHidden,
        dragState.overDelete && styles.barActive,
      ]}
    >
      <Ionicons
        name={dragState.overDelete ? 'trash' : 'trash-outline'}
        size={22}
        color="#fff"
      />
      <Text style={styles.text}>
        {dragState.overDelete ? '松开删除' : '删除'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // 条带高度在 Host 里根据 safeArea 动态计算（= Tab 栏 + 发布 footer + inset）
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // 空闲/拖动中（未进入删除区）：醒目的亮红，吸引用户注意
    backgroundColor: '#ff2442',
    zIndex: 999,
    elevation: 12,
  },
  barHidden: {
    opacity: 0,
    // 滑出量 ≥ 条带本身的高度即可，使用一个较大的固定值即可覆盖所有设备
    transform: [{ translateY: 240 }],
  },
  barActive: {
    // 命中"松开删除"时：切换为更深的暗红，给出明确的"即将删除"反馈
    backgroundColor: '#8a1c2a',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

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
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import type { DoodlePath, Rect } from './types';

export type DoodleCanvasHandle = {
  apply: () => Promise<string>;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  setColor: (c: string) => void;
  setBrushSize: (s: number) => void;
  hasEdits: () => boolean;
};

type Props = {
  uri: string;
  initialColor?: string;
  initialSize?: number;
  onStateChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
};

const DoodleCanvas = forwardRef<DoodleCanvasHandle, Props>(
  ({ uri, initialColor = '#FF2442', initialSize = 8, onStateChange }, ref) => {
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(
      null
    );
    const [container, setContainer] = useState<{ w: number; h: number } | null>(
      null
    );
    const [paths, setPaths] = useState<DoodlePath[]>([]);
    const [redoStack, setRedoStack] = useState<DoodlePath[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [color, setColorState] = useState(initialColor);
    const [brushSize, setBrushSizeState] = useState(initialSize);

    const currentPathRef = useRef('');
    const captureViewRef = useRef<View>(null);
    const colorRef = useRef(color);
    const sizeRef = useRef(brushSize);

    useEffect(() => {
      colorRef.current = color;
    }, [color]);
    useEffect(() => {
      sizeRef.current = brushSize;
    }, [brushSize]);

    useEffect(() => {
      onStateChange?.({
        canUndo: paths.length > 0,
        canRedo: redoStack.length > 0,
      });
    }, [paths.length, redoStack.length, onStateChange]);

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

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: (e) => {
            const { locationX, locationY } = e.nativeEvent;
            currentPathRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
            setCurrentPath(currentPathRef.current);
          },
          onPanResponderMove: (e) => {
            const { locationX, locationY } = e.nativeEvent;
            currentPathRef.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
            setCurrentPath(currentPathRef.current);
          },
          onPanResponderRelease: () => {
            const d = currentPathRef.current;
            if (d && d.includes('L')) {
              setPaths((prev) => [
                ...prev,
                { d, color: colorRef.current, size: sizeRef.current },
              ]);
              setRedoStack([]);
            }
            currentPathRef.current = '';
            setCurrentPath('');
          },
          onPanResponderTerminate: () => {
            currentPathRef.current = '';
            setCurrentPath('');
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
        setColor(c) {
          setColorState(c);
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
                {paths.map((p, i) => (
                  <Path
                    key={i}
                    d={p.d}
                    stroke={p.color}
                    strokeWidth={p.size}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
                {currentPath ? (
                  <Path
                    d={currentPath}
                    stroke={color}
                    strokeWidth={brushSize}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ) : null}
              </Svg>
            </View>
          </View>
        ) : null}
      </View>
    );
  }
);

DoodleCanvas.displayName = 'DoodleCanvas';

export default DoodleCanvas;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 透明背景：保留外层 ImageEditor 的持久底图在本组件 Image.getSize 期间可见，避免切换模式时闪烁
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});

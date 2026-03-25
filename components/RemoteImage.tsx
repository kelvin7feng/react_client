import { Image as ExpoImage, type ImageProps } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

export type RemoteImageProps = Omit<ImageProps, 'source'> & {
    uri: string | null | undefined;
    style?: StyleProp<ImageStyle>;
};

/**
 * 网络图片统一走 expo-image：内存 + 磁盘缓存，跨页面重复打开同一 URL 时明显更快。
 */
export function RemoteImage({
    uri,
    style,
    cachePolicy = 'memory-disk',
    ...rest
}: RemoteImageProps) {
    if (uri == null || uri === '') return null;
    return (
        <ExpoImage
            source={{ uri }}
            style={style}
            cachePolicy={cachePolicy}
            {...rest}
        />
    );
}

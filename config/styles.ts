import { StyleSheet, Platform, StatusBar } from 'react-native';

/**
 * 颜色常量
 */
export const Colors = {
  // 背景色
  background: '#f8f9fa',
  backgroundWhite: '#fff',
  backgroundGray: '#f0f0f0',
  backgroundLightGray: '#f9f9f9',
  backgroundDark: '#25292e',
  
  // 主色调
  primary: '#ff2442',
  primaryBlue: '#007AFF',
  
  // 文本颜色
  textPrimary: '#333',
  textSecondary: '#666',
  textTertiary: '#999',
  textDisabled: '#8E8E93',
  
  // 状态颜色
  error: '#FF3B30',
  errorAlt: '#d9534f',
  success: '#34C759',
  warning: '#FF9500',
  
  // 边框颜色
  border: '#f0f0f0',
  borderLight: '#eee',
  borderDark: '#ddd',
  
  // 其他
  white: '#fff',
  black: '#000',
  shadow: '#000',
  overlay: 'rgba(0,0,0,0.5)',
} as const;

/**
 * 间距常量
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

/**
 * 字体大小常量
 */
export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 22,
} as const;

/**
 * 通用阴影样式
 */
export const Shadows = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
} as const;

/**
 * 通用样式
 */
export const CommonStyles = StyleSheet.create({
  // 容器样式
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  containerWhite: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  safeAreaWhite: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  
  // 加载状态样式
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.textDisabled,
  },
  loadingTextSmall: {
    marginTop: Spacing.sm + 2,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.sm + 2,
  },
  loadingMoreText: {
    marginLeft: Spacing.sm + 2,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },
  
  // 错误状态样式
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.sm + 2,
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.error,
  },
  errorTextAlt: {
    fontSize: FontSize.md,
    color: Colors.errorAlt,
    textAlign: 'center',
    marginTop: Spacing.sm + 2,
  },
  errorSubText: {
    marginTop: 5,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
  
  // 按钮样式
  button: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonBlue: {
    backgroundColor: Colors.primaryBlue,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primaryBlue,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Spacing.sm,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  
  // 文本样式
  textPrimary: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  textSecondary: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  textTertiary: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  textTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  textSubtitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  textSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  
  // 卡片样式
  card: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Spacing.sm - 2,
    marginBottom: Spacing.sm,
    ...Shadows.small,
    overflow: 'hidden',
  },
  cardMedium: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Spacing.sm,
    marginBottom: Spacing.sm,
    ...Shadows.medium,
    overflow: 'hidden',
  },
  
  // 分隔线样式
  divider: {
    height: Spacing.sm,
    backgroundColor: Colors.border,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  
  // 空状态样式
  emptyText: {
    color: Colors.textTertiary,
    fontSize: FontSize.md,
  },
  noMoreContainer: {
    padding: Spacing.sm + 2,
    alignItems: 'center',
  },
  noMoreText: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },
});



/**
 * 数字缩写显示：>=10000 用"万"单位，保留 1 位小数
 * 例：9999 → "9999"，10000 → "1.0万"，15000 → "1.5万"，123456 → "12.3万"
 */
export function formatCount(n: number): string {
    if (n < 10000) return String(n);
    return (n / 10000).toFixed(1) + '万';
}

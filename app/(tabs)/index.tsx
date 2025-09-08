import { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';

// 模拟数据
const initialItems = [
  {
    id: 1,
    image: 'https://picsum.photos/300/400?random=1',
    title: '美丽的自然风光',
    author: '摄影师张三',
    likes: 245
  },
  {
    id: 2,
    image: 'https://picsum.photos/300/500?random=2',
    title: '城市夜景城市夜景城市夜景城市夜景',
    author: '摄影师李四',
    likes: 312
  },
  {
    id: 3,
    image: 'https://picsum.photos/300/350?random=3',
    title: '可爱的小猫咪可爱的小猫咪可爱的小猫咪',
    author: '宠物爱好者',
    likes: 567
  },
  {
    id: 4,
    image: 'https://picsum.photos/300/450?random=4',
    title: '美味的美食摄影',
    author: '美食家王五',
    likes: 423
  },
  {
    id: 5,
    image: 'https://picsum.photos/300/300?random=5',
    title: '抽象艺术可爱的小猫咪可爱的小猫咪',
    author: '艺术家赵六',
    likes: 198
  },
  {
    id: 6,
    image: 'https://picsum.photos/300/380?random=6',
    title: '海滩度假',
    author: '旅行者钱七',
    likes: 276
  },
  {
    id: 7,
    image: 'https://picsum.photos/300/420?random=7',
    title: '山脉与云海',
    author: '登山爱好者',
    likes: 389
  },
  {
    id: 8,
    image: 'https://picsum.photos/300/320?random=8',
    title: '复古风格设计',
    author: '设计师孙八',
    likes: 234
  },
  {
    id: 9,
    image: 'https://picsum.photos/300/370?random=9',
    title: '极简主义',
    author: '极简生活',
    likes: 156
  },
  {
    id: 10,
    image: 'https://picsum.photos/300/290?random=10',
    title: '科技与未来',
    author: '科技博主',
    likes: 298
  }
];

// 瀑布流项组件
const WaterfallItem = ({ item }) => {
  return (
    <View style={styles.item}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.footer}>
          <Text style={styles.author}>{item.author}</Text>
          <View style={styles.likesContainer}>
            <Text style={styles.likes}>♡ {item.likes}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function Index() {
  const splitIntoColumns = (items, numColumns = 2) => {
    const columns = Array.from({ length: numColumns }, () => []);
    items.forEach((item, index) => {
      columns[index % numColumns].push(item);
    });
    return columns;
  };

  const columns = splitIntoColumns(initialItems);

  return (
    <View style={styles.container}>
      {/* 新添加的标题栏 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Feather name="menu" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>推荐</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.columnsContainer}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {column.map(item => (
                <WaterfallItem key={item.id} item={item} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center', // 保证标题文本居中
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 50, // 设置一个固定高度
  },
  headerTitle: {
    fontSize: 20,
    textAlign: 'center',
    flex: 1, // 使得文本在除按钮外的空间中居中
  },
  menuButton: {
    position: 'absolute',
    left: 10,
    top: 13, // 根据需要调整确保垂直居中
  },
  searchButton: {
    position: 'absolute',
    right: 10,
    top: 13, // 根据需要调整确保垂直居中
  },
  scrollView: {
    flex: 1
  },
  columnsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginTop: 5
  },
  column: {
    flex: 1,
    marginHorizontal: 3
  },
  item: {
    backgroundColor: 'white',
    borderRadius: 6,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: undefined,
    aspectRatio: 3 / 4,
    resizeMode: 'cover',
  },
  content: {
    padding: 8
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  author: {
    fontSize: 12,
    color: '#666'
  },
  likesContainer: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  likes: {
    fontSize: 12,
    color: 'black',
    fontWeight: '300'
  }
});
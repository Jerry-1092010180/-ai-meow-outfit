/** Generate mock outfits.json from items.json */
const fs = require('fs');
const path = require('path');

const items = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../public/mock/data/items.json'),
    'utf-8'
  )
);

const moods = ['happy', 'calm', 'energetic', 'chill', 'romantic', 'confident'];
const seasons = ['spring', 'summer', 'autumn', 'winter'];
const conditions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
const cities = ['杭州', '宁波'];

const moodNames = {
  happy: '元气满满', calm: '悠然自得', energetic: '活力四射',
  chill: '慵懒随性', romantic: '温柔浪漫', confident: '气场全开',
};

const seasonNames = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

const outfitTemplates = [
  { name: '初夏微风通勤装', mood: 'happy', season: 'summer', tags: ['通勤', '简约', '初夏'] },
  { name: '浪漫约会晚装', mood: 'romantic', season: 'spring', tags: ['约会', '甜美', '春日'] },
  { name: '街头潮人套装', mood: 'confident', season: 'autumn', tags: ['街头', '潮流', '个性'] },
  { name: '慵懒周末休闲装', mood: 'chill', season: 'spring', tags: ['休闲', '慵懒', '周末'] },
  { name: '商务通勤精英范', mood: 'calm', season: 'autumn', tags: ['通勤', '商务', '极简'] },
  { name: '元气运动套装', mood: 'energetic', season: 'summer', tags: ['运动', '活力', '夏日'] },
  { name: '韩系温柔风穿搭', mood: 'calm', season: 'spring', tags: ['韩系', '温柔', '清新'] },
  { name: '复古文艺学院风', mood: 'happy', season: 'autumn', tags: ['复古', '学院', '文艺'] },
  { name: '派对焦点闪亮装', mood: 'confident', season: 'winter', tags: ['派对', '闪耀', '性感'] },
  { name: '冬日暖阳温馨装', mood: 'calm', season: 'winter', tags: ['冬日', '温暖', '舒适'] },
  { name: '面试战袍精英装', mood: 'confident', season: 'spring', tags: ['面试', '职场', '干练'] },
  { name: '夏日清凉度假风', mood: 'chill', season: 'summer', tags: ['度假', '清凉', '波西米亚'] },
  { name: '极简主义高级感', mood: 'calm', season: 'winter', tags: ['极简', '高级', '质感'] },
  { name: '甜美约会樱花装', mood: 'romantic', season: 'spring', tags: ['约会', '甜美', '樱花'] },
  { name: '户外露营探险装', mood: 'energetic', season: 'autumn', tags: ['户外', '机能', '探险'] },
];

const descriptions = {
  happy: '这套穿搭用明亮的色彩传递愉悦心情，让你在每个转角都自带光芒。轻盈的面料与精致的剪裁相得益彰，就像阳光洒在银泰门店的橱窗上。',
  calm: '简约而不简单，这套穿搭以柔和色调和流畅线条，营造出令人心安的舒适感。在忙碌都市中，给自己留一份从容。',
  energetic: '充满活力的搭配让你随时准备出发！机能面料与动感设计碰撞，无论是逛街还是运动，都让你能量满满。',
  chill: '慵懒不等于随便。这套穿搭用宽松廓形和亲肤面料，打造出「刚刚好」的松弛感，周末就该这样穿。',
  romantic: '蕾丝、荷叶边、柔和色调……这套穿搭仿佛从韩剧里走出来。穿上它，每一步都是心动的感觉。',
  confident: '气场全开！利落的线条、挺括的版型、点睛的配饰，这套穿搭让你在人群中自带主角光环。',
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const outfits = outfitTemplates.map((template, idx) => {
  const outfitId = `outfit-${String(idx + 1).padStart(2, '0')}`;
  const mood = template.mood;
  const season = template.season;
  const condition = pickRandom(conditions.filter(c => {
    if (season === 'summer') return ['sunny', 'cloudy', 'rainy'].includes(c);
    if (season === 'winter') return ['cloudy', 'snowy', 'windy'].includes(c);
    return true;
  }));
  const temp = season === 'summer' ? 28 + Math.floor(Math.random() * 8)
    : season === 'winter' ? -2 + Math.floor(Math.random() * 10)
    : 15 + Math.floor(Math.random() * 12);

  // Pick 5 items from different categories
  const categories = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];
  const pickedItems = [];
  const usedCats = new Set();
  for (const cat of categories) {
    const catItems = items.filter(i => i.category === cat && !usedCats.has(cat));
    if (catItems.length > 0) {
      pickedItems.push(pickRandom(catItems));
      usedCats.add(cat);
    }
    if (pickedItems.length >= 5) break;
  }

  const pieces = pickedItems.map(item => ({
    type: item.category,
    name: item.name,
    description: item.description,
    color: item.colors[0] || '#333',
    material: '精选面料',
    storeItemId: item.id,
  }));

  const linkedItems = pickedItems.slice(0, 4).map(item => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    price: item.price,
    imageUrl: item.imageUrl,
    storeId: item.storeId,
    storeName: item.storeName,
  }));

  return {
    id: outfitId,
    date: `2026-07-${String(idx + 1).padStart(2, '0')}`,
    name: template.name,
    mood,
    weather: {
      temperature: temp,
      condition,
      city: pickRandom(cities),
      season,
      humidity: 45 + Math.floor(Math.random() * 40),
    },
    pieces,
    styleDescription: descriptions[mood],
    sceneImage: `https://picsum.photos/seed/outfit-${idx + 1}/600/800`,
    linkedItems,
    styleScore: 75 + Math.floor(Math.random() * 23),
    tags: template.tags,
    createdAt: new Date(2026, 6, idx + 1).toISOString(),
  };
});

fs.writeFileSync(
  path.join(__dirname, '../public/mock/data/outfits.json'),
  JSON.stringify(outfits, null, 2)
);

console.log(`Generated ${outfits.length} outfits`);

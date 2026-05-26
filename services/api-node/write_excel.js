import * as XLSX from 'xlsx';
import path from 'path';

const filePath = '/Users/bytedance/trae_vibecoding/单词测评用户报告.xlsx';

// Try to read existing file if it exists, otherwise create a new workbook
let wb;
try {
  wb = XLSX.readFile(filePath);
} catch (e) {
  wb = XLSX.utils.book_new();
}

const data = [
  ["功能/用例", "描述"],
  ["用户账号与安全", "支持用户注册、登录，采用 JWT 鉴权，密码经 bcrypt 加盐哈希加密后持久化存储于 SQLite 数据库中。"],
  ["词库管理与权威定级", "支持解析多格式 Excel 题库并热更新。内置 1 万高频词表，为词库中所有词汇动态打上真实的 CEFR（A1-C2）难度等级标签。"],
  ["IRT 自适应评估引擎 (CAT)", "基于 3PL 极大似然估计 (MLE) 的底层算法。每次作答后实时计算能力值 (Theta)，动态推送难度匹配的题目。包含防瞎蒙判定（极速答对不计权重）和提前收敛机制（评估标准误 < 0.35 自动结束）。"],
  ["智能干扰项生成", "在生成单选题时，利用编辑距离（Levenshtein Distance）与词性（POS）匹配算法，实时找出拼写最相似、词性相同的干扰词，提高测试的区分度与防作弊能力。"],
  ["专业多维分析报告", "结算页提供符合学段天花板约束的预估词汇量及 CEFR 定性评语。内置 6 轴雷达图，从高/中/低频词及名/动/形副词六个维度深度解剖用户能力结构。"],
  ["艾宾浩斯长效记忆 (SRS)", "错题自动进入 Box-level 调度池。按照 1天、3天、7天、15天等遗忘曲线规律推送至“每日复习”队列，答错降级，答对晋级，形成闭环学习。"],
  ["词典查询与 TTS 发音", "集成外部词典 API 提供单词的真实语境例句。全局接入 Web Speech API，在答题、查词、复习场景下均支持标准英/美音朗读。"],
  ["异步天梯榜与成长轨迹", "内置分学段（小学/初中/高中）的全服排行榜，激发社交竞争。历史记录页包含由 ECharts 驱动的词汇量成长折线图，直观展示长期进步轨迹。"],
  ["高品质动效与 UI 质感", "前端基于 React + TailwindCSS + GSAP 构建。包含答题卡片 3D 翻转入场、选项交错滑入、丝滑的缩放及对错颜色反馈。底层注入高级噪点材质 (Noise Texture) 与环境光晕 (Ambient Glows)。"]
];

const ws = XLSX.utils.aoa_to_sheet(data);
// Set column widths for better readability
ws['!cols'] = [
  { wch: 25 }, // 功能/用例
  { wch: 100 } // 描述
];

// Replace or append sheet
if (wb.SheetNames.includes("Sheet1")) {
  wb.Sheets["Sheet1"] = ws;
} else if (wb.SheetNames.includes("功能描述")) {
  wb.Sheets["功能描述"] = ws;
} else {
  XLSX.utils.book_append_sheet(wb, ws, "功能描述");
}

XLSX.writeFile(wb, filePath);
console.log("Excel file generated successfully!");

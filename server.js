const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 存储IP访问时间，简单限流
const ipRecord = new Map();
const LIMIT_SECOND = 60;

app.post('/api/generate', async (req, res) => {
  try {
    const clientIp = req.ip;
    const now = Date.now();
    // 限流判断
    if (ipRecord.has(clientIp)) {
      const lastTime = ipRecord.get(clientIp);
      if (now - lastTime < LIMIT_SECOND * 1000) {
        return res.status(429).json({ error: "操作太频繁，请等待1分钟后再试" });
      }
    }
    ipRecord.set(clientIp, now);

    const { courseType, grade, wordCount, hotTopic, style } = req.body;
    if (!courseType || !grade || !wordCount || !hotTopic || !style) {
      return res.status(400).json({ error: "参数不全" });
    }

    // 火山方舟配置（部署时放到环境变量，不要写死在代码里）
    const API_KEY = process.env.ARK_API_KEY;
    const MODEL_ID = process.env.ARK_MODEL_ID;
    if (!API_KEY || !MODEL_ID) {
      return res.status(500).json({ error: "服务密钥未配置" });
    }

    const prompt = `
你现在是教培行业专业文案师，专门写面向小学生家长的课程招生营销文案。
要求：
课程：${courseType}
面向年级：${grade}
字数要求：${wordCount}
营销场景热点：${hotTopic}
文案风格：${style}
规则：
1. 目标人群是小学生家长，语言接地气，不要太官方生硬；
2. 不要写联系方式、校区地址、价格；
3. 不要夸大、不做保分承诺，符合教培宣传规范；
4. 直接输出文案正文，不要多余解释、标题备注，不要分点；
5. 贴合家长痛点，吸引家长咨询报名。
    `;

    const resp = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: MODEL_ID,
        messages: [
          { role: "system", content: "你是专业教培招生文案撰写专家，严格遵守用户参数生成文案，不违规宣传。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.8
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );
    res.json(resp.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({
      error: e.response?.data?.error?.message || e.message
    });
  }
});

app.listen(port, () => {
  console.log(`服务启动`);
});

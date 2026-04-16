/**
 * AI对话服务模块
 * 支持多种AI模型：本地规则引擎、通义千问、智谱GLM、硅基流动、自定义API
 */

class AIService {
    constructor() {
        this.provider = 'local'; // 默认使用本地规则引擎
        this.apiKey = null;
        this.apiUrl = null;
        this.config = {};
        this.model = 'Qwen/Qwen2.5-7B-Instruct'; // 硅基流动默认模型
    }

    /**
     * 设置AI服务配置
     * @param {object} config - 配置对象
     */
    setConfig(config) {
        this.provider = config.provider || 'local';
        this.apiKey = config.apiKey;
        this.apiUrl = config.apiUrl;
        this.model = config.model || 'Qwen/Qwen2.5-7B-Instruct';

        if (this.provider === 'qwen') {
            this.apiUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        } else if (this.provider === 'zhipu') {
            this.apiUrl = 'https://open.bigmodel.cn/api/paas/v3/model-api/chatglm_pro/invoke';
        } else if (this.provider === 'siliconflow') {
            this.apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        }

        console.log('AI服务配置已更新:', this.provider, '模型:', this.model);
    }

    /**
     * 处理用户输入，解析意图并生成响应
     * @param {string} userInput - 用户输入的自然语言
     * @param {object} context - 上下文信息（当前位置、历史查询等）
     * @returns {Promise<object>} 解析结果和响应
     */
    async processInput(userInput, context = {}) {
        console.log('处理用户输入:', userInput);

        switch (this.provider) {
            case 'local':
                return this.processLocal(userInput, context);
            case 'qwen':
                return this.processQwen(userInput, context);
            case 'zhipu':
                return this.processZhipu(userInput, context);
            case 'siliconflow':
                return this.processSiliconFlow(userInput, context);
            case 'custom':
                return this.processCustom(userInput, context);
            default:
                return this.processLocal(userInput, context);
        }
    }

    /**
     * 本地规则引擎处理（无需API调用）
     * @param {string} input - 用户输入
     * @param {object} context - 上下文
     * @returns {object} 解析结果
     */
    processLocal(input, context) {
        // 清理输入中的干扰词
        let cleanInput = input.replace(/帮我|请|想要|我想|麻烦/g, '').trim();
        
        // 意图识别规则
        const intents = {
            search_poi: [
                /^找(.+)附近的(.+)$/,        // "找北京西站附近的咖啡馆"
                /^(.+)附近的(.+)$/,          // "北京西站附近的咖啡馆"
                /^附近(.+)$/,                // "附近的美食"
                /^找附近(.+)$/,              // "找附近的美食"
                /^搜索(.+)$/,                // "搜索美食"
                /^查找(.+)$/,                // "查找美食"
                /^周围(.+)$/,                // "周围的餐厅"
                /^周边(.+)$/                 // "周边的酒店"
            ],
            route_planning: [
                /从(.+)到(.+)/,              // "从天安门到故宫"
                /(.+)到(.+)怎么走/,          // "北京西站到故宫怎么走"
                /(.+)怎么去(.+)/,            // "天安门怎么去故宫"
                /^去(.+)怎么走$/,            // "去故宫怎么走"
                /^导航到(.+)$/               // "导航到天安门"
            ],
            recommendation: [
                /^推荐(.+)$/,                // "推荐美食"
                /有什么好的(.+)/,            // "有什么好吃的"
                /哪里有(.+)/,                // "哪里有咖啡馆"
                /人少的(.+)/,                // "人少的公园"
                /最好的(.+)/                 // "最好的餐厅"
            ],
            location_query: [
                /(.+)在哪里/,                // "天安门在哪里"
                /(.+)的位置/,                // "故宫的位置"
                /^定位$/,                    // "定位"
                /^当前位置$/                 // "当前位置"
            ]
        };

        // 意图匹配
        let matchedIntent = null;
        let matchedParams = {};

        for (const [intent, patterns] of Object.entries(intents)) {
            for (const pattern of patterns) {
                const match = cleanInput.match(pattern);
                if (match) {
                    matchedIntent = intent;
                    matchedParams = this.extractParams(intent, match, cleanInput, context);
                    break;
                }
            }
            if (matchedIntent) break;
        }

        // 未匹配到意图时的默认处理
        if (!matchedIntent) {
            matchedIntent = 'search_poi';
            matchedParams = {
                keyword: cleanInput,
                region: context.region || '北京'
            };
        }

        // 生成响应文本
        const response = this.generateResponse(matchedIntent, matchedParams);

        return {
            intent: matchedIntent,
            params: matchedParams,
            response: response,
            confidence: matchedIntent ? 0.8 : 0.5
        };
    }

    /**
     * 从匹配结果中提取参数
     * @param {string} intent - 意图类型
     * @param {array} match - 正则匹配结果
     * @param {object} context - 上下文
     * @returns {object} 提取的参数
     */
    extractParams(intent, match, cleanInput, context) {
        const params = {};

        switch (intent) {
            case 'search_poi':
                // 分析匹配结果
                if (match.length >= 3) {
                    // 格式: "找XX附近的XX" 或 "XX附近的XX"
                    const loc = match[1] ? match[1].trim() : '';
                    const kw = match[2] ? match[2].trim() : '';

                    if (loc === '' || loc === '的') {
                        // "附近的美食" - 没有指定具体位置，使用当前位置
                        params.useCurrentLocation = true;
                        params.keyword = kw.replace(/^的/, ''); // 移除开头的"的"
                    } else {
                        // "北京西站附近的咖啡馆" - 指定了位置
                        params.location = loc;
                        params.keyword = kw;
                    }
                } else if (match.length >= 2) {
                    // 格式: "附近的XX"、"搜索XX"
                    const kw = match[1] ? match[1].trim() : '';
                    params.keyword = kw.replace(/^的/, ''); // 移除可能的"的"
                    params.useCurrentLocation = true;
                }

                // 清理关键词中的"的"
                if (params.keyword) {
                    params.keyword = params.keyword.replace(/^的|的$/g, '').trim();
                }

                // 如果没有地区信息，设置默认地区
                if (!params.region) {
                    params.region = context.region || '北京';
                }
                break;

            case 'route_planning':
                if (match[1] && match[2]) {
                    params.from = match[1].trim();
                    params.to = match[2].trim();
                } else if (match[1]) {
                    params.from = context.currentLocation ? '当前位置' : '我的位置';
                    params.to = match[1].trim();
                }
                break;

            case 'recommendation':
                // 提取核心关键词，去掉修饰词
                let keyword = match[1] ? match[1].trim() : '景点';

                // 常见修饰词列表（包括数量词）
                const modifiers = [
                    '人少的', '好的', '最好的', '好吃的', '好玩的', '便宜的', '高档的', '有名的', '著名的',
                    '几个', '一些', '很多', '附近的', '周边的', '最近的', '最好的', '推荐的'
                ];

                // 移除修饰词
                for (const modifier of modifiers) {
                    keyword = keyword.replace(modifier, '');
                }

                keyword = keyword.trim();

                // 如果关键词为空，设置默认值
                if (!keyword || keyword.length === 0) {
                    keyword = '景点';
                }

                params.keyword = keyword;
                params.region = context.region || '北京';
                params.filters = { feature: 'recommend' };
                break;

            case 'location_query':
                params.keyword = match[1] ? match[1].trim() : '当前位置';
                break;
        }

        return params;
    }

    /**
     * 生成响应文本
     * @param {string} intent - 意图
     * @param {object} params - 参数
     * @returns {string} 响应文本
     */
    generateResponse(intent, params) {
        switch (intent) {
            case 'search_poi':
                if (params.location) {
                    return `好的，正在为您搜索"${params.location}"附近的"${params.keyword}"...`;
                } else {
                    return `正在为您搜索"${params.keyword}"（地区：${params.region || '北京'}）...`;
                }

            case 'route_planning':
                return `正在为您规划从"${params.from}"到"${params.to}"的最佳路线...`;

            case 'recommendation':
                return `正在为您推荐"${params.keyword}"，我会优先推荐评价好、人气高的地点...`;

            case 'location_query':
                return `正在定位"${params.keyword}"的位置...`;

            default:
                return `正在处理您的请求...`;
        }
    }

    /**
     * 通义千问API处理
     * @param {string} input - 用户输入
     * @param {object} context - 上下文
     * @returns {Promise<object>} 解析结果
     */
    async processQwen(input, context) {
        if (!this.apiKey) {
            throw new Error('请配置通义千问API密钥');
        }

        const prompt = this.buildPrompt(input, context);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen-turbo',
                    input: {
                        messages: [
                            {
                                role: 'system',
                                content: '你是地图助手，帮助用户理解他们的地图需求并提取关键信息。'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ]
                    },
                    parameters: {}
                })
            });

            const data = await response.json();
            return this.parseAIResponse(data.output.text, input);
        } catch (error) {
            console.error('通义千问API调用失败:', error);
            return this.processLocal(input, context);
        }
    }

    /**
     * 智谱GLM API处理
     * @param {string} input - 用户输入
     * @param {object} context - 上下文
     * @returns {Promise<object>} 解析结果
     */
    async processZhipu(input, context) {
        if (!this.apiKey) {
            throw new Error('请配置智谱GLM API密钥');
        }

        const prompt = this.buildPrompt(input, context);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    temperature: 0.7
                })
            });

            const data = await response.json();
            return this.parseAIResponse(data.data.content, input);
        } catch (error) {
            console.error('智谱GLM API调用失败:', error);
            return this.processLocal(input, context);
        }
    }

    /**
     * 硅基流动API处理（OpenAI兼容格式）
     * @param {string} input - 用户输入
     * @param {object} context - 上下文
     * @returns {Promise<object>} 解析结果
     */
    async processSiliconFlow(input, context) {
        if (!this.apiKey) {
            throw new Error('请配置硅基流动API密钥');
        }

        const prompt = this.buildPrompt(input, context);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是地图助手，帮助用户理解他们的地图需求并提取关键信息。请以JSON格式返回结果。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`);
            }

            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content || '';
            return this.parseAIResponse(aiResponse, input);
        } catch (error) {
            console.error('硅基流动API调用失败:', error);
            // 回退到本地规则引擎
            return this.processLocal(input, context);
        }
    }

    /**
     * 自定义API处理
     * @param {string} input - 用户输入
     * @param {object} context - 上下文
     * @returns {Promise<object>} 解析结果
     */
    async processCustom(input, context) {
        if (!this.apiKey || !this.apiUrl) {
            throw new Error('请配置自定义API密钥和地址');
        }

        const prompt = this.buildPrompt(input, context);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: prompt
                })
            });

            const data = await response.json();
            return this.parseAIResponse(data.response || data.message, input);
        } catch (error) {
            console.error('自定义API调用失败:', error);
            return this.processLocal(input, context);
        }
    }

    /**
     * 构建AI提示词
     * @param {string} input - 用户输入
     * @param {object} context - 上下文
     * @returns {string} 完整提示词
     */
    buildPrompt(input, context) {
        return `
请分析以下用户关于地图查询的自然语言请求，提取关键信息并以JSON格式返回：

用户输入: "${input}"
上下文信息: ${JSON.stringify(context)}

请返回以下JSON格式：
{
    "intent": "意图类型（search_poi/route_planning/recommendation/location_query）",
    "params": {
        "keyword": "搜索关键词",
        "location": "位置描述",
        "region": "地区",
        "from": "起点",
        "to": "终点"
    },
    "response": "友好的中文响应文本"
}

只返回JSON，不要其他内容。
`;
    }

    /**
     * 解析AI返回的结果
     * @param {string} aiResponse - AI返回的文本
     * @param {string} originalInput - 原始用户输入
     * @returns {object} 解析后的对象
     */
    parseAIResponse(aiResponse, originalInput) {
        try {
            // 提取JSON部分
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    intent: parsed.intent || 'search_poi',
                    params: parsed.params || {},
                    response: parsed.response || '正在处理您的请求...',
                    confidence: 0.9
                };
            }
        } catch (error) {
            console.error('解析AI响应失败:', error);
        }

        // 解析失败，回退到本地规则
        return this.processLocal(originalInput, {});
    }
}

// 创建全局AI服务实例
const aiService = new AIService();
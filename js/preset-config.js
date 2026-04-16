/**
 * 预设API配置
 * 此文件包含已配置的API密钥，用于自动初始化应用
 */

// 可用的AI引擎配置
const AI_PROVIDERS = {
    siliconflow: {
        name: '硅基流动',
        apiKey: 'sk-cryzzyyyjvyttxvgzabmygrupfhzzasoemaybhqqhiphrmbb',
        apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        model: 'Qwen/Qwen2.5-7B-Instruct',
        description: '硅基流动API，支持多种开源大模型'
    },
    qwen: {
        name: '通义千问',
        apiKey: 'sk-ce82545792ca4192b6cb56297aa22848',
        apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        description: '阿里云大模型，理解能力强'
    },
    zhipu: {
        name: '智谱GLM',
        apiKey: '8335d1d1a4b343e6a700388db8a8bfc6.4SXaYmhWma3bie0X',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v3/model-api/chatglm_pro/invoke',
        description: '智谱AI大模型，中文优化'
    },
    local: {
        name: '本地规则引擎',
        apiKey: null,
        apiUrl: null,
        description: '快速免费，适合简单查询'
    }
};

// 预设配置
const PRESET_CONFIG = {
    // 腾讯位置服务API密钥
    tencentMapKey: 'TXABZ-FY2LJ-3QMFX-XGB5X-6Y4LV-RSFE6',

    // 默认AI服务配置（可切换）
    aiConfig: {
        provider: 'siliconflow',  // 默认使用硅基流动，可切换为 'qwen'、'zhipu' 或 'local'
        apiKey: AI_PROVIDERS.siliconflow.apiKey,
        apiUrl: AI_PROVIDERS.siliconflow.apiUrl,
        model: AI_PROVIDERS.siliconflow.model
    },

    // 所有可用的AI配置（供用户切换）
    availableProviders: AI_PROVIDERS
};

/**
 * 应用预设配置到localStorage和表单
 */
function applyPresetConfig() {
    // 配置腾讯地图API密钥
    localStorage.setItem('tencentMapKey', PRESET_CONFIG.tencentMapKey);

    const mapKeyInput = document.getElementById('tencentMapKey');
    if (mapKeyInput) {
        mapKeyInput.value = PRESET_CONFIG.tencentMapKey;
    }

    // 配置AI服务
    localStorage.setItem('aiConfig', JSON.stringify(PRESET_CONFIG.aiConfig));

    const providerSelect = document.getElementById('aiProvider');
    const apiKeyInput = document.getElementById('aiApiKey');

    if (providerSelect) {
        providerSelect.value = PRESET_CONFIG.aiConfig.provider;
    }
    if (apiKeyInput) {
        apiKeyInput.value = PRESET_CONFIG.aiConfig.apiKey;
    }

    // 应用AI配置
    aiService.setConfig(PRESET_CONFIG.aiConfig);

    console.log('✅ 预设配置已应用');
    console.log('腾讯地图API Key:', PRESET_CONFIG.tencentMapKey);
    console.log('AI服务:', PRESET_CONFIG.aiConfig.provider);
}

// 在页面加载时自动应用预设配置
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已有配置，如果没有则应用预设
    const savedMapKey = localStorage.getItem('tencentMapKey');

    if (!savedMapKey) {
        // 没有保存的配置，应用预设配置
        setTimeout(() => {
            applyPresetConfig();

            // 初始化地图
            initMap(PRESET_CONFIG.tencentMapKey);

            // 显示欢迎消息
            addMessage('assistant', '✅ API配置已自动加载！\n\n📍 腾讯地图: 已配置\n🤖 AI服务: 硅基流动 (默认)\n\n💡 可切换AI引擎：\n• 硅基流动（默认）- 支持多种开源模型\n• 通义千问 - 阿里云大模型\n• 智谱GLM - 中文优化\n• 本地引擎 - 快速免费\n\n点击「⚙️ API配置」可切换AI引擎\n\n现在可以直接使用！试试："帮我找北京西站附近的咖啡馆"');
        }, 100);
    } else {
        // 已有配置，显示当前状态
        const savedAIConfig = localStorage.getItem('aiConfig');
        if (savedAIConfig) {
            const aiConfig = JSON.parse(savedAIConfig);
            const providerName = AI_PROVIDERS[aiConfig.provider]?.name || aiConfig.provider;
            setTimeout(() => {
                addMessage('assistant', `✅ 已加载保存的配置\n\n📍 地图服务: 已初始化\n🤖 AI引擎: ${providerName}\n\n💡 可切换AI引擎（点击⚙️配置）：\n• 通义千问 - 阿里云\n• 智谱GLM - 中文优化\n• 本地引擎 - 快速免费\n\n可以直接开始对话！`);
            }, 100);
        }
    }
});

console.log('预设配置模块已加载');
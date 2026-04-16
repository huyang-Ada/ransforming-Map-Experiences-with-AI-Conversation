/**
 * 主应用逻辑
 * 整合地图服务和AI对话服务，实现完整的交互流程
 */

// 应用状态
const appState = {
    currentLocation: null,
    region: '北京',
    chatHistory: [],
    mapInitialized: false
};

/**
 * 页面加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('应用初始化...');

    // 加载保存的配置
    loadSavedConfig();

    // 绑定输入框事件
    const inputField = document.getElementById('userInput');
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});

/**
 * 加载已保存的配置
 */
function loadSavedConfig() {
    // 加载腾讯地图API密钥
    const savedMapKey = localStorage.getItem('tencentMapKey');
    if (savedMapKey) {
        const mapKeyInput = document.getElementById('tencentMapKey');
        if (mapKeyInput) {
            mapKeyInput.value = savedMapKey;
            initMap(savedMapKey);
        }
    }

    // 加载AI配置
    const savedAIConfig = localStorage.getItem('aiConfig');
    if (savedAIConfig) {
        const config = JSON.parse(savedAIConfig);
        const providerSelect = document.getElementById('aiProvider');
        const apiKeyInput = document.getElementById('aiApiKey');

        if (providerSelect) {
            providerSelect.value = config.provider || 'local';
        }
        if (apiKeyInput) {
            apiKeyInput.value = config.apiKey || '';
        }

        aiService.setConfig(config);
        updateAIConfig();
    }
}

/**
 * 保存地图API密钥
 */
function saveMapKey() {
    const mapKey = document.getElementById('tencentMapKey').value.trim();
    if (!mapKey) {
        alert('请输入腾讯地图API密钥');
        return;
    }

    localStorage.setItem('tencentMapKey', mapKey);
    initMap(mapKey);
    addMessage('assistant', '✅ 地图配置成功！现在可以使用地图功能了。');
}

/**
 * 初始化地图
 */
function initMap(apiKey) {
    if (mapService.init('mapContainer', apiKey)) {
        appState.mapInitialized = true;
        console.log('地图初始化完成');

        // 尝试获取当前位置
        getCurrentLocation();
    } else {
        console.error('地图初始化失败');
        addMessage('assistant', '❌ 地图初始化失败，请检查API密钥是否正确');
    }
}

/**
 * 更新AI配置显示
 */
function updateAIConfig() {
    const provider = document.getElementById('aiProvider').value;
    const aiConfigFields = document.getElementById('aiConfigFields');

    if (aiConfigFields) {
        if (provider === 'local') {
            aiConfigFields.style.display = 'none';
        } else {
            aiConfigFields.style.display = 'block';
        }
    }
}

/**
 * 保存AI配置
 */
function saveAIConfig() {
    const provider = document.getElementById('aiProvider').value;
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const apiUrl = document.getElementById('aiApiUrl').value.trim();

    const config = {
        provider,
        apiKey,
        apiUrl
    };

    localStorage.setItem('aiConfig', JSON.stringify(config));
    aiService.setConfig(config);

    addMessage('assistant', `✅ AI配置已保存，当前使用: ${provider === 'local' ? '本地规则引擎' : provider}`);
}

/**
 * 发送消息
 */
async function sendMessage() {
    const inputField = document.getElementById('userInput');
    const userMessage = inputField.value.trim();

    if (!userMessage) return;

    // 清空输入框
    inputField.value = '';

    // 显示用户消息
    addMessage('user', userMessage);

    // 检查地图是否初始化
    if (!appState.mapInitialized) {
        addMessage('assistant', '⚠️ 请先配置腾讯地图API密钥才能使用地图功能');
        return;
    }

    // 显示加载状态
    showLoading();

    try {
        // 处理用户输入
        const context = {
            currentLocation: appState.currentLocation,
            region: appState.region
        };

        const aiResult = await aiService.processInput(userMessage, context);

        // 显示AI响应
        addMessage('assistant', aiResult.response);

        // 执行对应的地图操作
        await executeMapOperation(aiResult);

    } catch (error) {
        console.error('处理消息失败:', error);
        addMessage('assistant', `❌ 处理失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * 执行地图操作
 * @param {object} aiResult - AI解析结果
 */
async function executeMapOperation(aiResult) {
    const { intent, params } = aiResult;

    switch (intent) {
        case 'search_poi':
            await handlePOISearch(params);
            break;

        case 'route_planning':
            await handleRoutePlanning(params);
            break;

        case 'recommendation':
            await handleRecommendation(params);
            break;

        case 'location_query':
            await handleLocationQuery(params);
            break;

        default:
            await handlePOISearch(params);
    }
}

/**
 * 处理POI搜索
 * @param {object} params - 搜索参数
 */
async function handlePOISearch(params) {
    try {
        // 如果指定了位置，先地理编码
        let searchLocation = null;
        if (params.location) {
            const fullAddress = params.location + ', ' + (params.region || '北京');
            const geocodeResult = await mapService.geocoder(fullAddress);
            searchLocation = geocodeResult;
        }

        // 构建搜索参数
        const searchParams = {
            keyword: params.keyword,
            region: params.region || '北京',
            location: searchLocation,
            pageSize: 10
        };

        // 执行搜索
        const poiList = await mapService.searchPOI(searchParams);

        if (poiList.length > 0) {
            // 在地图上显示
            mapService.displayPOIOnMap(poiList);

            // 生成详细的文本响应
            let responseText = `找到了 ${poiList.length} 个相关地点：\n`;
            poiList.slice(0, 5).forEach((poi, index) => {
                responseText += `\n${index + 1}. ${poi.title}\n   📍 ${poi.address || '暂无地址'}\n`;
                if (poi.distance) {
                    responseText += `   📏 距离约 ${poi.distance} 米\n`;
                }
            });

            if (poiList.length > 5) {
                responseText += `\n...还有 ${poiList.length - 5} 个地点已在地图上标记`;
            }

            addMessage('assistant', responseText);
        } else {
            addMessage('assistant', `未找到"${params.keyword}"相关的地点，请尝试其他关键词`);
        }

    } catch (error) {
        console.error('POI搜索执行失败:', error);
        addMessage('assistant', `❌ 搜索失败: ${error.message}`);
    }
}

/**
 * 处理路线规划
 * @param {object} params - 路线参数
 */
async function handleRoutePlanning(params) {
    try {
        // 地理编码起点和终点
        const fromAddress = params.from + ', 北京';
        const toAddress = params.to + ', 北京';

        const fromLocation = await mapService.geocoder(fromAddress);
        const toLocation = await mapService.geocoder(toAddress);

        // 规划路线（policy参数已在map-service中处理）
        const routeResult = await mapService.planRoute({
            from: fromLocation,
            to: toLocation
        });

        // 提取路线信息
        const route = routeResult.result.routes[0];
        const distance = (route.distance / 1000).toFixed(2);
        const duration = Math.floor(route.duration / 60);

        const responseText = `
✅ 路线规划成功！

📏 总距离: ${distance} 公里
⏱️ 预计时间: ${duration} 分钟

主要路段：
${route.steps.slice(0, 5).map(step => `• ${step.instruction}`).join('\n')}

路线已在地图上显示，您可以查看详���信息。
`;

        addMessage('assistant', responseText);

    } catch (error) {
        console.error('路线规划执行失败:', error);
        addMessage('assistant', `❌ 路线规划失败: ${error.message}\n请确保起点和终点地址明确`);
    }
}

/**
 * 处理推荐请求
 * @param {object} params - 推荐参数
 */
async function handleRecommendation(params) {
    // 复用POI搜索，添加推荐过滤条件
    const searchParams = {
        keyword: params.keyword,
        region: params.region || '北京',
        pageSize: 10
    };

    await handlePOISearch(searchParams);

    addMessage('assistant', `💡 我已为您推荐"${params.keyword}"的热门地点，请查看地图上的标记。点击标记可以查看详细信息。`);
}

/**
 * 处理位置查询
 * @param {object} params - 查询参数
 */
async function handleLocationQuery(params) {
    if (params.keyword === '当前位置') {
        await getCurrentLocation();
    } else {
        await handlePOISearch({
            keyword: params.keyword,
            region: appState.region
        });
    }
}

/**
 * 快捷搜索功能
 * @param {string} keyword - 搜索关键词
 */
function quickSearch(keyword) {
    const inputField = document.getElementById('userInput');
    inputField.value = `帮我找${keyword}`;
    sendMessage();
}

/**
 * 获取当前位置
 */
async function getCurrentLocation() {
    if (!appState.mapInitialized) {
        alert('请先初始化地图');
        return;
    }

    showLoading();
    addMessage('assistant', '正在定位您的位置...');

    try {
        const location = await mapService.getCurrentLocation();
        appState.currentLocation = location;

        const address = await mapService.reverseGeocoder(location);

        addMessage('assistant', `✅ 定位成功！\n📍 您当前位于: ${address}\n坐标: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);

    } catch (error) {
        console.error('定位失败:', error);
        addMessage('assistant', `❌ 定位失败: ${error.message}\n请确保浏览器允许位置访问权限`);
    } finally {
        hideLoading();
    }
}

/**
 * 切换地图类型
 */
function toggleMapType() {
    if (!appState.mapInitialized) return;
    mapService.toggleMapType();
}

/**
 * 清除地图标记
 */
function clearMarkers() {
    if (!appState.mapInitialized) return;
    mapService.clearMarkers();
    addMessage('assistant', '已清除地图上的所有标记');
}

/**
 * 清空聊天记录
 */
function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    // 重新显示欢迎消息
    addMessage('assistant', `
您好！我是AI智能地图助手，可以帮您：
🔍 搜索附近的餐厅、景点、商店等
🗺️ 规划出行路线和导航
📍 查找特定地点的位置
💡 推荐最佳汇合点

请用自然语言描述您的需求。
`);
}

/**
 * 添加聊天消息
 * @param {string} role - 角色（user/assistant）
 * @param {string} content - 消息内容
 */
function addMessage(role, content) {
    const chatMessages = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '🤖';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${content.replace(/\n/g, '<br>')}</p>
        </div>
    `;

    chatMessages.appendChild(messageDiv);

    // 滚动到最新消息
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 保存到历史记录
    appState.chatHistory.push({ role, content, timestamp: Date.now() });
}

/**
 * 显示加载状态
 */
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * 导出聊天记录
 */
function exportChatHistory() {
    const history = JSON.stringify(appState.chatHistory, null, 2);
    const blob = new Blob([history], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

console.log('主应用逻辑已加载');
/**
 * 地图服务模块 - 基于腾讯位置服务 JSAPI GL + WebService API
 * 功能：地图初始化、POI搜索、路线规划、定位等
 */

class MapService {
    constructor() {
        this.map = null;
        this.markers = [];
        this.currentLocation = null;
        this.isInitialized = false;
        this.apiKey = null; // 存储API密钥用于WebService调用
    }

    /**
     * 初始化地图
     * @param {string} containerId - 地图容器DOM元素ID
     * @param {string} apiKey - 腾讯地图API密钥
     */
    init(containerId = 'mapContainer', apiKey) {
        if (!apiKey) {
            console.error('请先配置腾讯地图API密钥');
            return false;
        }

        this.apiKey = apiKey;

        try {
            // 创建地图实例
            this.map = new TMap.Map(containerId, {
                center: new TMap.LatLng(39.984104, 116.307503), // 默认北京中心
                zoom: 12,
                viewMode: '2D',
                baseMap: {
                    type: TMap.MAP_TYPE_NORMAL
                }
            });

            this.isInitialized = true;
            console.log('地图初始化成功');
            return true;
        } catch (error) {
            console.error('地图初始化失败:', error);
            return false;
        }
    }

    /**
 * JSONP请求辅助方法
 * @param {string} url - API URL
 * @returns {Promise<object>} API响应数据
 */
jsonpRequest(url) {
    return new Promise((resolve, reject) => {
        // 创建唯一的callback函数名
        const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

        // 添加JSONP参数
        const jsonpUrl = url + '&output=jsonp&callback=' + callbackName;

        console.log('JSONP请求URL:', jsonpUrl);

        // 创建script标签
        const script = document.createElement('script');
        script.src = jsonpUrl;
        script.type = 'text/javascript';

        // 定义callback函数
        window[callbackName] = function(data) {
            console.log('JSONP响应:', data);
            resolve(data);
            // 清理
            delete window[callbackName];
            document.body.removeChild(script);
        };

        // 错误处理
        script.onerror = function(error) {
            console.error('JSONP请求失败:', error);
            reject(new Error('JSONP请求失败，请检查API URL和网络连接'));
            delete window[callbackName];
            document.body.removeChild(script);
        };

        // 超时处理（10秒）
        setTimeout(() => {
            if (window[callbackName]) {
                reject(new Error('请求超时'));
                delete window[callbackName];
                document.body.removeChild(script);
            }
        }, 10000);

        // 添加到页面
        document.body.appendChild(script);
    });
}

/**
     * 搜索POI（兴趣点）- 使用WebService API + JSONP
     * @param {object} params - 搜索参数
     * @returns {Promise<Array>} POI列表
     */
    searchPOI(params) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized) {
                reject(new Error('地图未初始化'));
                return;
            }

            if (!this.apiKey) {
                reject(new Error('API密钥未配置'));
                return;
            }

            // 使用腾讯地图WebService API进行搜索
            const keyword = encodeURIComponent(params.keyword);
            const region = encodeURIComponent(params.region || '北京');
            const pageSize = params.pageSize || 10;
            const pageIndex = params.pageIndex || 1;

            // 构建API URL
            let apiUrl = `https://apis.map.qq.com/ws/place/v1/search?keyword=${keyword}&boundary=region(${region},0)&page_size=${pageSize}&page_index=${pageIndex}&key=${this.apiKey}`;

            // 如果有具体位置，添加距离搜索
            if (params.location) {
                const lat = params.location.lat;
                const lng = params.location.lng;
                apiUrl = `https://apis.map.qq.com/ws/place/v1/explore?keyword=${keyword}&boundary=nearby(${lat},${lng},1000,0)&page_size=${pageSize}&page_index=${pageIndex}&key=${this.apiKey}`;
            }

            console.log('搜索API URL:', apiUrl);

            // 使用JSONP方式请求
            this.jsonpRequest(apiUrl)
                .then(data => {
                    console.log('WebService搜索结果:', data);

                    if (data.status !== 0) {
                        reject(new Error(data.message || '搜索失败'));
                        return;
                    }

                    const poiList = data.data || [];

                    // 转换数据格式以适配原有显示逻辑
                    const formattedPoiList = poiList.map(poi => ({
                        title: poi.title,
                        address: poi.address,
                        location: {
                            lat: poi.location.lat,
                            lng: poi.location.lng
                        },
                        distance: poi._distance || null,
                        tel: poi.tel || null,
                        category: poi.category || null
                    }));

                    resolve(formattedPoiList);
                })
                .catch(error => {
                    console.error('搜索请求失败:', error);
                    reject(new Error(`搜索失败: ${error.message}`));
                });
        });
    }

    /**
     * 在地图上显示POI标记
     * @param {Array} poiList - POI列表
     * @param {object} options - 显示选项
     */
    displayPOIOnMap(poiList, options = {}) {
        // 清除旧标记
        this.clearMarkers();

        if (!poiList || poiList.length === 0) {
            console.warn('没有POI数据');
            return;
        }

        // 创建标记
        poiList.forEach((poi, index) => {
            const marker = new TMap.MultiMarker({
                map: this.map,
                geometries: [{
                    id: `poi_${index}`,
                    styleId: 'marker',
                    position: new TMap.LatLng(poi.location.lat, poi.location.lng),
                    content: poi.title
                }],
                styles: {
                    marker: new TMap.MarkerStyle({
                        width: 30,
                        height: 40,
                        anchor: { x: 15, y: 40 },
                        background: {
                            image: 'https://map.qq.com/doc/jsapi_gl/img/marker.png'
                        }
                    })
                }
            });

            // 添加信息窗口
            const infoWindow = new TMap.InfoWindow({
                map: this.map,
                position: new TMap.LatLng(poi.location.lat, poi.location.lng),
                content: `
                    <div style="padding:10px;max-width:250px;">
                        <h4 style="margin:0 0 8px;color:#212529;">${poi.title}</h4>
                        <p style="margin:0;color:#6c757d;font-size:12px;">${poi.address || '暂无地址信息'}</p>
                        ${poi.distance ? `<p style="margin:4px 0;color:#007bff;font-size:12px;">距离: ${poi.distance}米</p>` : ''}
                    </div>
                `
            });

            marker.on('click', () => {
                infoWindow.open();
            });

            this.markers.push({ marker, infoWindow });
        });

        // 调整地图视野以包含所有标记
        if (options.fitBounds !== false) {
            this.fitBoundsToMarkers();
        }
    }

    /**
     * 规划路线 - 使用WebService API + JSONP
     * @param {object} params - 路线规划参数
     * @returns {Promise<object>} 路线结果
     */
    planRoute(params) {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized) {
                reject(new Error('地图未初始化'));
                return;
            }

            if (!this.apiKey) {
                reject(new Error('API密钥未配置'));
                return;
            }

            const fromLat = params.from.lat;
            const fromLng = params.from.lng;
            const toLat = params.to.lat;
            const toLng = params.to.lng;

            const apiUrl = `https://apis.map.qq.com/ws/direction/v1/driving/?from=${fromLat},${fromLng}&to=${toLat},${toLng}&key=${this.apiKey}`;

            console.log('路线规划API URL:', apiUrl);

            this.jsonpRequest(apiUrl)
                .then(data => {
                    console.log('路线规划结果:', data);

                    if (data.status !== 0) {
                        reject(new Error(data.message || '路线规划失败'));
                        return;
                    }

                    const routeResult = {
                        result: {
                            routes: data.result.routes.map(route => ({
                                distance: route.distance,
                                duration: route.duration,
                                polyline: route.polyline.map(point => ({
                                    lat: point.lat,
                                    lng: point.lng
                                })),
                                steps: route.steps.map(step => ({
                                    instruction: step.instruction,
                                    distance: step.distance,
                                    duration: step.duration,
                                    polyline: step.polyline.map(point => ({
                                        lat: point.lat,
                                        lng: point.lng
                                    }))
                                }))
                            }))
                        }
                    };

                    this.displayRouteOnMap(routeResult);
                    resolve(routeResult);
                })
                .catch(error => {
                    console.error('路线规划请求失败:', error);
                    reject(new Error(`路线规划失败: ${error.message}`));
                });
        });
    }

    /**
     * 在地图上显示路线
     * @param {object} routeResult - 路线规划结果
     */
    displayRouteOnMap(routeResult) {
        console.log('displayRouteOnMap接收到的数据:', routeResult);

        if (!routeResult || !routeResult.result) {
            console.error('路线结果数据无效:', routeResult);
            return;
        }

        if (!routeResult.result.routes || routeResult.result.routes.length === 0) {
            console.error('路线结果中没有routes数据:', routeResult.result);
            return;
        }

        const route = routeResult.result.routes[0];

        if (!route.polyline || route.polyline.length === 0) {
            console.error('路线中没有polyline数据:', route);
            return;
        }

        // 检查地图是否已初始化
        if (!this.map) {
            console.error('地图未初始化，无法显示路线');
            return;
        }

        try {
            const polyline = new TMap.MultiPolyline({
                map: this.map,
                geometries: [{
                    id: 'route_1',
                    styleId: 'route_style',
                    positions: route.polyline.map(point =>
                        new TMap.LatLng(point.lat, point.lng)
                    )
                }],
                styles: {
                    route_style: new TMap.PolylineStyle({
                        color: '#667eea',
                        width: 6,
                        borderWidth: 2,
                        borderColor: '#5568d3'
                    })
                }
            });

            // 起点和终点标记
            const startPoint = route.polyline[0];
            const endPoint = route.polyline[route.polyline.length - 1];

            const startMarker = new TMap.Marker({
                position: new TMap.LatLng(startPoint.lat, startPoint.lng),
                map: this.map
            });

            const endMarker = new TMap.Marker({
                position: new TMap.LatLng(endPoint.lat, endPoint.lng),
                map: this.map
            });

            this.markers.push({ marker: polyline });
            this.markers.push({ marker: startMarker });
            this.markers.push({ marker: endMarker });

            // 显示路线信息
            this.showRouteInfo(route);

            console.log('✅ 路线已成功显示在地图上');
        } catch (error) {
            console.error('显示路线时发生错误:', error);
        }
    }

    /**
     * 显示路线详情信息
     * @param {object} route - 路线对象
     */
    showRouteInfo(route) {
        const routeInfoPanel = document.getElementById('routeInfo');
        const routeDetails = document.getElementById('routeDetails');

        if (!routeInfoPanel || !routeDetails) return;

        routeInfoPanel.style.display = 'block';

        const distance = route.distance;
        const duration = route.duration;
        const steps = route.steps;

        routeDetails.innerHTML = `
            <div class="route-item">
                <strong>总距离:</strong> ${(distance / 1000).toFixed(2)} 公里
            </div>
            <div class="route-item">
                <strong>预计时间:</strong> ${Math.floor(duration / 60)} 分钟
            </div>
            <div class="route-item">
                <strong>导航步骤:</strong>
                <ul style="margin:8px 0;padding-left:20px;">
                    ${steps.map(step => `<li>${step.instruction}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * 获取当前位置
     * @returns {Promise<object>} 位置信息
     */
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized) {
                reject(new Error('地图未初始化'));
                return;
            }

            // 使用浏览器定位API
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const location = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        this.currentLocation = location;
                        this.map.setCenter(new TMap.LatLng(location.lat, location.lng));

                        // 添加当前位置标记
                        const marker = new TMap.Marker({
                            position: new TMap.LatLng(location.lat, location.lng),
                            map: this.map
                        });

                        this.markers.push({ marker });

                        resolve(location);
                    },
                    (error) => {
                        console.error('定位失败:', error);
                        reject(error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0
                    }
                );
            } else {
                reject(new Error('浏览器不支持定位功能'));
            }
        });
    }

    /**
     * 切换地图类型（普通/卫星/地形）
     */
    toggleMapType() {
        if (!this.isInitialized) return;

        const currentType = this.map.getBaseMap().type;
        let newType;

        if (currentType === TMap.MAP_TYPE_NORMAL) {
            newType = TMap.MAP_TYPE_SATELLITE;
        } else if (currentType === TMap.MAP_TYPE_SATELLITE) {
            newType = TMap.MAP_TYPE_TERRAIN;
        } else {
            newType = TMap.MAP_TYPE_NORMAL;
        }

        this.map.setBaseMap({ type: newType });
    }

    /**
     * 清除所有地图标记
     */
    clearMarkers() {
        this.markers.forEach(({ marker, infoWindow }) => {
            if (marker && marker.setMap) {
                marker.setMap(null);
            }
            if (infoWindow && infoWindow.close) {
                infoWindow.close();
            }
        });
        this.markers = [];

        // 隐藏路线信息面板
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo) {
            routeInfo.style.display = 'none';
        }
    }

    /**
     * 调整地图视野以包含所有标记
     */
    fitBoundsToMarkers() {
        if (this.markers.length === 0 || !this.map) return;

        const bounds = new TMap.LatLngBounds();
        this.markers.forEach(({ marker }) => {
            if (marker.getPosition) {
                const position = marker.getPosition();
                bounds.extend(position);
            }
        });

        this.map.fitBounds(bounds, {
            padding: 50
        });
    }

    /**
     * 地理编码：地址转坐标 - 使用WebService API + JSONP
     * @param {string} address - 地址文本
     * @returns {Promise<object>} 坐标信息
     */
    geocoder(address) {
        return new Promise((resolve, reject) => {
            if (!this.apiKey) {
                reject(new Error('API密钥未配置'));
                return;
            }

            const encodedAddress = encodeURIComponent(address);
            const apiUrl = `https://apis.map.qq.com/ws/geocoder/v1/?address=${encodedAddress}&key=${this.apiKey}`;

            console.log('地理编码API URL:', apiUrl);

            this.jsonpRequest(apiUrl)
                .then(data => {
                    console.log('地理编码完整响应:', data);

                    if (data.status !== 0) {
                        const errorMsg = data.message || '未找到地址对应的坐标';
                        console.error('地理编码API错误:', errorMsg);
                        reject(new Error(errorMsg));
                        return;
                    }

                    // 详细检查返回数据结构
                    if (!data.result) {
                        console.error('地理编码返回数据缺少result字段:', data);
                        reject(new Error('返回数据格式错误：缺少result字段'));
                        return;
                    }

                    if (!data.result.location) {
                        console.error('地理编码返回数据缺少location字段:', data.result);
                        reject(new Error('返回数据格式错误：缺少location字段'));
                        return;
                    }

                    const location = data.result.location;

                    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
                        console.error('地理编码返回的坐标格式错误:', location);
                        reject(new Error(`返回坐标格式错误：lat=${location.lat}, lng=${location.lng}`));
                        return;
                    }

                    console.log('✅ 地理编码成功:', location);
                    resolve({
                        lat: location.lat,
                        lng: location.lng
                    });
                })
                .catch(error => {
                    console.error('地理编码请求失败:', error);
                    reject(new Error(`地理编码失败: ${error.message}`));
                });
        });
    }

    /**
     * 逆地理编码：坐标转地址 - 使用WebService API + JSONP
     * @param {object} location - 坐标对象 {lat, lng}
     * @returns {Promise<string>} 地址文本
     */
    reverseGeocoder(location) {
        return new Promise((resolve, reject) => {
            if (!this.apiKey) {
                reject(new Error('API密钥未配置'));
                return;
            }

            const apiUrl = `https://apis.map.qq.com/ws/geocoder/v1/?location=${location.lat},${location.lng}&key=${this.apiKey}`;

            console.log('逆地理编码API URL:', apiUrl);

            this.jsonpRequest(apiUrl)
                .then(data => {
                    console.log('逆地理编码结果:', data);

                    if (data.status !== 0) {
                        reject(new Error(data.message || '未找到坐标对应的地址'));
                        return;
                    }

                    if (data.result && data.result.address) {
                        resolve(data.result.address);
                    } else {
                        reject(new Error('未找到坐标对应的地址'));
                    }
                })
                .catch(error => {
                    console.error('逆地理编码请求失败:', error);
                    reject(new Error(`逆地理编码失败: ${error.message}`));
                });
        });
    }
}

// 创建全局地图服务实例
const mapService = new MapService();
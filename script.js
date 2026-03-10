// ========== 全局状态定义（统一管理） ==========
let currentUser = null;
let currentQuestionIndex = 0;
let myMates = new Set(); // 改用Set避免重复
let currentChatUser = null;
let ws = null; // WebSocket连接

// ========== 后端地址 ==========
const API_BASE_URL = 'https://life-selector-pro-production.up.railway.app';

// ========== 模拟数据（仅定义一次，避免重复） ==========
// 基础用户数据
const mockUsers = [
    { id: 1, name: '用户1', avatar: '😋', tag: '喜好' },
    { id: 2, name: '用户2', avatar: '🧋', tag: '喜好' },
    { id: 3, name: '用户3', avatar: '💪', tag: '喜好' },
    { id: 4, name: '用户4', avatar: '🌙', tag: '喜好' },
    { id: 5, name: '用户5', avatar: '👨‍🍳', tag: '喜好' },
    { id: 6, name: '用户6', avatar: '👩‍🎓', tag: '喜好' },
    { id: 7, name: '用户7', avatar: '🧑', tag: '喜好' },
    { id: 101, name: '小王', avatar: '😎', lastMsg: '在吗？一起吃饭', time: '10:30', unread: 2 },
    { id: 102, name: '小李', avatar: '🧋', lastMsg: '奶茶走起', time: '昨天', unread: 0 },
    { id: 103, name: '小张', avatar: '📚', lastMsg: '图书馆占座了', time: '昨天', unread: 1 },
    { id: 104, name: '小刘', avatar: '🎮', lastMsg: '晚上开黑？', time: '周一', unread: 0 },
];

// 问答题目数据
const questions = [
    {
        emoji: '❓',
        question: '今晚吃什么？',
        left: { emoji: '🍜', text: '吃面' },
        right: { emoji: '🍚', text: '吃饭' }
    },
    {
        emoji: '🎮',
        question: '周末怎么过？',
        left: { emoji: '🏠', text: '宅家' },
        right: { emoji: '🌳', text: '出门' }
    },
    {
        emoji:'🧋',
        question:'喜欢喝什么饮品？',
        left:{emoji:'🥛',text:'奶茶'},
        right:{emoji:'🍇',text:'果茶'}
    },
    {
        emoji:'🌤️',
        question:'喜欢哪种天气？',
        left:{emoji:'☀️',text:'晴天'},
        right:{emoji:'🌧️',text:'雨天'}
    },
    {
        emoji: '📝',
        question: '周末去图书馆吗？',
        left: { emoji: '✅', text: '去' },
        right: { emoji: '❌', text: '不去' }
    },
    {
        emoji: '⏰',
        question: '早上几点起？',
        left: { emoji: '🌅', text: '7点前' },
        right: { emoji: '🌞', text: '9点后' }
    },
    {
        emoji: '📱',
        question: '上课玩手机吗？',
        left: { emoji: '😇', text: '认真听' },
        right: { emoji: '😏', text: '偷偷玩' }
    },
    {
        emoji: '📖',
        question: '期末复习状态？',
        left: { emoji: '✍️', text: '早开始了' },
        right: { emoji: '😱', text: '明天开始' }
    },
    {
        emoji: '💻',
        question: '写作业时听歌吗？',
        left: { emoji: '🎧', text: '听' },
        right: { emoji: '🔇', text: '不听' }
    }
];

// 附近的人数据
const nearbyUsers = [
    { id: 201, name: '小王', avatar: '😎', bio: '也在找饭搭子', distance: '50m', tags: '吃货' },
    { id: 202, name: '小李', avatar: '🧋', bio: '奶茶必须加珍珠', distance: '120m', tags: '甜食控' },
    { id: 203, name: '小张', avatar: '📚', bio: '图书馆常驻人口', distance: '200m', tags: '学习搭子' },
    { id: 204, name: '小刘', avatar: '🎮', bio: '王者荣耀求带', distance: '300m', tags: '游戏' },
    { id: 205, name: '小陈', avatar: '🏀', bio: '下午打球缺人', distance: '400m', tags: '运动' }
];

// ========== 1. 登录验证（优先执行） ==========
(function initAuth() {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');

    if (!token || !userJson) {
        window.location.replace('login.html');
        throw new Error('需要登录');
    }

    try {
        currentUser = JSON.parse(userJson);
    } catch (e) {
        localStorage.clear();
        window.location.replace('login.html');
        throw new Error('用户信息错误');
    }
})();

// ========== DOM加载完成后执行所有操作 ==========
document.addEventListener('DOMContentLoaded', function() {
    // ========== 2. 显示用户信息 ==========
    function renderUserInfo() {
        if (!currentUser) return;
        
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        
        if (userNameEl) userNameEl.textContent = currentUser.nickname || '用户';
        if (userAvatarEl) userAvatarEl.textContent = currentUser.avatar || '😊';
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }
    }

    // ========== 3. 问答核心功能 ==========
    // 获取DOM元素（判空处理）
    const currentEmoji = document.getElementById('current-emoji');
    const currentQuestion = document.getElementById('current-question');
    const leftEmoji = document.getElementById('left-emoji');
    const leftText = document.getElementById('left-text');
    const rightEmoji = document.getElementById('right-emoji');
    const rightText = document.getElementById('right-text');
    const choiceLeft = document.getElementById('choice-left');
    const choiceRight = document.getElementById('choice-right');
    const matchCard = document.getElementById('match-card');
    const matchEmoji = document.getElementById('match-emoji');
    const matchCount = document.getElementById('match-count');
    const matchChoice = document.getElementById('match-choice');
    const matesList = document.getElementById('mates-list');
    const nextBtn = document.getElementById('next-question');
    const myMatesList = document.getElementById('my-mates-list');
    const resetBtn = document.getElementById('reset-all');

    // 加载题目
    function loadQuestion() {
        if (!currentEmoji || !currentQuestion) return;
        
        const q = questions[currentQuestionIndex];
        currentEmoji.textContent = q.emoji;
        currentQuestion.textContent = q.question;
        
        if (leftEmoji) leftEmoji.textContent = q.left.emoji;
        if (leftText) leftText.textContent = q.left.text;
        if (rightEmoji) rightEmoji.textContent = q.right.emoji;
        if (rightText) rightText.textContent = q.right.text;
        
        if (matchCard) matchCard.classList.add('hidden');
    }

    // 显示匹配结果
    function showMatch(choice) {
        if (!matchCard || !matesList) return;
        
        const q = questions[currentQuestionIndex];
        const choiceData = choice === 'left' ? q.left : q.right;
        
        const mateCount = Math.floor(Math.random() * 4) + 2;
        const shuffled = [...mockUsers.slice(0,7)].sort(() => 0.5 - Math.random()); // 仅取前7个基础用户
        const mates = shuffled.slice(0, mateCount).map(user => ({
            ...user,
            choiceEmoji: choiceData.emoji,
            choiceText: choiceData.text,
            poked: false
        }));
        
        // 渲染匹配信息
        if (matchEmoji) matchEmoji.textContent = choiceData.emoji;
        if (matchCount) matchCount.textContent = mateCount;
        if (matchChoice) matchChoice.textContent = choiceData.text;
        
        // 渲染匹配用户列表
        let matesHtml = '';
        mates.forEach(mate => {
            matesHtml += `
                <div class="mate-item" data-mate-id="${mate.id}">
                    <div class="mate-avatar">${mate.avatar}</div>
                    <div class="mate-info">
                        <div class="mate-name">${mate.name}</div>
                        <div class="mate-choice">也选了 ${choiceData.emoji} ${choiceData.text}</div>
                        <div class="mate-tag">${mate.tag}</div>
                    </div>
                    <button class="poke-btn" data-mate-id="${mate.id}">👋 戳一下</button>
                </div>
            `;
        });
        matesList.innerHTML = matesHtml;
        // 存储mates数据到元素，避免闭包问题
        matesList.dataset.mates = JSON.stringify(mates);
        
        if (matchCard) matchCard.classList.remove('hidden');
    }

    // 渲染我的搭子列表
    function renderMyMates() {
        if (!myMatesList) return;
        
        const matesArr = Array.from(myMates);
        if (matesArr.length === 0) {
            myMatesList.innerHTML = '<p class="empty-mates">还没有搭子，戳一个试试？</p >';
            return;
        }
        
        let html = '';
        matesArr.forEach(mate => {
            html += `
                <div class="my-mate-item">
                    <div class="mate-avatar" style="width:40px;height:40px;font-size:24px;">${mate.avatar}</div>
                    <div>
                        <div style="font-weight:600;">${mate.name}</div>
                        <div style="font-size:13px;color:#6a6f7a;">${mate.choiceEmoji} ${mate.choiceText}</div>
                    </div>
                    <div style="margin-left:auto;font-size:12px;color:#8f9eb2;">✓ 已戳</div>
                </div>
            `;
        });
        myMatesList.innerHTML = html;
    }

    // 重置所有状态
    function resetAll() {
        currentQuestionIndex = 0;
        myMates.clear(); // 清空Set
        loadQuestion();
        renderMyMates();
    }

    // 下一题
    function nextQuestion() {
        const nextIndex = (currentQuestionIndex + 1) % questions.length;
        if (nextIndex === 0) {
            alert('已经是最后一题啦，回到第一题继续~');
        }
        currentQuestionIndex = nextIndex;
        loadQuestion();
    }

    // ========== 4. 板块切换功能 ==========
    const tabTest = document.getElementById('tab-test');
    const tabMate = document.getElementById('tab-mate');
    const sectionTest = document.getElementById('section-test');
    const sectionMate = document.getElementById('section-mate');

    // 渲染附近的人
    function renderNearbyUsers() {
        const container = document.querySelector('.mate-list-new');
        if (!container || container.dataset.rendered === 'true') return; // 防重复渲染
        
        container.dataset.rendered = 'true';
        let html = '';
        
        nearbyUsers.forEach(user => {
            html += `
                <div class="mate-card-new" data-user-id="${user.id}">
                    <div class="mate-avatar-new">${user.avatar}</div>
                    <div class="mate-info-new">
                        <div class="mate-name-new">${user.name}</div>
                        <div class="mate-bio">${user.bio} · ${user.distance} · ${user.tags}</div>
                    </div>
                    <button class="connect-btn" data-user-id="${user.id}" data-name="${user.name}" data-avatar="${user.avatar}">👋 打招呼</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    // ========== 5. 消息系统功能（调后端接口） ==========
    // 获取消息相关DOM元素
    const messageBtn = document.getElementById('message-btn');
    const messageModal = document.getElementById('message-modal');
    const chatModal = document.getElementById('chat-modal');
    const closeMessage = document.getElementById('close-message');
    const backToList = document.getElementById('back-to-list');
    const conversationList = document.getElementById('conversation-list');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message');
    const chatUsername = document.getElementById('chat-username');
    const chatAvatar = document.getElementById('chat-avatar');
    const messageBadge = document.getElementById('message-badge');

    // 更新未读消息红点（需要从后端获取）
    async function updateUnreadBadge() {
        if (!messageBadge || !currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations?userId=${currentUser.id}`);
            const result = await response.json();
            
            if (result.code === 200) {
                const totalUnread = result.data.reduce((sum, c) => sum + (c.unread || 0), 0);
                if (totalUnread > 0) {
                    messageBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                    messageBadge.classList.remove('hidden');
                } else {
                    messageBadge.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('获取未读消息数失败:', error);
        }
    }

    // 渲染对话列表（从后端获取）
    async function renderConversations() {
        if (!conversationList || !currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/conversations?userId=${currentUser.id}`);
            const result = await response.json();
            
            if (result.code === 200) {
                const conversations = result.data;
                let html = '';
                
                conversations.forEach(conv => {
                    html += `
                        <div class="conversation-item" data-user-id="${conv.id}">
                            <div class="conversation-avatar">${conv.avatar}</div>
                            <div class="conversation-info">
                                <div class="conversation-name">${conv.name}</div>
                                <div class="conversation-last">${conv.lastMsg || '暂无消息'}</div>
                            </div>
                            <div class="conversation-time">${conv.time || ''}</div>
                            ${conv.unread ? `<div class="conversation-unread">${conv.unread}</div>` : ''}
                        </div>
                    `;
                });
                
                conversationList.innerHTML = html || '<div class="loading">暂无对话</div>';
            }
        } catch (error) {
            console.error('获取对话列表失败:', error);
            conversationList.innerHTML = '<div class="loading">加载失败</div>';
        }
    }

    // 打开聊天窗口
    async function openChat(userId) {
        if (!currentUser || !chatUsername || !chatAvatar) return;
        
        try {
            // 先获取对方用户信息
            const response = await fetch(`${API_BASE_URL}/api/conversations?userId=${currentUser.id}`);
            const result = await response.json();
            
            if (result.code === 200) {
                const user = result.data.find(c => c.id === userId);
                if (!user) return;
                
                currentChatUser = user;
                chatUsername.textContent = user.name;
                chatAvatar.textContent = user.avatar;
                
                // 渲染聊天记录
                await renderChatMessages(userId);
                
                // 切换窗口
                if (messageModal) messageModal.classList.add('hidden');
                if (chatModal) chatModal.classList.remove('hidden');
                
                // 更新未读红点
                updateUnreadBadge();
            }
        } catch (error) {
            console.error('打开聊天失败:', error);
        }
    }

    // 渲染聊天消息（从后端获取）
    async function renderChatMessages(userId) {
        if (!chatMessages || !currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/messages?userId=${currentUser.id}&otherUserId=${userId}`);
            const result = await response.json();
            
            if (result.code === 200) {
                const messages = result.data;
                let html = '';
                
                messages.forEach(msg => {
                    html += `
                        <div class="message ${msg.isMe ? 'message-right' : 'message-left'}">
                            ${msg.content}
                            <div class="message-time">${msg.time}</div>
                        </div>
                    `;
                });
                
                chatMessages.innerHTML = html;
                
                // 标记为已读
                await fetch(`${API_BASE_URL}/api/messages/read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: currentUser.id,
                        otherUserId: userId
                    })
                });
                
                // 滚动到底部
                setTimeout(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 100);
            }
        } catch (error) {
            console.error('获取聊天记录失败:', error);
            chatMessages.innerHTML = '<div class="loading">加载失败</div>';
        }
    }

    // 发送消息
    async function sendMessage() {
        if (!currentChatUser || !chatInput || !currentUser) return;
        
        const content = chatInput.value.trim();
        if (!content) return;
        
        // 清空输入框
        chatInput.value = '';
        
        try {
            // 发送到后端
            const response = await fetch(`${API_BASE_URL}/api/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUserId: currentUser.id,
                    toUserId: currentChatUser.id,
                    content: content
                })
            });
            
            const result = await response.json();
            
            if (result.code === 200) {
                // 重新渲染聊天记录
                await renderChatMessages(currentChatUser.id);
                
                // 通过WebSocket发送
                sendMessageViaWebSocket(currentChatUser.id, content);
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            alert('发送失败，请重试');
        }
    }

    // ========== 6. WebSocket连接 ==========
    // 连接WebSocket
    function connectWebSocket() {
        if (!currentUser) return;
        
        const userId = currentUser.id;
        ws = new WebSocket(`ws://localhost:3000?userId=${userId}`);
        
        ws.onopen = () => {
            console.log('WebSocket连接成功');
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('收到消息:', data);
            
            if (data.type === 'new_message') {
                // 收到新消息
                
                // 浏览器通知
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('新消息', {
                        body: data.content,
                    });
                }
                
                // 如果正在和这个人聊天，直接刷新聊天记录
                if (currentChatUser && currentChatUser.id === data.fromUserId) {
                    renderChatMessages(data.fromUserId);
                } else {
                    // 更新未读红点
                    updateUnreadBadge();
                }
            } else if (data.type === 'online_users') {
                console.log('在线用户:', data.users);
                // 可以在这里高亮显示在线的人
            }
        };
        
        ws.onclose = () => {
            console.log('WebSocket断开，5秒后重连');
            setTimeout(connectWebSocket, 5000);
        };
    }

    // 发送消息时，通过WebSocket发
    function sendMessageViaWebSocket(toUserId, content) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'chat',
                fromUserId: currentUser.id,
                toUserId: toUserId,
                content: content
            }));
        }
    }

    // ========== 事件绑定（统一使用事件委托，优化性能） ==========
    // 1. 问答相关事件
    if (choiceLeft) choiceLeft.addEventListener('click', () => showMatch('left'));
    if (choiceRight) choiceRight.addEventListener('click', () => showMatch('right'));
    if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
    if (resetBtn) resetBtn.addEventListener('click', resetAll);

    // 2. 板块切换事件
    if (tabTest && tabMate && sectionTest && sectionMate) {
        tabTest.addEventListener('click', () => {
            tabTest.classList.add('active');
            tabMate.classList.remove('active');
            sectionTest.classList.remove('hidden');
            sectionMate.classList.add('hidden');
        });

        tabMate.addEventListener('click', () => {
            tabMate.classList.add('active');
            tabTest.classList.remove('active');
            sectionMate.classList.remove('hidden');
            sectionTest.classList.add('hidden');
            renderNearbyUsers();
        });
    }

    // 3. 消息系统事件
    if (messageBtn) {
        messageBtn.addEventListener('click', () => {
            renderConversations();
            if (messageModal) messageModal.classList.remove('hidden');
        });
    }

    if (closeMessage) {
        closeMessage.addEventListener('click', () => {
            if (messageModal) messageModal.classList.add('hidden');
        });
    }

    if (backToList) {
        backToList.addEventListener('click', () => {
            if (chatModal) chatModal.classList.add('hidden');
            if (messageModal) messageModal.classList.remove('hidden');
            currentChatUser = null;
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // 4. 全局事件委托（处理动态生成的按钮）
    document.addEventListener('click', function(e) {
        // 戳一下按钮
        if (e.target.classList.contains('poke-btn') && !e.target.classList.contains('poked')) {
            const mateId = parseInt(e.target.dataset.mateId);
            const mates = JSON.parse(matesList?.dataset.mates || '[]');
            const mate = mates.find(m => m.id === mateId);
            
            if (mate) {
                e.target.textContent = '✓ 已戳';
                e.target.classList.add('poked');
                myMates.add(mate); // Set自动去重
                renderMyMates();
            }
        }

        // 打招呼按钮
        if (e.target.classList.contains('connect-btn') && !e.target.disabled) {
            e.stopPropagation();
            const userId = parseInt(e.target.dataset.userId);
            const name = e.target.dataset.name;
            const avatar = e.target.dataset.avatar;
            
            alert(`👋 已向 ${name} 发送招呼！`);
            
            // 这里可以调后端接口记录打招呼
            // 暂时先保持原来的逻辑
            
            // 更新按钮状态
            e.target.textContent = '✓ 已发送';
            e.target.classList.add('connected');
            e.target.disabled = true;
            
            updateUnreadBadge();
        }

        // 对话列表项
        if (e.target.closest('.conversation-item')) {
            const item = e.target.closest('.conversation-item');
            const userId = parseInt(item.dataset.userId);
            openChat(userId);
        }
    });

    // 5. 点击弹窗外层关闭
    if (messageModal) {
        messageModal.addEventListener('click', (e) => {
            if (e.target === messageModal) messageModal.classList.add('hidden');
        });
    }

    if (chatModal) {
        chatModal.addEventListener('click', (e) => {
            if (e.target === chatModal) chatModal.classList.add('hidden');
        });
    }

    // ========== 初始化执行 ==========
    renderUserInfo();
    loadQuestion();
    renderMyMates();
    updateUnreadBadge();

    // 请求通知权限
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('通知权限已授予');
            }
        });
    }

    // 连接WebSocket
    if (currentUser) {
        connectWebSocket();
    }
});
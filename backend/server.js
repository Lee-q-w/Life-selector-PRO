// server.js - 你的第一个后端！
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); // 新增：处理路径
const WebSocket = require('ws');

const app = express();
// 重要：使用环境变量 PORT，Render会自动分配
const PORT = process.env.PORT || 3000;

// 让前端能访问
app.use(cors());
// 让后端能解析JSON
app.use(express.json());

// ========== 用文件当数据库（使用绝对路径） ==========
// 在Render上，数据会存在 /tmp 目录下（重启后丢失）
const DATA_DIR = process.env.RENDER ? '/tmp' : '.';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// 初始化用户文件
function initFile(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([]));
    }
}

initFile(USERS_FILE);
initFile(MESSAGES_FILE);
initFile(CONVERSATIONS_FILE);

// 工具函数：读用户
function getUsers() {
    const data = fs.readFileSync(USERS_FILE);
    return JSON.parse(data);
}

// 工具函数：写用户
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 工具函数：读消息
function getMessages() {
    const data = fs.readFileSync(MESSAGES_FILE);
    return JSON.parse(data);
}

// 工具函数：写消息
function saveMessages(messages) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// 工具函数：读对话列表
function getConversations() {
    const data = fs.readFileSync(CONVERSATIONS_FILE);
    return JSON.parse(data);
}

// 工具函数：写对话列表
function saveConversations(conversations) {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
}

// ========== 1. 测试接口 ==========
app.get('/', (req, res) => {
    res.json({ 
        message: '后端跑通了！',
        status: 'online',
        time: new Date().toLocaleString()
    });
});

// ========== 2. 注册接口 ==========
app.post('/api/register', (req, res) => {
    const { phone, nickname, password } = req.body;
    
    // 简单验证
    if (!phone || !nickname || !password) {
        return res.json({ code: 400, message: '请填写完整' });
    }
    
    const users = getUsers();
    
    // 检查手机号是否已存在
    if (users.find(u => u.phone === phone)) {
        return res.json({ code: 400, message: '手机号已注册' });
    }
    
    // 创建新用户
    const newUser = {
        id: Date.now(),
        phone,
        nickname,
        password, // 实际项目要加密，先不管
        avatar: ['😊', '😎', '🤓', '😋'][Math.floor(Math.random() * 4)],
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    res.json({
        code: 200,
        message: '注册成功',
        data: {
            id: newUser.id,
            nickname: newUser.nickname,
            avatar: newUser.avatar,
            phone: newUser.phone,
            token: 'token_' + Date.now() + '_' + newUser.id
        }
    });
});

// ========== 3. 登录接口 ==========
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    
    const users = getUsers();
    const user = users.find(u => u.phone === phone && u.password === password);
    
    if (!user) {
        return res.json({ code: 400, message: '手机号或密码错误' });
    }
    
    res.json({
        code: 200,
        message: '登录成功',
        data: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            phone: user.phone,
            token: 'token_' + Date.now() + '_' + user.id
        }
    });
});

// ========== 4. 获取所有用户（用于附近的人） ==========
app.get('/api/users', (req, res) => {
    const { exclude } = req.query;
    
    const users = getUsers();
    // 排除当前用户，并只返回必要字段
    const otherUsers = users
        .filter(u => u.id !== parseInt(exclude))
        .map(u => ({
            id: u.id,
            nickname: u.nickname,
            avatar: u.avatar,
            bio: '也在找搭子'
        }));
    
    res.json({
        code: 200,
        data: otherUsers
    });
});

// ========== 5. 获取对话列表 ==========
app.get('/api/conversations', (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.json({ code: 400, message: '缺少用户ID' });
    }
    
    const conversations = getConversations();
    const userConversations = conversations.filter(c => 
        c.userId1 === parseInt(userId) || c.userId2 === parseInt(userId)
    );
    
    const users = getUsers();
    const result = userConversations.map(c => {
        const otherUserId = c.userId1 === parseInt(userId) ? c.userId2 : c.userId1;
        const otherUser = users.find(u => u.id === otherUserId);
        
        return {
            id: otherUserId,
            name: otherUser ? otherUser.nickname : '用户' + otherUserId,
            avatar: otherUser ? otherUser.avatar : '😊',
            lastMsg: c.lastMsg,
            time: formatTime(c.lastTime),
            unread: c.userId1 === parseInt(userId) ? c.unread1 : c.unread2
        };
    });
    
    res.json({
        code: 200,
        data: result
    });
});

// ========== 6. 获取聊天记录 ==========
app.get('/api/messages', (req, res) => {
    const { userId, otherUserId } = req.query;
    
    if (!userId || !otherUserId) {
        return res.json({ code: 400, message: '缺少参数' });
    }
    
    const messages = getMessages();
    const chatMessages = messages.filter(m => 
        (m.fromUserId === parseInt(userId) && m.toUserId === parseInt(otherUserId)) ||
        (m.fromUserId === parseInt(otherUserId) && m.toUserId === parseInt(userId))
    ).sort((a, b) => new Date(a.time) - new Date(b.time));
    
    const formattedMessages = chatMessages.map(m => ({
        from: m.fromUserId === parseInt(userId) ? 'me' : 'them',
        content: m.content,
        time: formatTime(m.time),
        isMe: m.fromUserId === parseInt(userId)
    }));
    
    res.json({
        code: 200,
        data: formattedMessages
    });
});

// ========== 7. 发送消息 ==========
app.post('/api/messages/send', (req, res) => {
    const { fromUserId, toUserId, content } = req.body;
    
    if (!fromUserId || !toUserId || !content) {
        return res.json({ code: 400, message: '缺少参数' });
    }
    
    // 1. 保存消息
    const messages = getMessages();
    const newMessage = {
        id: Date.now(),
        fromUserId: parseInt(fromUserId),
        toUserId: parseInt(toUserId),
        content: content,
        time: new Date().toISOString(),
        isRead: false
    };
    messages.push(newMessage);
    saveMessages(messages);
    
    // 2. 更新对话列表
    const conversations = getConversations();
    let conversation = conversations.find(c => 
        (c.userId1 === parseInt(fromUserId) && c.userId2 === parseInt(toUserId)) ||
        (c.userId1 === parseInt(toUserId) && c.userId2 === parseInt(fromUserId))
    );
    
    if (conversation) {
        conversation.lastMsg = content;
        conversation.lastTime = new Date().toISOString();
        if (conversation.userId1 === parseInt(fromUserId)) {
            conversation.unread2 = (conversation.unread2 || 0) + 1;
        } else {
            conversation.unread1 = (conversation.unread1 || 0) + 1;
        }
    } else {
        conversation = {
            userId1: parseInt(fromUserId),
            userId2: parseInt(toUserId),
            lastMsg: content,
            lastTime: new Date().toISOString(),
            unread1: 0,
            unread2: 1
        };
        conversations.push(conversation);
    }
    saveConversations(conversations);
    
    // 3. 如果对方在线，通过WebSocket推送
    const targetWs = onlineUsers.get(parseInt(toUserId));
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
            type: 'new_message',
            fromUserId: parseInt(fromUserId),
            content: content,
            time: formatTime(new Date().toISOString())
        }));
    }
    
    res.json({
        code: 200,
        message: '发送成功',
        data: {
            time: formatTime(new Date().toISOString())
        }
    });
});

// ========== 8. 标记消息已读 ==========
app.post('/api/messages/read', (req, res) => {
    const { userId, otherUserId } = req.body;
    
    if (!userId || !otherUserId) {
        return res.json({ code: 400, message: '缺少参数' });
    }
    
    const messages = getMessages();
    let updated = false;
    messages.forEach(m => {
        if (m.fromUserId === parseInt(otherUserId) && m.toUserId === parseInt(userId) && !m.isRead) {
            m.isRead = true;
            updated = true;
        }
    });
    if (updated) {
        saveMessages(messages);
    }
    
    const conversations = getConversations();
    const conversation = conversations.find(c => 
        (c.userId1 === parseInt(userId) && c.userId2 === parseInt(otherUserId)) ||
        (c.userId1 === parseInt(otherUserId) && c.userId2 === parseInt(userId))
    );
    
    if (conversation) {
        if (conversation.userId1 === parseInt(userId)) {
            conversation.unread1 = 0;
        } else {
            conversation.unread2 = 0;
        }
        saveConversations(conversations);
    }
    
    res.json({ code: 200, message: '已读' });
});

// ========== WebSocket 实时通信 ==========
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 后端跑起来了！`);
    console.log(`📌 端口: ${PORT}`);
    console.log(`📌 环境: ${process.env.RENDER ? 'Render' : '本地'}`);
    console.log(`📌 数据目录: ${DATA_DIR}`);
});

const wss = new WebSocket.Server({ server });

// 存储所有在线用户
const onlineUsers = new Map();

wss.on('connection', (ws, req) => {
    console.log('🟢 有用户连接了');
    
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId');
    
    if (userId) {
        onlineUsers.set(parseInt(userId), ws);
        console.log(`用户 ${userId} 上线了，当前在线人数: ${onlineUsers.size}`);
        broadcastOnlineUsers();
    }
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('收到WebSocket消息:', data);
            
            if (data.type === 'chat') {
                const targetWs = onlineUsers.get(data.toUserId);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: 'new_message',
                        fromUserId: data.fromUserId,
                        content: data.content,
                        time: formatTime(new Date().toISOString())
                    }));
                }
            }
        } catch (e) {
            console.error('消息解析错误:', e);
        }
    });
    
    ws.on('close', () => {
        if (userId) {
            onlineUsers.delete(parseInt(userId));
            console.log(`用户 ${userId} 下线了，当前在线人数: ${onlineUsers.size}`);
            broadcastOnlineUsers();
        }
    });
});

// 广播在线用户列表
function broadcastOnlineUsers() {
    const onlineUserIds = Array.from(onlineUsers.keys());
    const message = JSON.stringify({
        type: 'online_users',
        users: onlineUserIds
    });
    
    onlineUsers.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// 工具函数：格式化时间
function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / (60 * 1000)) + '分钟前';
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / (60 * 60 * 1000)) + '小时前';
    if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / (24 * 60 * 60 * 1000)) + '天前';
    
    return date.toLocaleDateString();
}

// 健康检查接口（防止Render休眠）
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});
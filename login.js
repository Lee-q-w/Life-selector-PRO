// ========== 获取DOM元素 ==========
// 登录相关
const loginBtn = document.getElementById('login-btn');
const loginPhone = document.getElementById('login-phone');
const loginPassword = document.getElementById('login-password');

// 注册相关（你的HTML里要有这些元素）
const registerBtn = document.getElementById('register-btn');
const registerPhone = document.getElementById('register-phone');
const registerNickname = document.getElementById('register-nickname');
const registerPassword = document.getElementById('register-password');
const registerConfirm = document.getElementById('register-confirm');

// 切换标签
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// 消息提示
const messageBox = document.getElementById('message-box');

// ========== 后端地址 ==========
const API_BASE_URL = 'http://localhost:3000';  // 如果你的端口改了，比如3001，就改成3001

// ========== 显示消息 ==========
function showMessage(text, type = 'error') {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = `message-box show ${type}`;
    setTimeout(() => messageBox.classList.remove('show'), 3000);
}

// ========== 切换登录/注册 ==========
if (loginTab && registerTab && loginForm && registerForm) {
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });

    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
}

// ========== 登录 ==========
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        // 获取输入的值
        const phone = loginPhone ? loginPhone.value.trim() : '';
        const password = loginPassword ? loginPassword.value.trim() : '';
        
        // 简单验证
        if (!phone || !password) {
            showMessage('请填写手机号和密码');
            return;
        }
        
        showMessage('登录中...', 'success');
        
        try {
            // 调用后端登录接口
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: phone,
                    password: password
                })
            });
            
            const result = await response.json();
            console.log('登录返回:', result);
            
            if (result.code === 200) {
                // 登录成功
                const userData = result.data;
                
                // 存到 localStorage
                localStorage.setItem('token', userData.token);
                localStorage.setItem('user', JSON.stringify({
                    id: userData.id,
                    nickname: userData.nickname,
                    avatar: userData.avatar
                }));
                
                showMessage('登录成功，跳转中...', 'success');
                
                // 跳转到首页
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                showMessage(result.message || '登录失败');
            }
        } catch (error) {
            console.error('登录错误:', error);
            showMessage('网络错误，请确认后端是否启动');
        }
    });
}

// ========== 注册 ==========
if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
        // 获取输入的值
        const phone = registerPhone ? registerPhone.value.trim() : '';
        const nickname = registerNickname ? registerNickname.value.trim() : '';
        const password = registerPassword ? registerPassword.value.trim() : '';
        const confirm = registerConfirm ? registerConfirm.value.trim() : '';
        
        // 验证
        if (!phone || !nickname || !password || !confirm) {
            showMessage('请填写所有字段');
            return;
        }
        
        if (password.length < 6) {
            showMessage('密码至少6位');
            return;
        }
        
        if (password !== confirm) {
            showMessage('两次密码不一致');
            return;
        }
        
        showMessage('注册中...', 'success');
        
        try {
            // 调用后端注册接口
            const response = await fetch(`${API_BASE_URL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    phone: phone,
                    nickname: nickname,
                    password: password
                })
            });
            
            const result = await response.json();
            console.log('注册返回:', result);
            
            if (result.code === 200) {
                // 注册成功
                const userData = result.data;
                
                // 存到 localStorage
                localStorage.setItem('token', userData.token);
                localStorage.setItem('user', JSON.stringify({
                    id: userData.id,
                    nickname: userData.nickname,
                    avatar: userData.avatar
                }));
                
                showMessage('注册成功，跳转中...', 'success');
                
                // 跳转到首页
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                showMessage(result.message || '注册失败');
            }
        } catch (error) {
            console.error('注册错误:', error);
            showMessage('网络错误，请确认后端是否启动');
        }
    });
}

// ========== 检查是否已登录 ==========
if (localStorage.getItem('token')) {
    window.location.href = 'index.html';
}
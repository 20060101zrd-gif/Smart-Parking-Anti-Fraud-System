const express = require('express');
const cors = require('cors');
const crypto = require('crypto'); 
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// 内存数据库
let blacklistedHashes = new Set();
let activeUsers = new Map(); 
let systemLogs = [];

const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    systemLogs.unshift({ time, message, type }); 
    if (systemLogs.length > 50) systemLogs.pop(); 
    console.log(`[${time}] ${message}`);
};

const generateHash = (phone) => {
    const salt = "Company_Secret_Salt_2026"; 
    return crypto.createHash('sha256').update(phone + salt).digest('hex').toUpperCase();
};

// API: 注册/登录
app.post('/api/register', (req, res) => {
    const { phone, name } = req.body;
    addLog(`[API] 收到手机号: ${phone} 的登录请求`, 'info');
    
    const userHash = generateHash(phone);
    
    let isNewUser = true;
    let alreadyReceived = false;

    // 🌟 核心逻辑更新：判断用户当前状态
    if (blacklistedHashes.has(userHash)) {
        addLog(`[风控拦截] ⚠️ 哈希匹配黑名单库！拒绝发放免费券。`, 'error');
        isNewUser = false;
    } else if (activeUsers.has(phone)) {
        addLog(`[状态提示] ℹ️ 用户 ${phone} 再次登录，已领取过免单券。`, 'warning');
        alreadyReceived = true; // 标记为已领取
    } else {
        addLog(`[风控] 生成单向加密哈希: SHA256_${userHash.substring(0, 16)}...`, 'process');
        addLog(`[风控通过] ✅ 全新用户，发放免费券。`, 'success');
    }

    activeUsers.set(phone, { phone, name, hash: userHash });
    
    // 返回数据加上 alreadyReceived 标志
    res.json({ 
        success: true, 
        data: { name, phone, hash: userHash, hasCoupon: isNewUser, alreadyReceived: alreadyReceived } 
    });
});

// API: 注销账号
app.post('/api/cancel', (req, res) => {
    const { phone, hash } = req.body;
    addLog(`[API] 用户 ${phone} 请求注销账号`, 'warning');
    
    blacklistedHashes.add(hash);
    addLog(`[数据隔离] 已将该用户哈希加入历史黑名单。`, 'process');

    activeUsers.delete(phone);
    addLog(`[合规擦除] 手机号 ${phone} 的明文个人信息已彻底删除！`, 'success');
    res.json({ success: true });
});

// API: 管理员手动解封黑名单
app.post('/api/admin/remove-blacklist', (req, res) => {
    const { hash } = req.body;
    if (blacklistedHashes.has(hash)) {
        blacklistedHashes.delete(hash);
        addLog(`[管理员介入] 🛡️ 管理员手动解封了设备哈希: ${hash.substring(0, 16)}...`, 'warning');
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// API: 管理员强制删除当前活动用户
app.post('/api/admin/remove-user', (req, res) => {
    const { phone } = req.body;
    if (activeUsers.has(phone)) {
        activeUsers.delete(phone);
        addLog(`[特权介入] 🛡️ 管理员强制删除了活动账号: ${phone}`, 'warning');
        res.json({ success: true });
    } else {
        res.json({ success: false, message: '该用户已不存在' });
    }
});

// API: 提供给控制台的数据
app.get('/api/admin/data', (req, res) => {
    res.json({ logs: systemLogs, blacklist: Array.from(blacklistedHashes), users: Array.from(activeUsers.values()) });
});

// 网页版管理员控制台
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head><meta charset="UTF-8"><title>风控控制台</title><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="bg-gray-900 text-white p-8 font-mono">
            <h1 class="text-3xl font-bold text-blue-400 mb-8">🛡️ 服务器风控监控面板</h1>
            <div class="grid grid-cols-2 gap-8 mb-8">
                <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h2 class="text-xl font-bold text-green-400 mb-4 flex justify-between">
                        <span> 当前活动用户 (明文)</span>
                        <span id="userCount" class="text-sm bg-gray-700 px-2 py-1 rounded">0</span>
                    </h2>
                    <div id="usersList" class="space-y-2 h-48 overflow-y-auto pr-2"></div>
                </div>
                <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h2 class="text-xl font-bold text-red-400 mb-4 flex justify-between">
                        <span> 历史注销黑名单 (哈希)</span>
                        <span id="hashCount" class="text-sm bg-gray-700 px-2 py-1 rounded">0</span>
                    </h2>
                    <div id="blacklistList" class="space-y-2 h-48 overflow-y-auto text-sm text-gray-400 pr-2"></div>
                </div>
            </div>
            <div class="bg-black p-6 rounded-xl border border-gray-700">
                <h2 class="text-xl font-bold text-yellow-400 mb-4">_ SERVER LOGS</h2>
                <div id="logsList" class="space-y-1 h-64 overflow-y-auto text-sm"></div>
            </div>
            
            <script>
                async function removeHash(hash) {
                    if(confirm('确定要解封该设备吗？\\n解封后该用户再次注册将重新获得新人免单券！')) {
                        await fetch('/api/admin/remove-blacklist', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ hash })
                        });
                        fetchData(); 
                    }
                }

                // 前端点击触发强制删除用户的函数
                async function removeActiveUser(phone) {
                    if(confirm('⚠️ 确定要删除并擦除该活动用户的资料吗？')) {
                        await fetch('/api/admin/remove-user', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone })
                        });
                        fetchData(); 
                    }
                }

                async function fetchData() {
                    try {
                        const res = await fetch('/api/admin/data');
                        const data = await res.json();
                        
                        document.getElementById('userCount').innerText = data.users.length;
                        document.getElementById('usersList').innerHTML = data.users.length ? 
                            data.users.map(u => \`
                                <div class="bg-gray-900 border border-gray-700 p-2 rounded flex justify-between items-center group transition-colors hover:border-gray-500 mb-2">
                                    <div>
                                        <span class="text-green-400 font-bold mr-2">●</span>
                                        <span class="text-white font-bold">\${u.name}</span>
                                        <span class="text-gray-400 text-sm ml-2">\${u.phone}</span>
                                    </div>
                                    <button onclick="removeActiveUser('\${u.phone}')" class="text-xs bg-red-900/50 hover:bg-red-800 text-red-400 border border-red-700 px-2 py-1 rounded transition-all cursor-pointer shadow-md">删除</button>
                                </div>
                            \`).join('') : '<div class="text-gray-500">空</div>';
                        
                        document.getElementById('hashCount').innerText = data.blacklist.length;
                        document.getElementById('blacklistList').innerHTML = data.blacklist.length ? 
                            data.blacklist.map(h => \`
                                <div class="bg-gray-900 border border-red-900/50 p-2 rounded flex justify-between items-center group transition-colors hover:border-red-500 mb-2">
                                    <span class="truncate w-3/4" title="\${h}">🔒 \${h}</span>
                                    <button onclick="removeHash('\${h}')" class="text-xs bg-red-900/80 hover:bg-red-500 text-white px-2 py-1 rounded transition-all cursor-pointer shadow-md">解封</button>
                                </div>
                            \`).join('') : '<div class="text-gray-500">空</div>';
                            
                        document.getElementById('logsList').innerHTML = data.logs.length ? 
                            data.logs.map(l => \`<div class="\${l.type==='error'?'text-red-400':l.type==='warning'?'text-yellow-400':l.type==='success'?'text-green-400':l.type==='process'?'text-blue-400':'text-gray-300'}">[\${l.time}] \${l.message}</div>\`).join('') : '<div class="text-gray-500">等待...</div>';
                    } catch (e) {}
                }
                
                fetchData(); setInterval(fetchData, 1000);
            </script>
        </body></html>
    `);
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    const url = `http://localhost:${PORT}`;
    console.log(` 后端启动完毕！系统正在为您自动打开浏览器...`);
    
    let command;
    if (process.platform === 'win32') {
        command = `start ${url}`;
    } else if (process.platform === 'darwin') {
        command = `open ${url}`; 
    } else {
        command = `xdg-open ${url}`; 
    }
    
    exec(command);
});

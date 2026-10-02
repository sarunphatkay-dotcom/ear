const SUPABASE_URL = 'https://igosoicvnmxyuyvjobvb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cdu0ai03cHS7oHk6a-yexA_ZnlUOgof';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const PALETTE = ['#2d7ef5','#a78bfa','#10d97c','#ffb547','#ff5a72','#00e5ff','#ff6bbd','#f97316','#06b6d4','#84cc16'];
const CAT_COLORS = ['#ff5a72','#ffb547','#2d7ef5','#10d97c','#a78bfa','#ff6bbd','#059a56','#f97316','#06b6d4','#6b84aa'];
const DEFAULT_GOALS = [
  {emoji:'📚',name:'อ่านหนังสือ',color:'#2d7ef5'},
  {emoji:'🏃',name:'ออกกำลังกาย',color:'#a78bfa'},
  {emoji:'📖',name:'ทบทวนบทเรียน',color:'#00b4d8'},
  {emoji:'💧',name:'ดื่มน้ำ 8 แก้ว',color:'#10d97c'},
  {emoji:'🌙',name:'นอนก่อน 22.00',color:'#ffb547'},
];

let currentUser = null;
let appData = { info:{}, goals:DEFAULT_GOALS, rows:{}, txs:[] };
let finType = 'income';
let finFilter = 'all';
let theme = localStorage.getItem('theme') || 'light';

async function api(fnName, params) {
  setSyncStatus('loading', 'กำลังซิงค์...');
  try {
    const { data, error } = await sb.rpc(fnName, params);
    if (error) throw new Error(error.message);
    if (data && data.error) throw new Error(data.error);
    setSyncStatus('ok', 'ซิงค์แล้ว · ' + new Date().toLocaleTimeString('th-TH'));
    return data;
  } catch(err) {
    setSyncStatus('error', 'ซิงค์ไม่สำเร็จ: ' + err.message);
    throw err;
  }
}

function setSyncStatus(state, text) {
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-text');
  if (!dot) return;
  dot.className = 'sync-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
  txt.textContent = text;
}

function toast(msg, color) {
  const el = document.getElementById('toast-el');
  el.textContent = msg;
  el.style.background = color || 'var(--green)';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  localStorage.setItem('theme', theme);
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function switchTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tab-login').className = 'auth-tab' + (tab === 'login' ? ' active' : '');
  document.getElementById('tab-register').className = 'auth-tab' + (tab === 'register' ? ' active' : '');
  document.getElementById('login-err').classList.remove('show');
  document.getElementById('reg-err').classList.remove('show');
  document.getElementById('reg-ok').classList.remove('show');
}

let sdtLaunched = false;
let splashSim = null;

function createSplashSimulation() {
  const canvas = document.getElementById('splashCanvas');
  const wrap = document.getElementById('targetWrap');
  if (!canvas || !wrap) return null;
  const ctx = canvas.getContext('2d');
  const cfg = {
    g: 9.81, rho: 1.225, mass: 0.025, diameter: 0.008, cd: 0.35,
    springK: 520, draw: 0.70, efficiency: 0.82, movingMass: 0.029,
    theta: 35 * Math.PI / 180, phi: 8 * Math.PI / 180,
    wind: { x: 0, y: 0, z: 1.5 }, dt: 0.004
  };
  cfg.area = Math.PI * Math.pow(cfg.diameter / 2, 2);
  cfg.v0 = Math.sqrt(cfg.efficiency * cfg.springK * cfg.draw * cfg.draw / cfg.movingMass);
  cfg.releaseSeconds = Math.PI * 0.5 * Math.sqrt(cfg.movingMass / (cfg.efficiency * cfg.springK));

  const add = (a, b, scale = 1) => ({ x:a.x+b.x*scale, y:a.y+b.y*scale, z:a.z+b.z*scale });
  const mix4 = (a,b,c,d,scale) => ({
    x:(a.x+2*b.x+2*c.x+d.x)*scale,
    y:(a.y+2*b.y+2*c.y+d.y)*scale,
    z:(a.z+2*b.z+2*c.z+d.z)*scale
  });
  const acceleration = v => {
    const rel = { x:v.x-cfg.wind.x, y:v.y-cfg.wind.y, z:v.z-cfg.wind.z };
    const speed = Math.hypot(rel.x, rel.y, rel.z);
    const drag = -.5 * cfg.rho * cfg.cd * cfg.area * speed / cfg.mass;
    return { x:drag*rel.x, y:-cfg.g+drag*rel.y, z:drag*rel.z };
  };
  const rk4 = (p, v) => {
    const k1p=v, k1v=acceleration(v);
    const k2p=add(v,k1v,cfg.dt/2), k2v=acceleration(add(v,k1v,cfg.dt/2));
    const k3p=add(v,k2v,cfg.dt/2), k3v=acceleration(add(v,k2v,cfg.dt/2));
    const k4p=add(v,k3v,cfg.dt), k4v=acceleration(add(v,k3v,cfg.dt));
    return { p:add(p,mix4(k1p,k2p,k3p,k4p,cfg.dt/6)), v:add(v,mix4(k1v,k2v,k3v,k4v,cfg.dt/6)) };
  };

  const direction = {
    x:Math.cos(cfg.theta)*Math.cos(cfg.phi),
    y:Math.sin(cfg.theta),
    z:Math.cos(cfg.theta)*Math.sin(cfg.phi)
  };
  const points = [{ x:0, y:1.45, z:0 }];
  const velocities = [{ x:direction.x*cfg.v0, y:direction.y*cfg.v0, z:direction.z*cfg.v0 }];
  let p = {...points[0]}, v = {...velocities[0]};
  for (let i=0; i<Math.ceil(30/cfg.dt); i++) {
    const oldP={...p}, oldV={...v}, step=rk4(p,v);
    p=step.p; v=step.v;
    if (p.y <= 0) {
      const f=oldP.y/(oldP.y-p.y);
      p={x:oldP.x+(p.x-oldP.x)*f,y:0,z:oldP.z+(p.z-oldP.z)*f};
      v={x:oldV.x+(v.x-oldV.x)*f,y:oldV.y+(v.y-oldV.y)*f,z:oldV.z+(v.z-oldV.z)*f};
      points.push(p); velocities.push(v); break;
    }
    points.push({...p}); velocities.push({...v});
  }

  const end = points[points.length-1];
  const range = Math.hypot(end.x,end.z);
  const maxY = points.reduce((m,q)=>Math.max(m,q.y),0);
  let width=1, height=1, dpr=1, mode='idle', phaseStart=0, impactAt=0;

  function resize() {
    const rect=canvas.getBoundingClientRect();
    dpr=Math.min(window.devicePixelRatio||1,2);
    width=Math.max(1,rect.width); height=Math.max(1,rect.height);
    canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function project(q) {
    const left=width*.075, right=width*.93, ground=height*.78;
    const perspective=(q.z/(range||1))*width*.28;
    return {
      x:left+(q.x/(range||1))*(right-left)+perspective,
      y:ground-(q.y/(maxY*1.22||1))*height*.57-perspective*.18
    };
  }
  function glow(x,y,r,alpha,color) {
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color.replace('ALPHA',alpha));g.addColorStop(1,color.replace('ALPHA','0'));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  function drawGround() {
    const gy=height*.78;
    ctx.strokeStyle='rgba(96,168,255,.13)';ctx.lineWidth=1;
    for(let i=0;i<7;i++){const y=gy+i*i*height*.006;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
    for(let i=-6;i<=7;i++){ctx.beginPath();ctx.moveTo(width*.52,gy-height*.08);ctx.lineTo(width*.52+i*width*.16,height);ctx.stroke()}
    const haze=ctx.createLinearGradient(0,gy-height*.25,0,height);haze.addColorStop(0,'rgba(0,229,255,0)');haze.addColorStop(1,'rgba(0,229,255,.055)');ctx.fillStyle=haze;ctx.fillRect(0,gy-height*.25,width,height);
  }
  function drawTarget(alpha=1) {
    const q=project(end), radius=Math.max(13,width*.025);
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(q.x,q.y);
    ctx.strokeStyle='rgba(207,232,255,.45)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,radius);ctx.lineTo(0,height*.17);ctx.stroke();
    ['#ff5a72','#f7faff','#2d7ef5','#f7faff','#ffb547'].forEach((c,i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,radius*(1-i*.17),0,Math.PI*2);ctx.fill()});
    ctx.restore();
  }
  function drawBow(compression=1) {
    const origin=project(points[0]), size=Math.max(40,width*.065), nock=origin.x-size*.55*compression;
    ctx.save();ctx.lineCap='round';ctx.lineWidth=4;ctx.strokeStyle='#ffb547';ctx.shadowBlur=12;ctx.shadowColor='rgba(255,181,71,.55)';
    ctx.beginPath();ctx.moveTo(origin.x,origin.y-size);ctx.quadraticCurveTo(origin.x+size*.45,origin.y,origin.x,origin.y+size);ctx.stroke();
    ctx.shadowBlur=0;ctx.lineWidth=1.5;ctx.strokeStyle='rgba(207,232,255,.8)';ctx.beginPath();ctx.moveTo(origin.x,origin.y-size);ctx.lineTo(nock,origin.y);ctx.lineTo(origin.x,origin.y+size);ctx.stroke();ctx.restore();
    return {x:nock,y:origin.y};
  }
  function drawArrow(q, velocity, overridePoint) {
    const a=overridePoint||project(q), speed=Math.hypot(velocity.x,velocity.y,velocity.z)||1;
    const tip3={x:q.x+velocity.x/speed*8,y:q.y+velocity.y/speed*8,z:q.z+velocity.z/speed*8};
    const b=project(tip3), angle=Math.atan2(b.y-a.y,b.x-a.x), length=Math.max(34,width*.062);
    ctx.save();ctx.translate(a.x,a.y);ctx.rotate(angle);ctx.strokeStyle='#cfe8ff';ctx.lineWidth=2.4;ctx.shadowBlur=10;ctx.shadowColor='rgba(0,229,255,.75)';ctx.beginPath();ctx.moveTo(-length*.65,0);ctx.lineTo(length*.55,0);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(length*.7,0);ctx.lineTo(length*.42,-5);ctx.lineTo(length*.42,5);ctx.closePath();ctx.fill();ctx.strokeStyle='#ff5a72';ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-length*.65,0);ctx.lineTo(-length*.48,-6);ctx.moveTo(-length*.65,0);ctx.lineTo(-length*.48,6);ctx.stroke();ctx.restore();
  }
  function drawTrail(last, idle=false) {
    ctx.save();ctx.strokeStyle=idle?'rgba(0,229,255,.16)':'rgba(0,229,255,.72)';ctx.lineWidth=idle?1.2:2;ctx.setLineDash(idle?[5,7]:[]);ctx.beginPath();
    for(let i=0;i<=last;i+=Math.max(1,Math.floor(points.length/420))){const q=project(points[i]);if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y)}ctx.stroke();ctx.restore();
  }
  function render(now) {
    ctx.clearRect(0,0,width,height);drawGround();drawTarget();
    let idx=0, compression=1, arrowPoint=null;
    if(mode==='idle'){drawTrail(points.length-1,true);arrowPoint=drawBow(1)}
    else if(mode==='release'){
      const a=Math.min(1,(now-phaseStart)/320);compression=Math.cos(a*Math.PI/2);arrowPoint=drawBow(compression);
      if(a>=1){mode='flight';phaseStart=now}
    } else if(mode==='flight'){
      drawBow(0);const physical=(now-phaseStart)/1000*4.4;idx=Math.min(points.length-1,Math.floor(physical/cfg.dt));drawTrail(idx);
      if(idx>=points.length-1){mode='impact';impactAt=now;wrap.classList.add('impact')}
    } else {drawBow(0);idx=points.length-1;drawTrail(idx)}
    if(mode==='idle'||mode==='release')drawArrow(points[0],velocities[0],arrowPoint);else drawArrow(points[idx],velocities[idx]);
    if(mode==='impact'||mode==='done'){
      const hit=project(end), age=Math.min(1,(now-impactAt)/430);glow(hit.x,hit.y,95*age,1-age,'rgba(0,229,255,ALPHA)');
      if(mode==='impact'&&age>=1){mode='done';document.getElementById('splash').classList.add('hidden');document.getElementById('authBox').classList.add('show')}
    }
    ctx.fillStyle='rgba(207,232,255,.62)';ctx.font='600 11px Prompt, sans-serif';ctx.textAlign='right';ctx.fillText('v₀ '+cfg.v0.toFixed(1)+' m/s  •  θ 35°',width-17,22);ctx.fillText('flight '+((points.length-1)*cfg.dt).toFixed(2)+' s  •  '+range.toFixed(1)+' m',width-17,39);
    requestAnimationFrame(render);
  }
  function start(){if(mode!=='idle')return;sdtLaunched=true;mode='release';phaseStart=performance.now();wrap.classList.remove('idle');wrap.classList.add('running')}
  function reset(){mode='idle';phaseStart=0;impactAt=0;wrap.classList.add('idle');wrap.classList.remove('running','impact')}
  resize();requestAnimationFrame(render);
  return {start,reset,resize};
}

function initSplash() {
  const wrap = document.getElementById('targetWrap');
  if (!wrap || wrap._bound) return;
  wrap._bound = true;
  splashSim = createSplashSimulation();
  wrap.addEventListener('click', () => splashSim?.start());
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); splashSim?.start(); }
  });
  window.addEventListener('resize', () => splashSim?.resize());
}
function resetSplash() {
  sdtLaunched = false;
  const splash = document.getElementById('splash');
  const box = document.getElementById('authBox');
  if (splash) splash.classList.remove('hidden');
  if (box) box.classList.remove('show');
  splashSim?.reset();
}

function togglePw(id, btn) {
  const input = document.getElementById(id);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.textContent = isText ? '👁️' : '🙈';
}

function setAuthLoading(show) {
  document.getElementById('auth-loading').className = 'auth-loading' + (show ? ' show' : '');
  document.getElementById('login-btn').disabled = show;
  document.getElementById('reg-btn').disabled = show;
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  document.getElementById('login-err').classList.remove('show');
  if (!email || !pw) {
    showAuthErr('login', 'กรุณากรอก Email และ Password');
    return;
  }
  setAuthLoading(true);
  try {
    const { data, error } = await sb.rpc('sdt_login', { p_email: email, p_password: pw });
    if (error) { showAuthErr('login', 'เชื่อมต่อไม่ได้ กรุณาลองใหม่'); return; }
    if (data.error) { showAuthErr('login', data.error); return; }
    const remember = document.getElementById('login-remember').checked;
    await onLoginSuccess(data.user, remember);
  } catch(e) {
    showAuthErr('login', 'เชื่อมต่อไม่ได้ กรุณาลองใหม่');
  } finally {
    setAuthLoading(false);
  }
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pw = document.getElementById('reg-pw').value;
  document.getElementById('reg-err').classList.remove('show');
  document.getElementById('reg-ok').classList.remove('show');
  if (!name || !email || !pw) { showAuthErr('reg', 'กรุณากรอกข้อมูลให้ครบ'); return; }
  setAuthLoading(true);
  try {
    const { data, error } = await sb.rpc('sdt_register', { p_name: name, p_email: email, p_password: pw });
    if (error) { showAuthErr('reg', 'เชื่อมต่อไม่ได้ กรุณาลองใหม่'); return; }
    if (data.error) { showAuthErr('reg', data.error); return; }
    document.getElementById('reg-ok').classList.add('show');
    setTimeout(() => {
      switchTab('login');
      document.getElementById('login-email').value = email;
    }, 1800);
  } catch(e) {
    showAuthErr('reg', 'เชื่อมต่อไม่ได้ กรุณาลองใหม่');
  } finally {
    setAuthLoading(false);
  }
}

function showAuthErr(prefix, msg) {
  const el = document.getElementById(prefix + '-err');
  document.getElementById(prefix + '-err-msg').textContent = msg;
  el.classList.add('show');
}

async function onLoginSuccess(user, remember) {
  currentUser = user;
  if (remember) {
    localStorage.setItem('sdtUser', JSON.stringify(user));
    sessionStorage.removeItem('sdtUser');
  } else {
    sessionStorage.setItem('sdtUser', JSON.stringify(user));
    localStorage.removeItem('sdtUser');
  }
  showApp();
  await loadUserData();
}

async function loadUserData() {
  showAppLoading('กำลังโหลดข้อมูลจาก Supabase...');
  try {
    const uid = currentUser.uid;
    const { data, error } = await sb.rpc('sdt_get_user_data', { p_uid: uid });
    if (error) throw new Error(error.message);
    appData.txs = data.txs || [];
    appData.rows = data.rows || {};
    appData.goals = (data.goals && data.goals.length) ? data.goals : DEFAULT_GOALS;
    appData.info = data.info || {};
    hideAppLoading();
    setSyncStatus('ok', 'โหลดข้อมูลสำเร็จ · ' + new Date().toLocaleTimeString('th-TH'));
    toast('✅ โหลดข้อมูลสำเร็จ!');
    requestAnimationFrame(() => {
      setTimeout(() => renderFinance(), 80);
    });
  } catch(e) {
    hideAppLoading();
    setSyncStatus('error', 'โหลดข้อมูลไม่สำเร็จ');
    toast('⚠️ โหลดข้อมูลไม่สำเร็จ', '#ff5a72');
  }
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('uc-name').textContent = currentUser.name;
  document.getElementById('uc-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('hdr-greeting').textContent = 'สวัสดี, ' + currentUser.name;
  applyTheme();
}

function showAppLoading(text) {
  const el = document.getElementById('app-loading');
  document.getElementById('app-loading-text').textContent = text;
  el.style.display = 'flex';
}
function hideAppLoading() {
  document.getElementById('app-loading').style.display = 'none';
}

function doLogout() {
  if (!confirm('ออกจากระบบ?')) return;
  currentUser = null;
  appData = { info:{}, goals:DEFAULT_GOALS, rows:{}, txs:[] };
  localStorage.removeItem('sdtUser');
  sessionStorage.removeItem('sdtUser');
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('login-pw').value = '';
  resetSplash();
}

function go(pg) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pg).classList.add('active');
  const idx = ['settings','log','dashboard','finance'].indexOf(pg);
  document.querySelectorAll('.nav-btn')[idx].classList.add('active');
  if (pg === 'log') renderLog();
  if (pg === 'dashboard') renderDash();
  if (pg === 'finance') requestAnimationFrame(() => setTimeout(renderFinance, 60));
  if (pg === 'settings') loadSettings();
}

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}
function loadSettings() {
  document.getElementById('s-name').value = appData.info.name || currentUser.name || '';
  document.getElementById('s-class').value = appData.info.cls || '';
  document.getElementById('s-month').value = appData.info.month || currentMonth();
  renderGoalsList();
}
function renderGoalsList() {
  const list = document.getElementById('goals-list');
  list.innerHTML = '';
  appData.goals.forEach((g, i) => {
    const row = document.createElement('div');
    row.className = 'goal-row';
    row.innerHTML = `
      <input class="goal-emoji-input" value="${g.emoji}" maxlength="2" oninput="appData.goals[${i}].emoji=this.value">
      <input class="goal-name-input" value="${g.name}" placeholder="ชื่อเป้าหมาย" oninput="appData.goals[${i}].name=this.value">
      <div class="color-pick" id="cp-${i}"></div>
      <button class="btn btn-danger" onclick="removeGoal(${i})">✕</button>`;
    list.appendChild(row);
    renderColorPick(i, g.color);
  });
}
function renderColorPick(i, sel) {
  const wrap = document.getElementById(`cp-${i}`);
  if (!wrap) return;
  wrap.innerHTML = '';
  PALETTE.forEach(c => {
    const d = document.createElement('div');
    d.className = 'cp-dot' + (c === sel ? ' sel' : '');
    d.style.background = c;
    d.onclick = () => { appData.goals[i].color = c; renderColorPick(i, c); };
    wrap.appendChild(d);
  });
}
function addGoal() {
  if (appData.goals.length >= 10) { toast('⚠️ เพิ่มได้สูงสุด 10 ข้อ', '#ffb547'); return; }
  appData.goals.push({ emoji:'⭐', name:'เป้าหมายใหม่', color:PALETTE[appData.goals.length % PALETTE.length] });
  renderGoalsList();
}
function removeGoal(i) {
  if (appData.goals.length <= 1) { toast('⚠️ ต้องมีอย่างน้อย 1 เป้าหมาย', '#ffb547'); return; }
  appData.goals.splice(i, 1);
  renderGoalsList();
}
async function saveSettings() {
  appData.info.name = document.getElementById('s-name').value;
  appData.info.cls = document.getElementById('s-class').value;
  appData.info.month = document.getElementById('s-month').value || currentMonth();
  try {
    await api('sdt_save_goals', { p_uid:currentUser.uid, p_goals:appData.goals });
    await api('sdt_save_info', { p_uid:currentUser.uid, p_info:appData.info });
    const fl = document.getElementById('save-flash');
    fl.classList.add('show');
    setTimeout(() => fl.classList.remove('show'), 2000);
    toast('☁️ บันทึกและซิงค์แล้ว!');
  } catch(e) {
    toast('⚠️ ซิงค์ไม่สำเร็จ', '#ff5a72');
  }
}

function getDays() {
  const m = appData.info.month || currentMonth();
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}
function dayPct(row, goalCount) {
  if (!row || !row.length || !goalCount) return 0;
  return Math.round(row.filter(Boolean).length / goalCount * 100);
}
function pctColor(p) {
  return p>=80?'#10d97c':p>=50?'#ffb547':'#ff5a72';
}
function renderLog() {
  const goals = appData.goals, days = getDays();
  document.getElementById('log-thead').innerHTML = `<tr>
    <th>วันที่</th>${goals.map(g=>`<th>${g.emoji} ${g.name}</th>`).join('')}<th>สำเร็จ</th><th>%</th></tr>`;
  const tbody = document.getElementById('log-tbody');
  tbody.innerHTML = '';
  let completeCount = 0;
  for (let d = 1; d <= days; d++) {
    const row = appData.rows[d] || Array(goals.length).fill(false);
    while (row.length < goals.length) row.push(false);
    const filled = row.filter(Boolean).length;
    if (filled === goals.length) completeCount++;
    const p = dayPct(row, goals.length);
    const tr = document.createElement('tr');
    if (filled === goals.length) tr.classList.add('full-row');
    let cells = `<td>วันที่ ${d}</td>`;
    for (let g = 0; g < goals.length; g++) {
      cells += `<td><div class="chk-wrap">
        <input type="checkbox" id="c${d}_${g}" ${row[g]?'checked':''} onchange="toggle(${d},${g})">
        <label class="chk-box" for="c${d}_${g}">✓</label>
      </div></td>`;
    }
    cells += `<td><div class="row-dots">${row.map(v=>`<div class="rdot${v?' on':''}"></div>`).join('')}</div></td>`;
    cells += `<td><span class="pct-badge" style="background:${pctColor(p)}22;color:${pctColor(p)}">${p}%</span></td>`;
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  }
  document.getElementById('log-badge').textContent = `${completeCount}/${days} วัน`;
}
function toggle(day, goal) {
  if (!appData.rows[day]) appData.rows[day] = Array(appData.goals.length).fill(false);
  while (appData.rows[day].length < appData.goals.length) appData.rows[day].push(false);
  appData.rows[day][goal] = !appData.rows[day][goal];
  renderLog();
}
async function syncRows() {
  try {
    await api('sdt_save_rows', { p_uid:currentUser.uid, p_rows:appData.rows });
    toast('☁️ ซิงค์ข้อมูลบันทึกแล้ว!');
  } catch(e) {
    toast('⚠️ ซิงค์ไม่สำเร็จ', '#ff5a72');
  }
}


function getStats() {
  const goals = appData.goals, days = getDays();
  const counts = Array(goals.length).fill(0);
  let totalDone = 0, daysAny = 0;
  const dailyPcts = [];
  for (let d = 1; d <= days; d++) {
    const row = appData.rows[d] || [];
    let any = false;
    for (let g = 0; g < goals.length; g++) { if (row[g]) { counts[g]++; any = true; } }
    if (any) daysAny++;
    totalDone += row.filter(Boolean).length;
    dailyPcts.push(dayPct(row, goals.length));
  }
  const pcts = counts.map(c => Math.round(c/days*100));
  const overall = Math.round(totalDone/(days*goals.length)*100) || 0;
  return { counts, pcts, overall, days, daysAny, dailyPcts };
}
function renderDash() {
  const s = getStats(), goals = appData.goals;
  document.getElementById('d-overall').textContent = s.overall;
  document.getElementById('d-days').textContent = s.daysAny;
  document.getElementById('d-totaldays').textContent = s.days;
  let msg = '';
  if (s.overall >= 80) msg = `<div class="result-msg rm-great"><div class="rm-icon">🏆</div><div class="rm-text"><strong>ยอดเยี่ยม!</strong><span>รักษาความสม่ำเสมอต่อไป!</span></div></div>`;
  else if (s.overall >= 60) msg = `<div class="result-msg rm-good"><div class="rm-icon">👍</div><div class="rm-text"><strong>ทำได้ดี</strong><span>อีกนิดก็ยอดเยี่ยมแล้ว!</span></div></div>`;
  else msg = `<div class="result-msg rm-low"><div class="rm-icon">💪</div><div class="rm-text"><strong>ควรวางแผนให้มากขึ้น</strong><span>ลองตั้งเวลาเตือนและวางแผนล่วงหน้า</span></div></div>`;
  document.getElementById('d-msg').innerHTML = msg;
  document.getElementById('d-kpi').innerHTML = goals.map((g,i)=>`
    <div class="kpi-card" style="--kc:${g.color}">
      <div class="kpi-icon">${g.emoji}</div>
      <div class="kpi-lbl">${g.name}</div>
      <div class="kpi-val">${s.counts[i]}</div>
      <div class="kpi-sub">จาก ${s.days} วัน (${s.pcts[i]}%)</div></div>`).join('');
  document.getElementById('d-prog').innerHTML = goals.map((g,i)=>{
    const p = s.pcts[i], fc = p>=80?'#10d97c':p>=60?'#ffb547':'#ff5a72';
    return `<div class="prog-item">
      <div class="prog-hdr"><div class="prog-name">${g.emoji} ${g.name}</div><div class="prog-pct">${p}%</div></div>
      <div class="prog-bg"><div class="prog-fill" style="width:${p}%;background:linear-gradient(90deg,${g.color},${fc})"></div></div></div>`;
  }).join('');
  document.getElementById('d-bar').innerHTML = goals.map((g,i)=>{
    const h = Math.round((s.pcts[i]/100)*110);
    return `<div class="bar-col">
      <div class="bar-pct-lbl">${s.pcts[i]}%</div>
      <div class="bar-fill" style="height:${h}px;background:linear-gradient(180deg,${g.color},${g.color}88)"></div>
      <div class="bar-lbl">${g.emoji}</div></div>`;
  }).join('');
  const dailyWrap = document.getElementById('d-daily-pct');
  if (dailyWrap) {
    dailyWrap.innerHTML = s.dailyPcts.map((p,i)=>{
      const day = i+1;
      const h = Math.max(3, Math.round((p/100)*80));
      return `<div class="daily-pct-col" title="วันที่ ${day}: ${p}%">
        <div class="daily-pct-fill" style="height:${h}px;background:${pctColor(p)}"></div>
        <div class="daily-pct-day">${day}</div></div>`;
    }).join('');
  }
  const circ = 2*Math.PI*50;
  document.getElementById('d-donut').style.strokeDashoffset = circ - (s.overall/100)*circ;
  document.getElementById('d-dpct').textContent = s.overall + '%';
}

function setType(t) {
  finType = t;
  document.getElementById('btn-in').className = 'type-btn' + (t==='income'?' sel-in':'');
  document.getElementById('btn-out').className = 'type-btn' + (t==='expense'?' sel-out':'');
}
function setFinFilter(f, btn) {
  finFilter = f;
  document.querySelectorAll('.fmf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFinance();
}
async function addTx() {
  const name = document.getElementById('f-name').value.trim();
  const amt = parseFloat(document.getElementById('f-amt').value) || 0;
  const date = document.getElementById('f-date').value;
  const cat = document.getElementById('f-cat').value;
  const note = document.getElementById('f-note').value.trim();
  if (!name) { toast('⚠️ กรุณากรอกชื่อรายการ', '#ffb547'); return; }
  if (!amt) { toast('⚠️ กรุณากรอกจำนวนเงิน', '#ffb547'); return; }
  const tx = { id:Date.now(), type:finType, name, amt, date:date||new Date().toISOString().slice(0,10), cat, note };
  appData.txs.push(tx);
  renderFinance();
  document.getElementById('f-name').value = '';
  document.getElementById('f-amt').value = '';
  document.getElementById('f-note').value = '';
  try {
    await api('sdt_add_tx', { p_uid:currentUser.uid, p_tx:tx });
    toast('✅ เพิ่มและซิงค์แล้ว!');
  } catch(e) {
    toast('⚠️ บันทึก local แต่ซิงค์ไม่สำเร็จ', '#ffb547');
  }
}
async function deleteTx(id) {
  appData.txs = appData.txs.filter(t => t.id !== id);
  renderFinance();
  try {
    await api('sdt_delete_tx', { p_uid:currentUser.uid, p_id:id });
    toast('🗑️ ลบและซิงค์แล้ว');
  } catch(e) {
    toast('⚠️ ลบ local แต่ซิงค์ไม่สำเร็จ', '#ffb547');
  }
}
function fmtBaht(n) { return Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtBahtShort(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000) return (n/1000).toFixed(1)+'K';
  return Number(n).toFixed(0);
}
function buildMonthFilterButtons() {
  const months = new Set();
  appData.txs.forEach(t => { if(t.date) months.add(t.date.slice(0,7)); });
  const sorted = [...months].sort().reverse();
  const bar = document.getElementById('fin-month-filter');
  bar.innerHTML = `<button class="fmf-btn${finFilter==='all'?' active':''}" onclick="setFinFilter('all',this)">ทั้งหมด</button>`;
  sorted.slice(0,6).forEach(m => {
    const [y,mo] = m.split('-');
    bar.innerHTML += `<button class="fmf-btn${finFilter===m?' active':''}" onclick="setFinFilter('${m}',this)">${mo}/${y.slice(2)}</button>`;
  });
}
function getFilteredTxs() {
  const search = (document.getElementById('fin-search')?.value||'').toLowerCase();
  let txs = [...appData.txs];
  if (finFilter !== 'all') txs = txs.filter(t => t.date && t.date.startsWith(finFilter));
  if (search) txs = txs.filter(t => t.name.toLowerCase().includes(search) || t.cat.toLowerCase().includes(search));
  return txs.sort((a,b) => b.id - a.id);
}

function renderFinance() {
  if (!document.getElementById('f-date').value)
    document.getElementById('f-date').value = new Date().toISOString().slice(0,10);
  buildMonthFilterButtons();
  const txs = getFilteredTxs();
  const all = appData.txs;
  const income = all.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amt),0);
  const expense = all.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amt),0);
  const balance = income - expense;
  document.getElementById('fh-balance').textContent = fmtBaht(balance);
  document.getElementById('fh-balance').style.color = balance >= 0 ? '#4dffb0' : '#ff8fa3';
  document.getElementById('fh-income').textContent = fmtBaht(income);
  document.getElementById('fh-expense').textContent = fmtBaht(expense);
  document.getElementById('fh-tx-count').textContent = all.length;
  document.getElementById('fh-income-count').textContent = all.filter(t=>t.type==='income').length + ' รายการ';
  document.getElementById('fh-expense-count').textContent = all.filter(t=>t.type==='expense').length + ' รายการ';
  document.getElementById('fin-list-count').textContent = txs.length + ' รายการ';
  const list = document.getElementById('fin-list');
  list.innerHTML = !txs.length
    ? `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">ไม่พบรายการ</div></div>`
    : txs.map(t=>`
      <div class="fin-item">
        <div class="fi-icon fi-icon-${t.type==='income'?'in':'out'}">${t.type==='income'?'💚':'❤️'}</div>
        <div class="fi-info">
          <div class="fi-name">${t.name}</div>
          <div class="fi-sub"><span>${t.date}</span><span class="fi-cat-badge">${t.cat}</span>${t.note?`<span style="font-style:italic;color:var(--muted2)">${t.note}</span>`:''}</div>
        </div>
        <div class="fi-amt fi-amt-${t.type==='income'?'in':'out'}">${t.type==='income'?'+':'-'}${fmtBaht(t.amt)} ฿</div>
        <button class="fi-del" onclick="deleteTx(${t.id})">✕</button>
      </div>`).join('');
  const chartTxs = finFilter === 'all' ? all : txs;
  const cInc = chartTxs.filter(t=>t.type==='income');
  const cExp = chartTxs.filter(t=>t.type==='expense');
  const cIncT = cInc.reduce((s,t)=>s+Number(t.amt),0);
  const cExpT = cExp.reduce((s,t)=>s+Number(t.amt),0);
  document.getElementById('pie-exp-center').textContent = fmtBaht(cExpT);
  document.getElementById('pie-inc-center').textContent = fmtBaht(cIncT);
  renderPie(cExp,'pie-expense','pie-exp-legend');
  renderPie(cInc,'pie-income','pie-inc-legend');
  renderTopExpBar(cExp, cExpT);
  renderSavingsRing(cIncT, cExpT);
  renderBarChart(all);
}
function renderPie(txs, svgId, legendId) {
  const svg = document.getElementById(svgId);
  const legend = document.getElementById(legendId);
  const total = txs.reduce((s,t)=>s+Number(t.amt),0);
  if (!txs.length||total===0) {
    svg.innerHTML=`<circle cx="70" cy="70" r="55" fill="none" stroke="var(--border)" stroke-width="18"/>`;
    legend.innerHTML=`<div style="color:var(--muted);font-size:12px">ไม่มีข้อมูล</div>`;
    return;
  }
  const cats = {};
  txs.forEach(t=>{ cats[t.cat]=(cats[t.cat]||0)+Number(t.amt); });
  const entries = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const cx=70,cy=70,r=55,hole=34;
  let startAngle = -Math.PI/2, paths='';
  entries.forEach(([cat,val],i)=>{
    const slice = (val/total)*2*Math.PI;
    const end = startAngle + slice;
    const la = slice > Math.PI ? 1 : 0;
    const x1o=cx+r*Math.cos(startAngle),y1o=cy+r*Math.sin(startAngle);
    const x2o=cx+r*Math.cos(end),y2o=cy+r*Math.sin(end);
    const x1i=cx+hole*Math.cos(end),y1i=cy+hole*Math.sin(end);
    const x2i=cx+hole*Math.cos(startAngle),y2i=cy+hole*Math.sin(startAngle);
    paths+=`<path d="M${x1o},${y1o} A${r},${r} 0 ${la},1 ${x2o},${y2o} L${x1i},${y1i} A${hole},${hole} 0 ${la},0 ${x2i},${y2i} Z" fill="${CAT_COLORS[i%CAT_COLORS.length]}" stroke="var(--surface)" stroke-width="2.5" opacity=".93"/>`;
    startAngle = end;
  });
  svg.innerHTML = paths;
  legend.innerHTML = entries.slice(0,5).map(([cat,val],i)=>`
    <div class="pie-legend-item">
      <div class="pie-dot" style="background:${CAT_COLORS[i%CAT_COLORS.length]}"></div>
      <span style="color:var(--text2)">${cat}</span>
      <span class="pie-legend-val">${fmtBahtShort(val)} ฿</span>
    </div>`).join('');
}
function renderTopExpBar(txs, total) {
  const wrap = document.getElementById('fin-top-exp');
  if (!txs.length||total===0) { wrap.innerHTML=`<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">ไม่มีรายจ่าย</div></div>`; return; }
  const cats = {};
  txs.forEach(t=>{ cats[t.cat]=(cats[t.cat]||0)+Number(t.amt); });
  const entries = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max = entries[0][1];
  wrap.innerHTML = entries.map(([cat,val],i)=>`
    <div class="fin-bar-item">
      <div class="fin-bar-lbl" title="${cat}">${cat}</div>
      <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${(val/max*100)}%;background:${CAT_COLORS[i%CAT_COLORS.length]}"></div></div>
      <div class="fin-bar-val" style="color:${CAT_COLORS[i%CAT_COLORS.length]}">${fmtBahtShort(val)} ฿</div>
    </div>`).join('');
}
function renderSavingsRing(inc, exp) {
  const ring = document.getElementById('sr-ring-fill');
  const pctEl = document.getElementById('sr-pct');
  const tips = document.getElementById('sr-tips');
  const circ = 2*Math.PI*50;
  if (inc <= 0) { ring.style.strokeDashoffset=circ; pctEl.textContent='0%'; tips.textContent='ยังไม่มีข้อมูลรายรับ'; return; }
  const saved = Math.max(0, inc-exp);
  const rate = Math.min(100, Math.round(saved/inc*100));
  ring.style.strokeDashoffset = circ - (rate/100)*circ;
  pctEl.textContent = rate + '%';
  if (rate >= 50) tips.innerHTML = `<span style="color:var(--green);font-weight:600">ยอดเยี่ยม!</span><br>ออมได้ ${rate}% ของรายรับ`;
  else if (rate >= 20) tips.innerHTML = `<span style="color:var(--orange);font-weight:600">ดีมาก</span><br>ออม ${fmtBaht(saved)} บาท`;
  else tips.innerHTML = `<span style="color:var(--red);font-weight:600">ควรออมมากขึ้น</span><br>เป้าหมาย: ออม 20%+`;
}

function renderBarChart(txs) {
  const svg = document.getElementById('fin-bar-chart');
  if (!svg) return;
  const W = svg.getBoundingClientRect().width || svg.parentElement?.getBoundingClientRect().width || 700;
  const H = 260;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  const months = {};
  txs.forEach(t => {
    if (!t.date) return;
    const m = t.date.slice(0,7);
    if (!months[m]) months[m] = {income:0,expense:0};
    months[m][t.type] += Number(t.amt);
  });
  const keys = Object.keys(months).sort();
  if (!keys.length) { svg.innerHTML=`<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="var(--muted)" font-size="13" font-family="Sarabun,sans-serif">ยังไม่มีข้อมูล</text>`; return; }
  const pad = {t:24,r:24,b:44,l:70};
  const cw = W-pad.l-pad.r, ch = H-pad.t-pad.b;
  const n = keys.length;
  const incVals=keys.map(k=>months[k].income);
  const expVals=keys.map(k=>months[k].expense);
  const balVals=keys.map(k=>months[k].income-months[k].expense);
  const allVals = [...incVals,...expVals,...balVals];
  const maxV = Math.max(...allVals,1);
  const minV = Math.min(...allVals,0);
  const range = maxV-minV||1;
  function py(v){return pad.t+ch*(1-(v-minV)/range)}
  function barH(v){return py(minV)-py(v)}
  let html = '';

  for (let i=0;i<=5;i++) {
    const v = minV+(range*i/5), y = py(v);
    html+=`<line x1="${pad.l}" y1="${y}" x2="${W-pad.r}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="5,4"/>`;
    html+=`<text x="${pad.l-8}" y="${y+4}" text-anchor="end" font-size="12" font-weight="500" fill="var(--muted)" font-family="Prompt,sans-serif">${fmtBahtShort(v)}</text>`;
  }
  if (minV < 0) {
    const zy = py(0);
    html+=`<line x1="${pad.l}" y1="${zy}" x2="${W-pad.r}" y2="${zy}" stroke="var(--muted2)" stroke-width="1.5"/>`;
  }

  const groupW = cw/n;
  const barW = Math.min(26, groupW*0.22);
  const gap = 4;
  const colors = ['#10d97c','#ff5a72','#2d7ef5'];
  const labels = ['รายรับ','รายจ่าย','คงเหลือ'];
  keys.forEach((k,i)=>{
    const gx = pad.l + i*groupW + groupW/2;
    const vals = [incVals[i],expVals[i],balVals[i]];
    const totalW = barW*3 + gap*2;
    const startX = gx - totalW/2;
    vals.forEach((v,j)=>{
      const x = startX + j*(barW+gap);
      const y = v>=0 ? py(v) : py(0);
      const h = Math.max(2, Math.abs(barH(v)));
      html+=`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${colors[j]}" opacity=".9">
        <title>${labels[j]} ${k}: ${fmtBaht(v)} ฿</title></rect>`;
    });
    const [yr,mo]=k.split('-');
    html+=`<text x="${gx}" y="${H-10}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--text2)" font-family="Prompt,sans-serif">${mo}/${yr.slice(2)}</text>`;
  });

  svg.innerHTML = html;
}

window.onload = () => {
  applyTheme();
  initSplash();
  const saved = localStorage.getItem('sdtUser') || sessionStorage.getItem('sdtUser');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showApp();
      loadUserData();
    } catch(e) {
      localStorage.removeItem('sdtUser');
      sessionStorage.removeItem('sdtUser');
    }
  }
};

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const finPage = document.getElementById('page-finance');
    if (finPage && finPage.classList.contains('active')) {
      renderBarChart(appData.txs);
    }
  }, 200);
});

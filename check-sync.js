/* Shared by the dog and cat pages. Local mode makes no Firebase requests. */
(() => {
  'use strict';
  const pet = document.body.dataset.pet;
  const localKey = `pet-meal-check-${pet}-v1`;
  const sharedKey = `pet-meal-sharing-${pet}-v1`;
  const authKey = 'pet-meal-anonymous-v1';
  const apiKey = 'AIzaSyCN-5oQo9Aj3bWVawIZyx-r8rYF3zimLhk';
  const database = 'https://pet-meal-check-default-rtdb.asia-southeast1.firebasedatabase.app';
  const ids = Array.from({length: 14}, (_, i) => `${Math.floor(i / 2)}-${i % 2}`);
  const sheet = document.getElementById('sheet');
  const status = document.getElementById('sync-status');
  const controls = document.getElementById('sharing');
  const buttons = {};
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (_) { return fallback; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const empty = () => Object.fromEntries(ids.map(id => [id, {value: false, rev: 0, op: 'initial'}]));
  let local = read(localKey, {});
  let shared = read(sharedKey, null);
  if (!shared || !/^[a-f0-9]{64}$/.test(shared.room) || !Array.isArray(shared.queue)) shared = null;
  let auth = read(authKey, null), authWork, busy = false, changing = false;
  let message = '';
  const persist = () => { if (shared) save(sharedKey, shared); };
  const project = (cells, queue) => {
    const next = structuredClone(cells || empty());
    for (const op of queue) {
      const old = next[op.cell] || empty()[op.cell];
      if (old.op === op.id) continue;
      if (old.rev === op.baseRev && old.op === op.baseOp) {
        next[op.cell] = {value: op.value, rev: old.rev + 1, op: op.id};
      }
    }
    return next;
  };
  const current = () => shared ? project(shared.cells, shared.queue) : null;
  function render() {
    const cells = current();
    for (const id of ids) {
      const on = shared ? !!cells[id]?.value : !!local[id];
      buttons[id].classList.toggle('on', on);
      buttons[id].setAttribute('aria-pressed', String(on));
      buttons[id].disabled = changing;
    }
    document.getElementById('reset').disabled = changing;
    document.getElementById('start-sharing').hidden = !!shared;
    document.getElementById('invite').hidden = !shared;
    document.getElementById('stop-sharing').hidden = !shared;
    for (const button of controls.querySelectorAll('button')) button.disabled = changing;
    status.textContent = changing ? '接続しています…' : message || (shared
      ? (shared.queue.length ? '端末に保存済み・共有待ち' : '家族と共有中') : 'この端末だけに保存');
  }
  function change(values) {
    try {
      if (shared) {
        const latest = read(sharedKey, null);
        if (latest?.room === shared.room) shared = latest;
        const cells = current();
        const ops = Object.entries(values).map(([cell, value]) => ({
          cell, value, id: random(), baseRev: cells[cell].rev, baseOp: cells[cell].op
        }));
        const next = {...shared, queue: [...shared.queue, ...ops]};
        save(sharedKey, next); // Persist before showing a successful tap.
        shared = next;
      } else {
        const next = {...local, ...values};
        save(localKey, next);
        local = next;
      }
      message = '';
      render();
      void sync();
    } catch (_) { alert('保存できませんでした。端末の空き容量やブラウザの設定を確認してね。'); }
  }
  ids.forEach((id, index) => {
    const b = document.createElement('button');
    b.className = `tap ${index % 2 ? 'n' : 'm'} r${Math.floor(index / 2)}`;
    b.setAttribute('aria-label', `${'月火水木金土日'[Math.floor(index / 2)]}曜日の${index % 2 ? '夜' : '朝'}`);
    b.onclick = () => change({[id]: shared ? !current()[id].value : !local[id]});
    buttons[id] = b;
    sheet.appendChild(b);
  });
  document.getElementById('reset').onclick = () => {
    if (confirm(shared ? '家族と共有しているチェックを全部消しますか？' : '今週のチェックを全部消しますか？')) {
      change(Object.fromEntries(ids.map(id => [id, false])));
    }
  };
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try { return await fetch(url, {...options, signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer'}); }
    finally { clearTimeout(timer); }
  }
  async function identity() {
    if (auth && auth.expires > Date.now() + 60000) return auth;
    if (authWork) return authWork;
    authWork = (async () => {
      const refreshing = !!auth?.refresh;
      const url = refreshing ? `https://securetoken.googleapis.com/v1/token?key=${apiKey}`
        : `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
      const response = await request(url, {
        method: 'POST', headers: {'Content-Type': refreshing ? 'application/x-www-form-urlencoded' : 'application/json'},
        body: refreshing ? new URLSearchParams({grant_type: 'refresh_token', refresh_token: auth.refresh}).toString()
          : JSON.stringify({returnSecureToken: true})
      });
      if (!response.ok) throw new Error('auth');
      const data = await response.json();
      const next = {uid: data.localId || data.user_id, token: data.idToken || data.id_token,
        refresh: data.refreshToken || data.refresh_token, expires: Date.now() + Number(data.expiresIn || data.expires_in) * 1000};
      save(authKey, next);
      auth = next;
      return auth;
    })();
    try { return await authWork; } finally { authWork = null; }
  }
  async function db(path, options = {}) {
    const user = await identity();
    const response = await request(`${database}/${path}.json?auth=${encodeURIComponent(user.token)}`, options);
    if (response.status === 401) auth.expires = 0;
    return response;
  }
  async function put(path, value) {
    const response = await db(path, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)});
    if (!response.ok) throw new Error('permission');
  }
  async function sync() {
    if (!shared || busy || changing || !navigator.onLine || document.hidden) return;
    busy = true;
    const session = shared;
    const pending = [...session.queue];
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await db(`rooms/${session.room}/cells`, {headers: {'X-Firebase-ETag': 'true'}});
        if (!response.ok) throw new Error('permission');
        const remote = await response.json() || empty();
        const next = project(remote, pending);
        if (pending.length && JSON.stringify(remote) !== JSON.stringify(next)) {
          const etag = response.headers.get('ETag');
          if (!etag) throw new Error('etag');
          const result = await db(`rooms/${session.room}/cells`, {
            method: 'PUT', headers: {'Content-Type': 'application/json', 'if-match': etag}, body: JSON.stringify(next)
          });
          if (result.status === 412) continue;
          if (!result.ok) throw new Error('permission');
        }
        if (shared !== session) return;
        let conflict = false;
        for (const op of pending) {
          const old = remote[op.cell];
          // Intermediate operations in the same local queue are superseded by their successors.
          if (old && old.op !== op.id && old.rev > op.baseRev && !pending.some(p => p.id === old.op)) conflict = true;
        }
        const sent = new Set(pending.map(op => op.id));
        const updated = {...session, cells: next, queue: session.queue.filter(op => !sent.has(op.id))};
        save(sharedKey, updated);
        shared = updated;
        message = conflict ? '同じマスの変更が重なったため、先に共有された記録を残しました' : '';
        render();
        return;
      }
      throw new Error('retry');
    } catch (_) {
      if (shared === session) {
        message = session.queue.length ? '端末に保存済み・接続できたら共有します' : '共有に接続できません。端末の記録を表示中';
        render();
      }
    } finally { busy = false; }
  }
  async function connect(action) {
    if (busy || changing) return;
    if (!navigator.onLine) { alert('共有を始めるときはインターネット接続が必要だよ。'); return; }
    changing = true; render();
    try { await action(); message = ''; }
    catch (_) { alert('共有に接続できませんでした。通信状態とFirebaseのルールを確認してね。'); }
    finally { changing = false; render(); void sync(); }
  }
  document.getElementById('start-sharing').onclick = () => {
    if (!confirm('今のチェックを家族と共有しますか？ 招待リンクを渡した人が確認・変更できるようになります。')) return;
    void connect(async () => {
      const user = await identity(), room = random(), token = random();
      const cells = Object.fromEntries(ids.map(id => [id, {value: !!local[id], rev: 0, op: 'initial'}]));
      await put(`rooms/${room}`, {owner: user.uid, pet, members: {[user.uid]: {invite: 'owner'}}, cells});
      await put(`invites/${token}`, room);
      const next = {room, token, cells, queue: []};
      save(sharedKey, next); shared = next;
    });
  };
  const canonicalPath = path => path.replace(/index\.html$/, '');
  const inviteURL = () => `${location.origin}${canonicalPath(location.pathname)}#invite=${shared.token}`;
  document.getElementById('invite').onclick = async () => {
    const url = inviteURL();
    try {
      if (navigator.share) await navigator.share({title: `ごはんあげた？ ${pet === 'cat' ? '猫' : '犬'}の共有`, url});
      else { await navigator.clipboard.writeText(url); alert('招待リンクをコピーしたよ。家族に送ってね。'); }
    } catch (error) { if (error.name !== 'AbortError') prompt('この招待リンクをコピーしてね', url); }
  };
  document.getElementById('stop-sharing').onclick = () => {
    if (busy) { alert('共有処理が終わってから、もう一度押してね。'); return; }
    if (shared.queue.length) { alert('まだ共有していない操作があります。接続して共有が終わってから切り替えてね。'); return; }
    if (!confirm('この端末の共有をやめて、今のチェックを端末だけに保存しますか？ 家族側の共有は続きます。')) return;
    try {
      const next = Object.fromEntries(ids.map(id => [id, !!current()[id].value]));
      save(localKey, next); localStorage.removeItem(sharedKey);
      local = next; shared = null; message = ''; render();
    } catch (_) { alert('端末に保存できませんでした。'); }
  };
  async function acceptInvite(token) {
    if (shared?.token === token) return;
    if (shared?.queue.length) { alert('先に、今の共有待ちの操作を送信してね。'); return; }
    if (!confirm(`${pet === 'cat' ? '猫' : '犬'}の共有表に参加しますか？ この端末のチェックとは別の表を表示します。`)) return;
    await connect(async () => {
      const user = await identity();
      const response = await db(`invites/${token}`);
      const room = response.ok ? await response.json() : null;
      if (typeof room !== 'string' || !/^[a-f0-9]{64}$/.test(room)) throw new Error('invite');
      const membership = await db(`rooms/${room}/members/${user.uid}`);
      if (!membership.ok) throw new Error('membership');
      if (!await membership.json()) await put(`rooms/${room}/members/${user.uid}`, {invite: token});
      const dataResponse = await db(`rooms/${room}`);
      if (!dataResponse.ok) throw new Error('room');
      const data = await dataResponse.json();
      if (data.pet !== pet) throw new Error('pet');
      const next = {room, token, cells: data.cells, queue: []};
      save(sharedKey, next); shared = next;
    });
  }
  document.getElementById('join-sharing').onclick = () => {
    const input = prompt('家族から届いた招待リンクを貼ってね');
    if (!input) return;
    try {
      const url = new URL(input);
      const token = new URLSearchParams(url.hash.slice(1)).get('invite');
      if (url.origin !== location.origin || canonicalPath(url.pathname) !== canonicalPath(location.pathname) || !/^[a-f0-9]{64}$/.test(token)) throw new Error();
      void acceptInvite(token);
    } catch (_) { alert('この表の招待リンクを入れてね。犬と猫は別々だよ。'); }
  };
  window.addEventListener('storage', event => {
    if (event.key === sharedKey || event.key === localKey) {
      // Another open copy of this sheet may have just queued a tap.
      shared = read(sharedKey, null);
      local = read(localKey, {});
      render();
      void sync();
    }
  });
  render();
  window.addEventListener('online', () => void sync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
  // Poll only while the shared sheet is open. No Firebase connection in local mode.
  setInterval(() => void sync(), 5000);
  if (window.petMealInvite) void acceptInvite(window.petMealInvite);
  else void sync();
  // Let installed copies switch to the completely precached release on request.
  if ('serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) location.reload();
    });
    window.addEventListener('load', async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;
      const showUpdate = () => {
        if (!registration.waiting || document.getElementById('app-update')) return;
        const button = document.createElement('button');
        button.id = 'app-update'; button.textContent = '新しい版に更新';
        button.onclick = () => {
          if (!registration.waiting) return;
          reloading = true;
          registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
        };
        controls.appendChild(button);
      };
      showUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed') showUpdate(); });
      });
    });
  }
})();

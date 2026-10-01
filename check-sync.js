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
  const installed = navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  // iOS copies cookies once when a NEW Home Screen app is added.
  // Transfer only an invitation, never credentials or offline operations.
  const installCookie = `pet-meal-install-${pet}`;
  const cookiePath = location.pathname.replace(/index\.html$/, '');
  const cookieToken = () => document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${installCookie}=`))?.slice(installCookie.length + 1);
  const clearInstallCookie = () => { document.cookie = `${installCookie}=; Path=${cookiePath}; Max-Age=0; SameSite=Strict; Secure`; };
  let installToken = installed && /^[a-f0-9]{64}$/.test(cookieToken()) ? cookieToken() : null;
  if (installed && shared) { clearInstallCookie(); installToken = null; }
  const helpStyle = document.createElement('style');
  helpStyle.textContent = '.share-guide{box-sizing:border-box;width:calc(100% - 32px);max-width:440px;max-height:90dvh;overflow:auto;border:1px solid #b9aa98;border-radius:18px;padding:24px;background:#fffaf2;color:#342e29;font:17px/1.7 -apple-system,BlinkMacSystemFont,sans-serif;touch-action:manipulation}.share-guide::backdrop{background:#0008}.share-guide h2{font-size:22px;line-height:1.4;margin:0 0 16px}.share-guide p{margin:12px 0}.share-guide ol{padding-left:26px}.share-guide li{margin:14px 0}.share-guide button{display:block;width:100%;min-height:48px;padding:12px;margin:12px 0 0;font:inherit;font-weight:600;border:1px solid #b9aa98;border-radius:10px;background:#f7efe2;color:#342e29;touch-action:manipulation}.share-guide .primary{background:#584936;color:white}.share-guide textarea{box-sizing:border-box;width:100%;min-height:100px;margin-top:8px;border:1px solid #b9aa98;border-radius:8px;padding:12px;font:16px/1.5 sans-serif}.share-guide .guide-note{font-size:14px}.share-guide [hidden]{display:none}';
  document.head.appendChild(helpStyle);
  function guide(html) {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'share-guide';
    dialog.innerHTML = html;
    dialog.setAttribute('aria-labelledby', 'guide-title');
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => { dialog.remove(); previous?.focus(); });
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
    dialog.showModal();
    return dialog;
  }
  function homeGuide(token) {
    const url = `${location.origin}${canonicalPath(location.pathname)}#invite=${token}`;
    const dialog = guide('<h2 id="guide-title">ホーム画面のアプリで使う</h2><p>この画面で参加しても、ホーム画面のアプリが共有になっているかは、アプリを開いて確認してね。</p><ol><li><strong>下のボタンで招待リンクをコピー</strong><button class="primary" data-copy>招待リンクをコピー</button><p role="status" data-copy-status></p><textarea aria-label="コピーする招待リンク" data-link hidden readonly></textarea></li><li><strong>ホーム画面に戻って、犬／猫のアプリを開く</strong></li><li><strong>表の下の「招待リンクで参加」を押す</strong><br>リンクを貼り付けて「この共有表に参加する」を押してね。</li></ol><p class="guide-note">初回の設定だよ。参加後は、いつものアイコンから使えるよ。</p><button data-close>閉じる</button>');
    const field = dialog.querySelector('[data-link]');
    field.value = url;
    dialog.querySelector('[data-copy]').onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        dialog.querySelector('[data-copy-status]').textContent = 'コピーしたよ。次はホーム画面に戻って、アプリを開こう。';
      } catch (_) {
        field.hidden = false; field.focus(); field.select();
        dialog.querySelector('[data-copy-status]').textContent = 'コピーできなかったので、下のリンクを長押ししてコピーしてね。';
      }
    };
  }
  async function installGuide(token) {
    await acceptInvite(token);
    if (shared?.token !== token) return;
    document.cookie = `${installCookie}=${token}; Path=${cookiePath}; Max-Age=86400; SameSite=Strict; Secure`;
    if (cookieToken() !== token) {
      alert('引き継ぎの準備ができませんでした。ホーム画面のアプリで招待リンクを貼り付けてね。');
      homeGuide(token); return;
    }
    const dialog = guide('<h2 id="guide-title">共有したままホーム画面に追加</h2><p>この共有表を、新しく追加するアプリへ引き継ぐ準備ができたよ。</p><ol><li><strong>この画面の共有ボタン（四角から上向き矢印）を押す</strong><br>見つからないときは、ブラウザのメニューを開いてね。</li><li><strong>「ホーム画面に追加」を選ぶ</strong><br>「Webアプリとして開く」が出たらオンのまま追加してね。</li><li><strong>追加したアイコンから開く</strong><br>ネットにつながった状態で「家族と共有中」と表示されるか確認してね。</li></ol><p class="guide-note">今日中に追加してね。すでにあるアイコンは自動では切り替わりません。引き継がれなければ招待リンクを一度貼り付けて参加できます。</p><button data-manual>追加済みのアプリで使う手順</button><button data-close>閉じる</button>');
    dialog.querySelector('[data-manual]').onclick = () => { dialog.close(); homeGuide(token); };
  }
  const homeButton = document.createElement('button');
  homeButton.textContent = 'ホーム画面のアプリで使う';
  homeButton.onclick = () => {
    const token = shared.token;
    const dialog = guide('<h2 id="guide-title">ホーム画面のアプリで使う</h2><button class="primary" data-install>これからホーム画面に追加する</button><button data-existing>すでにアイコンを追加している</button><button data-close>閉じる</button>');
    dialog.querySelector('[data-install]').onclick = () => { dialog.close(); void installGuide(token); };
    dialog.querySelector('[data-existing]').onclick = () => { dialog.close(); homeGuide(token); };
  };
  controls.appendChild(homeButton);
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
    homeButton.hidden = installed || !shared;
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
      clearInstallCookie(); installToken = null;
      local = next; shared = null; message = ''; render();
    } catch (_) { alert('端末に保存できませんでした。'); }
  };
  async function acceptInvite(token, ask = true) {
    if (shared?.token === token) return;
    if (shared?.queue.length) { alert('先に、今の共有待ちの操作を送信してね。'); return; }
    if (ask && !confirm(`${pet === 'cat' ? '猫' : '犬'}の共有表に参加しますか？ この端末のチェックとは別の表を表示します。`)) return;
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
      clearInstallCookie(); installToken = null;
    });
  }
  document.getElementById('join-sharing').onclick = () => {
    const dialog = guide('<h2 id="guide-title">招待リンクで参加</h2><p>家族から届いたリンクをコピーして、この欄に貼り付けてね。</p><label for="join-link">招待リンク</label><textarea id="join-link" placeholder="ここを長押しして「ペースト」" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea><button data-paste>コピーしたリンクを貼り付ける</button><p role="status" data-join-status></p><button class="primary" data-join>この共有表に参加する</button><p class="guide-note">参加すると、家族と同じ表が表示されます。犬と猫の招待リンクは別々だよ。</p><button data-close>キャンセル</button>');
    const field = dialog.querySelector('textarea');
    const note = dialog.querySelector('[data-join-status]');
    dialog.querySelector('[data-paste]').onclick = async () => {
      try { field.value = await navigator.clipboard.readText(); note.textContent = '貼り付けたよ。「この共有表に参加する」を押してね。'; }
      catch (_) { field.focus(); note.textContent = '入力欄を長押しして「ペースト」を選んでね。'; }
    };
    dialog.querySelector('[data-join]').onclick = () => {
      try {
        const url = new URL(field.value.trim());
        const token = new URLSearchParams(url.hash.slice(1)).get('invite');
        if (url.origin !== location.origin || canonicalPath(url.pathname) !== canonicalPath(location.pathname) || !/^[a-f0-9]{64}$/.test(token)) throw new Error();
        dialog.close(); void acceptInvite(token);
      } catch (_) { note.textContent = 'この表の招待リンクを貼ってね。犬と猫は別々だよ。'; field.focus(); }
    };
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
  const resumeInstall = () => {
    if (installToken && !shared && navigator.onLine && !changing) void acceptInvite(installToken, false);
    else void sync();
  };
  window.addEventListener('online', resumeInstall);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeInstall(); });
  // Poll only while the shared sheet is open. No Firebase connection in local mode.
  setInterval(() => void sync(), 5000);
  if (window.petMealInvite && !installed) {
    const token = window.petMealInvite;
    const dialog = guide('<h2 id="guide-title">家族の共有表への招待</h2><p>どこで使うか選んでね。</p><button class="primary" data-install>参加してホーム画面に追加する</button><p class="guide-note">初めて使う方はこちら。参加してから追加します。</p><button data-home>追加済みのホーム画面のアプリで使う</button><p class="guide-note">すでに犬／猫のアイコンを追加している方はこちら。</p><button data-browser>この画面で使う</button><p class="guide-note">追加せず、この画面で使うこともできます。</p><button data-close>あとで参加する</button>');
    dialog.querySelector('[data-install]').onclick = () => { dialog.close(); void installGuide(token); };
    dialog.querySelector('[data-home]').onclick = () => { dialog.close(); homeGuide(token); };
    dialog.querySelector('[data-browser]').onclick = () => { dialog.close(); void acceptInvite(token); };
  }
  else if (window.petMealInvite) void acceptInvite(window.petMealInvite);
  else if (installToken && !shared) {
    if (!navigator.onLine) { message = '共有の引き継ぎ待ち・ネットにつながると参加します'; render(); }
    resumeInstall();
  }
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

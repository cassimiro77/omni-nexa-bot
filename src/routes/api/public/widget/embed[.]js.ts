// Serves the embeddable Nexbot chat widget as JS.
// Usage on any site:
//   <script src="https://omni-nexa-bot.lovable.app/api/public/widget/embed.js" data-source="nexalytix" defer></script>
import { createFileRoute } from "@tanstack/react-router";

const JS = `(function(){
  var CURRENT = document.currentScript;
  if (!CURRENT) { var all = document.getElementsByTagName('script'); CURRENT = all[all.length-1]; }
  var SRC = CURRENT.src;
  var BASE = SRC.replace(/\\/api\\/public\\/widget\\/embed\\.js.*$/, '');
  var SOURCE = CURRENT.getAttribute('data-source') || 'website';
  var TITLE = CURRENT.getAttribute('data-title') || 'Fale com a gente';
  var COLOR = CURRENT.getAttribute('data-color') || '#6d28d9';
  var GREETING = CURRENT.getAttribute('data-greeting') || 'Oi! Como posso ajudar?';

  if (window.__NEXBOT_MOUNTED__) return;
  window.__NEXBOT_MOUNTED__ = true;

  var SKEY = 'nexbot_session_' + SOURCE;
  var sessionId = localStorage.getItem(SKEY);
  if (!sessionId) {
    sessionId = 'w_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(SKEY, sessionId);
  }

  var history = [];

  var css = ''
    + '.nx-btn{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:'+COLOR+';color:#fff;border:none;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;z-index:2147483000;display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform .15s}'
    + '.nx-btn:hover{transform:scale(1.05)}'
    + '.nx-panel{position:fixed;right:20px;bottom:88px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
    + '.nx-panel.open{display:flex}'
    + '.nx-head{background:'+COLOR+';color:#fff;padding:14px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center}'
    + '.nx-close{background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}'
    + '.nx-body{flex:1;overflow-y:auto;padding:14px;background:#f7f7f8;display:flex;flex-direction:column;gap:8px}'
    + '.nx-msg{max-width:80%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}'
    + '.nx-me{align-self:flex-end;background:'+COLOR+';color:#fff;border-bottom-right-radius:4px}'
    + '.nx-bot{align-self:flex-start;background:#fff;color:#111;border:1px solid #e5e7eb;border-bottom-left-radius:4px}'
    + '.nx-typ{align-self:flex-start;color:#666;font-size:12px;font-style:italic}'
    + '.nx-form{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}'
    + '.nx-input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:9px 12px;font-size:14px;outline:none}'
    + '.nx-input:focus{border-color:'+COLOR+'}'
    + '.nx-send{background:'+COLOR+';color:#fff;border:none;border-radius:10px;padding:0 14px;font-size:14px;cursor:pointer}'
    + '.nx-send:disabled{opacity:.5;cursor:not-allowed}';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'nx-btn'; btn.setAttribute('aria-label','Abrir chat'); btn.innerHTML = '\\u{1F4AC}';
  document.body.appendChild(btn);

  var panel = document.createElement('div');
  panel.className = 'nx-panel';
  panel.innerHTML = ''
    + '<div class="nx-head"><span>'+TITLE+'</span><button class="nx-close" aria-label="Fechar">&times;</button></div>'
    + '<div class="nx-body" id="nx-body"></div>'
    + '<form class="nx-form" id="nx-form"><input class="nx-input" id="nx-input" autocomplete="off" placeholder="Digite sua mensagem..." maxlength="2000"/><button class="nx-send" type="submit">Enviar</button></form>';
  document.body.appendChild(panel);

  var body = panel.querySelector('#nx-body');
  var form = panel.querySelector('#nx-form');
  var input = panel.querySelector('#nx-input');
  var sendBtn = form.querySelector('.nx-send');

  function addMsg(text, who){
    var d = document.createElement('div');
    d.className = 'nx-msg ' + (who === 'user' ? 'nx-me' : 'nx-bot');
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }
  function addTyping(){
    var d = document.createElement('div');
    d.className = 'nx-typ'; d.id = 'nx-typing'; d.textContent = 'digitando...';
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }
  function removeTyping(){ var t = body.querySelector('#nx-typing'); if (t) t.remove(); }

  addMsg(GREETING, 'bot');

  btn.addEventListener('click', function(){ panel.classList.toggle('open'); if (panel.classList.contains('open')) input.focus(); });
  panel.querySelector('.nx-close').addEventListener('click', function(){ panel.classList.remove('open'); });

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = ''; sendBtn.disabled = true;
    addMsg(text, 'user');
    history.push({ role: 'user', content: text });
    addTyping();
    try {
      var res = await fetch(BASE + '/api/public/widget/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: SOURCE, sessionId: sessionId, message: text, history: history.slice(-10) }),
      });
      var data = await res.json().catch(function(){ return {}; });
      removeTyping();
      if (!res.ok) {
        addMsg('Ops, tive um problema. Tente novamente em instantes.', 'bot');
      } else {
        var reply = data.reply || '...';
        addMsg(reply, 'bot');
        history.push({ role: 'assistant', content: reply });
      }
    } catch(err) {
      removeTyping();
      addMsg('Sem conexão. Tente novamente.', 'bot');
    } finally {
      sendBtn.disabled = false; input.focus();
    }
  });
})();
`;

export const Route = createFileRoute("/api/public/widget/embed.js")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JS, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        }),
    },
  },
});

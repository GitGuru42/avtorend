// js/chat.js
// Placeholder chat implementation.
// Provides window.initChat() so the widget works (open/close + local echo),
// but does NOT integrate with any backend. Another developer can replace this file later.

(function () {
  'use strict';

  function appendMessage(container, text, who) {
    const msg = document.createElement('div');
    msg.className = `chat-message ${who}`;
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  window.initChat = function initChat() {
    const widget = document.getElementById('chatWidget');
    const toggle = document.getElementById('chatToggle');
    const closeBtn = document.getElementById('chatClose');
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    const messages = document.getElementById('chatMessages');

    if (!widget || !toggle || !closeBtn || !input || !send || !messages) {
      console.warn('⚠️ Chat elements missing, chat disabled');
      return;
    }

    function open() {
      widget.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
      input.focus();
    }

    function close() {
      widget.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', () => {
      widget.classList.contains('active') ? close() : open();
    });

    closeBtn.addEventListener('click', close);

    function submit() {
      const text = (input.value || '').trim();
      if (!text) return;
      appendMessage(messages, text, 'user');
      input.value = '';
      // local placeholder response
      setTimeout(() => appendMessage(messages, (document.documentElement.lang === 'en' ? 'Thanks! Chat functionality will be connected later.' : 'Спасибо! Функционал чата будет подключен позже.'), 'bot'), 250);
    }

    send.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close();
    });

    console.log('💬 Chat placeholder initialized');
  };
})();

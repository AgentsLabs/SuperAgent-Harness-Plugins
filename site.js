'use strict';

const status = document.getElementById('copy-status');

function announce(message) {
  status.textContent = message;
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const field = document.getElementById(button.dataset.copy);
    const label = button.dataset.label || 'Text';
    if (!field) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(field.value);
      button.textContent = 'Copied ✓';
      button.setAttribute('aria-label', `${label} copied. Copy again`);
      announce(`${label} copied. Paste it into DeepSeek Harness or your terminal as instructed.`);
    } catch {
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
      button.textContent = 'Selected — copy manually';
      button.setAttribute('aria-label', `${label} selected. Copy manually with Command+C or Ctrl+C`);
      announce(`Automatic copying is unavailable. ${label} is selected: press Command+C on Mac or Ctrl+C on Windows/Linux, or use your device’s Copy action.`);
    }
  });
}

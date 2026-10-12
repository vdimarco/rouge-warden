// Phone crew picker: the Crew button opens eight choices; each choice sends keys 1-8 through the touch controls.
const toggle = document.getElementById('crew-toggle');
const picker = document.getElementById('crew-picker');

function setOpen(open) {
  picker.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}

toggle.addEventListener('click', () => setOpen(picker.hidden));
// Close after a choice; touch-controls.js has already sent the key on pointerdown.
picker.addEventListener('click', event => { if (event.target.closest('button')) setOpen(false); });
new MutationObserver(() => { if (document.body.dataset.state !== 'playing') setOpen(false); })
  .observe(document.body, { attributes: true, attributeFilter: ['data-state'] });

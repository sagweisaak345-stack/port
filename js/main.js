// Entry point: wire up UI, boot the scene, handle fallback + loader.

import { initUI } from './ui.js';
import { initScene } from './scene.js';
import { webglSupported } from './utils.js';

const loader = document.getElementById('loader');

function hideLoader() {
  if (!loader) return;
  loader.classList.add('is-hidden');
  setTimeout(() => loader.remove(), 700);
}

// Safety net: never leave the loader stuck.
setTimeout(() => { if (loader) hideLoader(); }, 6000);

// UI always initialises, even if WebGL is unavailable.
initUI();

if (!webglSupported()) {
  document.body.classList.add('no-webgl');
  hideLoader();
} else {
  initScene()
    .then(hideLoader)
    .catch((err) => {
      console.error('[three] init failed, falling back:', err);
      document.body.classList.add('no-webgl');
      hideLoader();
    });
}
const supabaseUrl = "https://hnxwbwgpbyssmqkvmeop.supabase.co";
const supabaseKey = "sb_publishable_rRsZg1dSvIB_ZTC1ZIJudA_HXK7SdH3";
const db = supabase.createClient(supabaseUrl, supabaseKey);

const form = document.querySelector("#contact-form"); // use your form's id

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const { error } = await db.from("submissions").insert({
    name: form.name.value,
    email: form.email.value,
    message: form.message.value,
  });

  if (error) {
    alert("Something went wrong. Please try again.");
    console.error(error);
  } else {
    alert("Sent! Thank you.");
    form.reset();
  }
});
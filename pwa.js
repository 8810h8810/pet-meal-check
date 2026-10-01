/* One shared offline worker for the dog and cat pages. */
if ('serviceWorker' in navigator) {
  const scriptURL = new URL(document.currentScript.src);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', scriptURL), {
      scope: new URL('./', scriptURL).pathname
    }).catch(error => console.warn('オフライン準備に失敗しました', error));
  });
}

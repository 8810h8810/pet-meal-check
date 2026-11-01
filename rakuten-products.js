/* QA ONLY: product requests, affiliate links, and product UI are disabled. */
(() => {
  const button=document.getElementById('goods-open');
  if(button){button.disabled=true;button.setAttribute('aria-disabled','true');button.textContent='QA：商品・広告リンクは無効';}
})();

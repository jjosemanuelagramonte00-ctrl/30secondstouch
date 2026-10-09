(function () {
  var esCampo = function (t) { return t && /^(INPUT|TEXTAREA)$/.test(t.tagName); };
  document.addEventListener('contextmenu', function (e) { if (!esCampo(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { if (e.target.tagName === 'IMG') e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if (e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && 'ijc'.indexOf(k) > -1) ||
        (e.ctrlKey && (k === 'u' || k === 's')) ||
        (e.metaKey && e.altKey && 'iju'.indexOf(k) > -1)) e.preventDefault();
  });
  console.log('%c¡ALTO!', 'color:#ff6a1f;font-size:36px;font-weight:bold');
  console.log('%cEste código es propiedad de 30SecondsTouch. Copiarlo o reutilizarlo sin permiso está prohibido.', 'font-size:14px');
})();

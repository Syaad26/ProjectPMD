// small interactive touches for landing (subtle blob motion)
(function () {
  const b1 = document.querySelector(".blob-1");
  const b2 = document.querySelector(".blob-2");
  if (!b1 || !b2) return;

  // parallax on mouse move
  window.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 20; // -10..10
    const y = (e.clientY / window.innerHeight - 0.5) * 12;
    b1.style.transform = `translate(${x * -1}px, ${y * -1}px) scale(1.06)`;
    b2.style.transform = `translate(${x * 0.6}px, ${y * 0.8}px) scale(1.02)`;
  });

  // subtle breathing animation
  let t = 0;
  function anim() {
    t += 0.003;
    const s1 = 1 + Math.sin(t) * 0.01;
    const s2 = 1 + Math.cos(t * 1.2) * 0.01;
    b1.style.filter = `blur(${18 + Math.sin(t * 3) * 0.5}px)`;
    b2.style.filter = `blur(${16 + Math.cos(t * 2.6) * 0.5}px)`;
    b1.style.opacity = 0.92 + Math.sin(t * 0.8) * 0.03;
    b2.style.opacity = 0.92 + Math.cos(t * 0.9) * 0.03;
    requestAnimationFrame(anim);
  }
  requestAnimationFrame(anim);
})();

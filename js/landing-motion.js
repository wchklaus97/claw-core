const root = document.documentElement;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const removeMotionInit = () => {
  root.classList.remove("motion-init");
};

const setupHeroVideoIntro = () => {
  if (reducedMotionQuery.matches) {
    return;
  }

  if (sessionStorage.getItem("heroVideoIntroDone") === "1") {
    return;
  }

  const video = document.getElementById("hero-video");
  const anchor = document.getElementById("hero-video-anchor");
  if (!video || !anchor) {
    return;
  }

  let collapsed = false;
  video.classList.add("video-intro");

  const collapseIntro = () => {
    if (collapsed) {
      return;
    }
    collapsed = true;

    const start = video.getBoundingClientRect();
    const target = anchor.getBoundingClientRect();
    const scaleX = target.width / start.width;
    const scaleY = target.height / start.height;
    const translateX = target.left - start.left;
    const translateY = target.top - start.top;

    video.classList.add("video-intro-collapsing");
    video.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    video.style.borderRadius = "24px";

    window.setTimeout(() => {
      video.classList.remove("video-intro", "video-intro-collapsing");
      video.style.transform = "";
      video.style.borderRadius = "";
      sessionStorage.setItem("heroVideoIntroDone", "1");
      window.removeEventListener("scroll", onScroll, { passive: true });
      window.removeEventListener("wheel", collapseIntro, { passive: true });
      window.removeEventListener("touchstart", collapseIntro, { passive: true });
      window.removeEventListener("keydown", collapseIntro);
    }, 1040);
  };

  const onScroll = () => {
    if (window.scrollY > 36) {
      collapseIntro();
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("wheel", collapseIntro, { passive: true });
  window.addEventListener("touchstart", collapseIntro, { passive: true });
  window.addEventListener("keydown", collapseIntro);
  window.setTimeout(collapseIntro, 2200);
};

const setupMotion = async () => {
  if (reducedMotionQuery.matches) {
    return;
  }

  try {
    const { animate, inView, stagger } = await import("https://esm.sh/motion@11?bundle");
    root.classList.add("motion-init");
    window.setTimeout(removeMotionInit, 2500);

    const sectionSelector = '[data-motion="section"], [data-motion="legal"]';
    const sections = document.querySelectorAll(sectionSelector);

    sections.forEach((section) => {
      inView(
        section,
        () => {
          if (section.dataset.motionPlayed === "true") {
            return;
          }

          section.dataset.motionPlayed = "true";
          animate(
            section,
            { opacity: [0, 1], transform: ["translateY(22px)", "translateY(0px)"] },
            { duration: 0.58, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
          );

          const cards = section.querySelectorAll('[data-motion="card"]');
          if (cards.length > 0) {
            animate(
              cards,
              {
                opacity: [0, 1],
                transform: ["translateY(16px) scale(0.985)", "translateY(0px) scale(1)"],
              },
              {
                duration: 0.48,
                delay: stagger(0.06),
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                fill: "forwards",
              }
            );
          }
        },
        { margin: "-8% 0px -12% 0px" }
      );
    });

    setupHeroVideoIntro();

    const microTargets = document.querySelectorAll('[data-motion="card"], [data-motion="button"]');
    microTargets.forEach((element) => {
      const hoverIn = () => {
        animate(
          element,
          { transform: ["translateY(0px) scale(1)", "translateY(-2px) scale(1.01)"] },
          { duration: 0.2, easing: "ease-out", fill: "forwards" }
        );
      };

      const hoverOut = () => {
        animate(
          element,
          { transform: ["translateY(-2px) scale(1.01)", "translateY(0px) scale(1)"] },
          { duration: 0.2, easing: "ease-out", fill: "forwards" }
        );
      };

      element.addEventListener("pointerenter", hoverIn);
      element.addEventListener("pointerleave", hoverOut);
      element.addEventListener("focus", hoverIn);
      element.addEventListener("blur", hoverOut);
    });
  } catch (_error) {
    removeMotionInit();
  }
};

setupMotion();

const onReducedMotionChange = (event) => {
  if (event.matches) {
    removeMotionInit();
  } else {
    setupMotion();
  }
};

if (typeof reducedMotionQuery.addEventListener === "function") {
  reducedMotionQuery.addEventListener("change", onReducedMotionChange);
} else if (typeof reducedMotionQuery.addListener === "function") {
  reducedMotionQuery.addListener(onReducedMotionChange);
}

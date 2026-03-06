function isShapeAtScreenPoint() { return false; }

const underlineColors = [
  '#F24647', '#46F2B6', '#2F6CE1', '#F2EC46', '#F246D5',
  '#F29C46', '#91F246', '#46E9F2', '#6E46F2'
];
let colorIndex = 0;

function createWigglyPath(segments) {
  segments = segments || 28;
  const step = 100 / segments;
  const amplitude = 3.5;
  const randomness = 0.8;
  let d = `M0,6 Q${step / 2},${6 - amplitude + (Math.random() - 0.5) * randomness} ${step},6`;
  for (let i = 2; i <= segments; i++) {
    const x = i * step;
    const yOffset = (Math.random() - 0.5) * randomness;
    d += ` T${x},${6 + yOffset}`;
  }
  return d;
}

function getSegmentsForLink(link) {
  const width = link.offsetWidth;
  return Math.max(8, Math.round(width / 18));
}

document.querySelectorAll('.project-link').forEach(link => {
  const segments = getSegmentsForLink(link);
  const underline = document.createElement('span');
  underline.className = 'wiggly-underline';
  underline.innerHTML = `<svg viewBox="0 0 100 12" preserveAspectRatio="none"><path d="${createWigglyPath(segments)}" stroke="${underlineColors[colorIndex]}" vector-effect="non-scaling-stroke"/></svg>`;
  link.appendChild(underline);

  link.addEventListener('mouseenter', () => {
    const segs = getSegmentsForLink(link);
    const path = underline.querySelector('path');
    path.setAttribute('d', createWigglyPath(segs));
    path.setAttribute('stroke', underlineColors[colorIndex]);
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    colorIndex = (colorIndex + 1) % underlineColors.length;
  });
});

(function() {
  const track = document.getElementById('jiraCarouselTrack');
  const controls = document.getElementById('jiraCarouselControls');
  if (!track || !controls) return;

  const dots = controls.querySelectorAll('.jira-carousel-dot');
  const slides = track.querySelectorAll('.jira-carousel-slide');
  let currentSlide = 0;
  let autoplayTimer = null;

  var isBouncing = false;

  function bounceEdge(direction) {
    if (isBouncing) return;
    isBouncing = true;
    var offset = direction === 'start' ? 3 : -8;
    var base = currentSlide * 100;
    track.style.transition = 'transform 0.15s ease-out';
    track.style.transform = 'translateX(calc(-' + base + '% + ' + offset + 'px))';
    setTimeout(function() {
      track.style.transition = 'transform 0.25s ease-in';
      track.style.transform = 'translateX(-' + base + '%)';
      setTimeout(function() {
        track.style.transition = 'transform 0.4s ease';
        isBouncing = false;
      }, 250);
    }, 150);
  }

  function goToSlide(idx) {
    if (isBouncing) return;
    if (idx < 0) {
      bounceEdge('start');
      return;
    }
    if (idx >= slides.length) {
      bounceEdge('end');
      return;
    }
    currentSlide = idx;
    track.style.transform = 'translateX(-' + currentSlide * 100 + '%)';
    dots.forEach(function(d, i) {
      d.classList.toggle('active', i === currentSlide);
    });
  }

  dots.forEach(function(dot, i) {
    dot.addEventListener('click', function() {
      goToSlide(i);
      resetAutoplay();
    });
  });

  var isDragging = false;
  var startX = 0;
  var dragOffset = 0;

  function setDragTransform(offset) {
    track.style.transform = 'translateX(calc(-' + currentSlide * 100 + '% + ' + offset + 'px))';
  }

  function snapToNearest() {
    var threshold = 50;
    if (dragOffset < -threshold && currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1);
    } else if (dragOffset > threshold && currentSlide > 0) {
      goToSlide(currentSlide - 1);
    } else {
      if (dragOffset < -10 && currentSlide === slides.length - 1) {
        bounceEdge('end');
      } else if (dragOffset > 10 && currentSlide === 0) {
        bounceEdge('start');
      } else {
        track.style.transform = 'translateX(-' + currentSlide * 100 + '%)';
      }
    }
    resetAutoplay();
  }

  track.addEventListener('mousedown', function(e) {
    if (isBouncing) return;
    startX = e.clientX;
    isDragging = true;
    dragOffset = 0;
    track.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    dragOffset = e.clientX - startX;
    var maxDrag = 30;
    if (currentSlide === 0 && dragOffset > 0) {
      dragOffset = maxDrag * (1 - 1 / (1 + dragOffset / maxDrag));
    }
    if (currentSlide === slides.length - 1 && dragOffset < 0) {
      dragOffset = -maxDrag * (1 - 1 / (1 + Math.abs(dragOffset) / maxDrag));
    }
    setDragTransform(dragOffset);
  });

  document.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    track.style.transition = 'transform 0.4s ease';
    snapToNearest();
  });

  track.addEventListener('touchstart', function(e) {
    if (isBouncing) return;
    startX = e.touches[0].clientX;
    isDragging = true;
    dragOffset = 0;
    track.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    dragOffset = e.touches[0].clientX - startX;
    var maxDrag = 30;
    if (currentSlide === 0 && dragOffset > 0) {
      dragOffset = maxDrag * (1 - 1 / (1 + dragOffset / maxDrag));
    }
    if (currentSlide === slides.length - 1 && dragOffset < 0) {
      dragOffset = -maxDrag * (1 - 1 / (1 + Math.abs(dragOffset) / maxDrag));
    }
    setDragTransform(dragOffset);
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (!isDragging) return;
    isDragging = false;
    snapToNearest();
  });

  var wrapper = track.closest('.jira-carousel-wrapper');
  if (wrapper) {
    wrapper.addEventListener('mouseenter', function() {
      wrapper.focus({ preventScroll: true });
    });

    wrapper.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSlide(currentSlide - 1);
        resetAutoplay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToSlide(currentSlide + 1);
        resetAutoplay();
      }
    });
  }

  function startAutoplay() {
  }

  function resetAutoplay() {
  }
})();

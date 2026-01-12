/**
 * CUPHEAD MODE
 * You won if you're reading this!
 */

(function() {
  'use strict';

  // Only enable on desktop with mouse
  if (window.innerWidth <= 900 || 'ontouchstart' in window) {
    return;
  }

  // ===== CONFIGURATION =====
  const CONFIG = {
    bullet: {
      angle: 225 * (Math.PI / 180), // 225 degrees (up-left, matching finger direction)
      speed: 18,
      size: 12,
      fadeRate: 0.008,
      collisionRadius: 8
    },
    cursor: {
      default: 'url("media/cursors/cursor.png") 7 5, auto',
      shoot: 'url("media/cursors/cursor-shoot.png") 7 5, auto'
    },
    particles: {
      count: 12,
      speed: { min: 2, max: 8 },
      size: { min: 4, max: 10 },
      lifetime: 1,
      colors: ['#f4d03f', '#e74c3c', '#fff5cc', '#d4a017', '#ff6b6b']
    }
  };

  // ===== STATE =====
  let cursorState = 'default'; // 'default', 'hover', 'text'
  let isAiming = false;
  let aimStartX = 0;
  let aimStartY = 0;
  let aimCursorX = 0; // Locked cursor X while aiming
  let aimCursorY = 0; // Locked cursor Y while aiming
  let currentAimAngle = CONFIG.bullet.angle; // Current rotation while aiming
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let cursorX = targetX;
  let cursorY = targetY;
  let currentScale = 1;
  let targetScale = 1;
  let currentRotation = 0;
  let targetRotation = 0;
  let driftSpeed = 0.005;
  let destroyedCount = 0; // Counter for destroyed objects
  const bullets = [];
  const particles = [];
  const destroyedElements = new Set();
  const elementHP = new Map(); // Track HP for each destructible element

  // ===== CREATE DOM ELEMENTS =====
  
  // Cursor follower circle
  const cursorDot = document.createElement('div');
  cursorDot.className = 'cursor-follower';
  document.documentElement.appendChild(cursorDot);

  // Bullet container
  const bulletContainer = document.createElement('div');
  bulletContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9998; overflow: visible;';
  document.documentElement.appendChild(bulletContainer);

  // Particle container
  const particleContainer = document.createElement('div');
  particleContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10001; overflow: visible;';
  document.documentElement.appendChild(particleContainer);

  // Inject CSS for hit shake animation and custom cursor
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes cuphead-hit-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px) rotate(-1deg); }
      40% { transform: translateX(4px) rotate(1deg); }
      60% { transform: translateX(-3px) rotate(-0.5deg); }
      80% { transform: translateX(3px) rotate(0.5deg); }
    }
    
    /* Hide default cursor when Cuphead mode is active */
    .cuphead-mode-active {
      cursor: none !important;
    }
    .cuphead-mode-active * {
      cursor: none !important;
    }
  `;
  document.head.appendChild(styleSheet);

  // Custom cursor element (so we can rotate it)
  const customCursor = document.createElement('img');
  customCursor.src = 'media/cursors/cursor.png';
  customCursor.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 48px;
    height: 48px;
    pointer-events: none;
    z-index: 10002;
    transform-origin: 7px 5px;
    image-rendering: pixelated;
  `;
  document.documentElement.appendChild(customCursor);

  // Kill counter element (displays next to cursor)
  const killCounter = document.createElement('div');
  killCounter.textContent = '0';
  killCounter.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    font-family: 'Lilita One', 'Nunito', sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: #2C3E50;
    pointer-events: none;
    z-index: 10002;
    text-shadow: 2px 2px 0 #fdfdd0, -1px -1px 0 #fdfdd0, 1px -1px 0 #fdfdd0, -1px 1px 0 #fdfdd0;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.documentElement.appendChild(killCounter);
  
  // Activate cuphead mode (hide default cursor)
  document.body.classList.add('cuphead-mode-active');

  // ===== CURSOR FOLLOWER =====
  
  function updateCursorFollower() {
    // Smooth following for the circle only
    cursorX += (targetX - cursorX) * 0.15;
    cursorY += (targetY - cursorY) * 0.15;
    currentScale += (targetScale - currentScale) * 0.15;
    currentRotation += (targetRotation - currentRotation) * 0.3;

    // Update cursor follower circle (smooth/lagging for effect)
    cursorDot.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%) scale(${currentScale})`;
    
    // Determine cursor display position
    let displayX, displayY;
    if (isAiming) {
      // While aiming: cursor barely moves, very slow drift toward mouse
      aimCursorX += (targetX - aimCursorX) * driftSpeed; // Very slow drift
      aimCursorY += (targetY - aimCursorY) * driftSpeed;
      displayX = aimCursorX;
      displayY = aimCursorY;
    } else {
      // Normal: instant follow
      displayX = targetX;
      displayY = targetY;
    }
    
    // Update custom cursor image
    customCursor.style.transform = `translate(${displayX - 7}px, ${displayY - 5}px) rotate(${currentRotation}deg)`;
    
    // Update kill counter position (offset to bottom-right of cursor)
    killCounter.style.transform = `translate(${displayX + 25}px, ${displayY + 20}px)`;
    
    requestAnimationFrame(updateCursorFollower);
  }

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    
    // If aiming, calculate rotation angle based on drag direction
    if (isAiming) {
      const dx = e.clientX - aimStartX;
      const dy = e.clientY - aimStartY;
      
      // Only rotate if dragged enough distance
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        // Calculate angle from start point to current mouse position
        const dragAngle = Math.atan2(dy, dx);
        
        // The cursor's default pointing direction is 225° (up-left)
        currentAimAngle = dragAngle;
        
        // To make finger point at drag direction: rotate by (dragAngle - defaultAngle)
        // Default finger direction is 225°, so we subtract that
        targetRotation = (dragAngle * 180 / Math.PI) - 225;
      }
    }
  });

  updateCursorFollower();

  // ===== CURSOR STATE TRACKING =====
  
  // Interactive elements - hover state (only actual clickable elements)
  document.querySelectorAll('.btn, .nav-links a, .footer-links a').forEach(el => {
    el.addEventListener('mouseenter', () => {
      targetScale = 1.5;
      cursorDot.style.borderColor = 'var(--accent-coral)';
      cursorState = 'hover';
      if (!isAiming) {
        customCursor.src = 'media/cursors/cursor-hover.png';
      }
    });

    el.addEventListener('mouseleave', () => {
      targetScale = 1;
      cursorDot.style.borderColor = 'var(--ink)';
      cursorState = 'default';
      if (!isAiming) {
        customCursor.src = 'media/cursors/cursor.png';
      }
    });

    // Click state - show click cursor when pressing on interactive elements
    el.addEventListener('mousedown', () => {
      if (!isAiming) {
        customCursor.src = 'media/cursors/cursor-click.png';
      }
    });

    el.addEventListener('mouseup', () => {
      if (!isAiming && cursorState === 'hover') {
        customCursor.src = 'media/cursors/cursor-hover.png';
      }
    });
  });

  // Text inputs - text state
  document.querySelectorAll('input, textarea, [contenteditable]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursorState = 'text';
      if (!isAiming) {
        customCursor.src = 'media/cursors/cursor-text.png';
      }
    });
    el.addEventListener('mouseleave', () => {
      cursorState = 'default';
      if (!isAiming) {
        customCursor.src = 'media/cursors/cursor.png';
      }
    });
  });

  // ===== BULLET CREATION =====
  
  function createBullet(x, y, angle = CONFIG.bullet.angle) {
    const bullet = document.createElement('div');
    bullet.style.cssText = `
      position: fixed;
      width: ${CONFIG.bullet.size}px;
      height: ${CONFIG.bullet.size}px;
      background: radial-gradient(circle at 30% 30%, #fff5cc, #f4d03f 40%, #d4a017 100%);
      border: 2px solid var(--ink);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9998;
      box-shadow: 2px 2px 0 var(--ink-faint), inset -2px -2px 4px rgba(0,0,0,0.2);
      transform: translate(-50%, -50%);
    `;
    bullet.style.left = x + 'px';
    bullet.style.top = y + 'px';
    bulletContainer.appendChild(bullet);

    const vx = Math.cos(angle) * CONFIG.bullet.speed;
    const vy = Math.sin(angle) * CONFIG.bullet.speed;

    bullets.push({
      element: bullet,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      life: 1
    });

    // Increment global shot counter (Firebase)
    if (typeof window.incrementGlobalShots === 'function') {
      window.incrementGlobalShots();
    }
  }

  // ===== PARTICLE EXPLOSION =====
  
  function createExplosion(x, y) {
    for (let i = 0; i < CONFIG.particles.count; i++) {
      const particle = document.createElement('div');
      const size = CONFIG.particles.size.min + Math.random() * (CONFIG.particles.size.max - CONFIG.particles.size.min);
      const color = CONFIG.particles.colors[Math.floor(Math.random() * CONFIG.particles.colors.length)];
      
      particle.style.cssText = `
        position: fixed;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 1px solid var(--ink);
        border-radius: 50%;
        pointer-events: none;
        z-index: 10001;
        transform: translate(-50%, -50%);
      `;
      particle.style.left = x + 'px';
      particle.style.top = y + 'px';
      particleContainer.appendChild(particle);

      // Random direction for each particle
      const angle = Math.random() * Math.PI * 2;
      const speed = CONFIG.particles.speed.min + Math.random() * (CONFIG.particles.speed.max - CONFIG.particles.speed.min);

      particles.push({
        element: particle,
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: CONFIG.particles.lifetime,
        gravity: 0.2
      });
    }
  }

  // ===== COLLISION DETECTION =====
  
  function isElementVisible(el) {
    if (!el || el === document.documentElement || el === document.body) return false;
    
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }
    
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    
    return true;
  }

  function isDestroyable(el) {
    // Only destroy elements explicitly marked as destructible
    if (!el.hasAttribute('data-destructible')) return false;
    
    // Don't destroy already destroyed elements
    if (destroyedElements.has(el)) return false;
    
    return true;
  }

  function getElementAtPoint(x, y) {
    // Temporarily hide our UI elements
    const originalPointerEvents = {
      bullet: bulletContainer.style.pointerEvents,
      particle: particleContainer.style.pointerEvents,
      cursor: cursorDot.style.pointerEvents
    };
    
    bulletContainer.style.pointerEvents = 'none';
    particleContainer.style.pointerEvents = 'none';
    cursorDot.style.pointerEvents = 'none';

    // Get all elements at point
    const elements = document.elementsFromPoint(x, y);
    
    // Restore pointer events
    bulletContainer.style.pointerEvents = originalPointerEvents.bullet;
    particleContainer.style.pointerEvents = originalPointerEvents.particle;
    cursorDot.style.pointerEvents = originalPointerEvents.cursor;

    // Find the first visible, destroyable element
    for (const el of elements) {
      if (isElementVisible(el) && isDestroyable(el)) {
        return el;
      }
    }
    
    return null;
  }

  // Get initial HP for an element (from data-hp attribute, default 1)
  function getElementMaxHP(el) {
    const hpAttr = el.getAttribute('data-hp');
    return hpAttr ? parseInt(hpAttr, 10) : 1;
  }

  // Get current HP for an element
  function getElementHP(el) {
    if (!elementHP.has(el)) {
      elementHP.set(el, getElementMaxHP(el));
    }
    return elementHP.get(el);
  }

  // Apply hit feedback animation (shake + red glow)
  function applyHitFeedback(el) {
    // Store original styles
    const originalFilter = el.style.filter;
    const originalTransform = el.style.transform;
    
    // Apply red glow and shake
    el.style.transition = 'none';
    el.style.filter = 'brightness(1.5) sepia(1) hue-rotate(-50deg) saturate(3)';
    
    // Shake animation using CSS animation
    el.style.animation = 'cuphead-hit-shake 0.15s ease-out';
    
    // Reset after animation
    setTimeout(() => {
      el.style.filter = originalFilter;
      el.style.animation = '';
    }, 150);
  }

  // Damage an element, returns true if destroyed
  function damageElement(el, bulletX, bulletY) {
    if (!el || destroyedElements.has(el)) return false;
    
    const currentHP = getElementHP(el);
    const newHP = currentHP - 1;
    elementHP.set(el, newHP);
    
    // Create small particle burst at impact
    createExplosion(bulletX, bulletY);
    
    if (newHP <= 0) {
      // Element is destroyed
      destroyElement(el);
      return true;
    } else {
      // Element survives - apply hit feedback
      applyHitFeedback(el);
      return false;
    }
  }

  function destroyElement(el) {
    if (!el || destroyedElements.has(el)) return;
    
    destroyedElements.add(el);
    
    // Increment kill counter
    destroyedCount++;
    killCounter.textContent = destroyedCount;
    killCounter.style.opacity = '1';
    
    // Make element invisible but keep it in the layout
    // Using visibility: hidden preserves the element's space
    el.style.transition = 'opacity 0.2s ease-out';
    el.style.opacity = '0';
    
    // After fade out, set visibility to hidden to ensure it doesn't receive events
    setTimeout(() => {
      el.style.visibility = 'hidden';
    }, 200);
  }

  // ===== UPDATE LOOPS =====
  
  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      
      // Check for collision before moving
      const hitElement = getElementAtPoint(bullet.x, bullet.y);
      if (hitElement) {
        // Damage the element (subtracts 1 HP)
        damageElement(hitElement, bullet.x, bullet.y);
        
        // Remove the bullet
        bullet.element.remove();
        bullets.splice(i, 1);
        continue;
      }
      
      // Update position
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      bullet.life -= CONFIG.bullet.fadeRate;
      
      bullet.element.style.left = bullet.x + 'px';
      bullet.element.style.top = bullet.y + 'px';
      bullet.element.style.opacity = bullet.life;

      // Remove if off screen or faded
      if (bullet.life <= 0 || 
          bullet.x < -50 || bullet.x > window.innerWidth + 50 ||
          bullet.y < -50 || bullet.y > window.innerHeight + 50) {
        bullet.element.remove();
        bullets.splice(i, 1);
      }
    }
    requestAnimationFrame(updateBullets);
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      
      // Update position with gravity
      particle.vy += particle.gravity;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= 0.02;
      
      // Slow down
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      
      particle.element.style.left = particle.x + 'px';
      particle.element.style.top = particle.y + 'px';
      particle.element.style.opacity = particle.life;
      particle.element.style.transform = `translate(-50%, -50%) scale(${particle.life})`;

      // Remove if faded
      if (particle.life <= 0) {
        particle.element.remove();
        particles.splice(i, 1);
      }
    }
    requestAnimationFrame(updateParticles);
  }

  updateBullets();
  updateParticles();

  // ===== SHOOTING MECHANICS =====
  // Click and hold to aim, drag to rotate, release to shoot
  
  document.addEventListener('mousedown', (e) => {
    if (cursorState === 'default' && !isAiming) {
      // Prevent text/image selection when aiming
      e.preventDefault();
      
      // Start aiming - lock cursor position
      isAiming = true;
      aimStartX = e.clientX;
      aimStartY = e.clientY;
      aimCursorX = e.clientX; // Lock cursor at current position
      aimCursorY = e.clientY;
      currentAimAngle = CONFIG.bullet.angle; // Reset to default angle
      
      // Change cursor to shooting pose
      customCursor.src = 'media/cursors/cursor-shoot.png';
      
      // Visual feedback - scale down slightly while aiming
      targetScale = 0.9;
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (isAiming) {
      // Shoot from the locked cursor position in the aimed direction
      const tipOffsetX = Math.cos(currentAimAngle) * 25;
      const tipOffsetY = Math.sin(currentAimAngle) * 25;
      createBullet(aimCursorX + tipOffsetX, aimCursorY + tipOffsetY, currentAimAngle);
      
      // Brief recoil effect
      targetScale = 0.7;
      setTimeout(() => {
        targetScale = 1;
      }, 100);
      
      // Reset aiming state
      isAiming = false;
      targetRotation = 0; // Reset rotation
      currentAimAngle = CONFIG.bullet.angle; // Reset to default
      
      // Restore default cursor
      customCursor.src = 'media/cursors/cursor.png';
    }
  });

  // Log for debugging
  console.log('🎮 Cuphead Mode activated! Click and drag to aim, release to shoot!');
  
})();

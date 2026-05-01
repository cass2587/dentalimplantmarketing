if (typeof window !== 'undefined') {
    window.scrollRestoration = 'manual';
}

document.addEventListener('DOMContentLoaded', function() {

    // ===== MOBILE VIDEO HANDLING =====
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    // Disable hero video autoplay on mobile to prevent crash
    if (isMobile) {
        var heroVideo = document.querySelector('.hero-bg-video');
        if (heroVideo) {
            heroVideo.removeAttribute('autoplay');
            heroVideo.pause();
            heroVideo.preload = 'none';
            // Remove the source to prevent any loading
            var heroSource = heroVideo.querySelector('source');
            if (heroSource) heroSource.removeAttribute('src');
            heroVideo.load();
        }
    }

    // Lazy-load videos with data-src using IntersectionObserver
    var lazyVideos = document.querySelectorAll('.lazy-video');
    if (lazyVideos.length > 0 && 'IntersectionObserver' in window) {
        var videoObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting && !isMobile) {
                    var video = entry.target;
                    var src = video.getAttribute('data-src');
                    if (src) {
                        var source = video.querySelector('source');
                        if (source) source.src = src;
                        video.load();
                        video.play();
                    }
                    videoObserver.unobserve(video);
                }
            });
        }, { rootMargin: '200px' });

        lazyVideos.forEach(function(video) {
            videoObserver.observe(video);
        });
    }

    // On mobile, defer iframe loading until they are near viewport
    if (isMobile) {
        var allIframes = document.querySelectorAll('iframe[loading="lazy"]');
        allIframes.forEach(function(iframe) {
            var realSrc = iframe.getAttribute('src');
            iframe.setAttribute('data-src', realSrc);
            iframe.removeAttribute('src');
        });

        if ('IntersectionObserver' in window) {
            var iframeObserver = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        var iframe = entry.target;
                        var src = iframe.getAttribute('data-src');
                        if (src) {
                            iframe.src = src;
                            iframe.removeAttribute('data-src');
                        }
                        iframeObserver.unobserve(iframe);
                    }
                });
            }, { rootMargin: '400px' });

            allIframes.forEach(function(iframe) {
                iframeObserver.observe(iframe);
            });
        }
    }

    // ===== FORM SUBMISSION =====
    var contactForm = document.getElementById('lead-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var form = this;
            var submitBtn = form.querySelector('button[type="submit"]');
            var originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            // Collect form data manually to ensure we get everything
            var data = {
                name: form.querySelector('[name="name"]').value,
                practiceName: form.querySelector('[name="practiceName"]').value,
                phone: form.querySelector('[name="phone"]').value,
                email: form.querySelector('[name="email"]').value,
                message: form.querySelector('[name="message"]').value
            };

            // Get the Turnstile token - try multiple methods
            var turnstileInput = form.querySelector('[name="cf-turnstile-response"]');
            if (turnstileInput && turnstileInput.value) {
                data['cf-turnstile-response'] = turnstileInput.value;
            } else if (typeof turnstile !== 'undefined') {
                // Try getting the token from the Turnstile API directly
                var widgetEl = form.querySelector('.cf-turnstile');
                if (widgetEl) {
                    var widgetId = widgetEl.getAttribute('data-widget-id');
                    if (widgetId) {
                        try {
                            var token = turnstile.getResponse(widgetId);
                            if (token) data['cf-turnstile-response'] = token;
                        } catch(err) {
                            console.warn('Could not get Turnstile response via API:', err);
                        }
                    }
                }
                // Also try without widget ID
                if (!data['cf-turnstile-response']) {
                    try {
                        var token = turnstile.getResponse();
                        if (token) data['cf-turnstile-response'] = token;
                    } catch(err) {
                        console.warn('Could not get Turnstile response:', err);
                    }
                }
            }

            // Also check via FormData as a final fallback
            if (!data['cf-turnstile-response']) {
                var formData = new FormData(form);
                var turnstileVal = formData.get('cf-turnstile-response');
                if (turnstileVal) data['cf-turnstile-response'] = turnstileVal;
            }

            console.log('Submitting form data:', JSON.stringify({
                hasName: !!data.name,
                hasEmail: !!data.email,
                hasMessage: !!data.message,
                hasTurnstile: !!data['cf-turnstile-response']
            }));

            try {
                var response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                var result = await response.json();

                if (!response.ok) {
                    console.error('Server error:', response.status, result);
                    throw new Error(result.error || 'Failed to submit form');
                }

                // Safe DOM creation to avoid TrustedHTML CSP errors
                var container = document.createElement('div');
                container.style.cssText = 'text-align:center;padding:2rem;';

                var title = document.createElement('h3');
                title.style.cssText = 'color:var(--accent);font-size:1.5rem;margin-bottom:1rem;';
                title.textContent = "You're In!";

                var p1 = document.createElement('p');
                p1.style.fontSize = '1.1rem';
                p1.textContent = 'Cassidy will personally reach out within 24 hours to schedule your free strategy session.';

                var p2 = document.createElement('p');
                p2.style.cssText = 'margin-top:1rem;font-size:0.95rem;opacity:0.8;';
                p2.textContent = 'Check your phone - we like to call first.';

                container.appendChild(title);
                container.appendChild(p1);
                container.appendChild(p2);

                form.parentNode.replaceChild(container, form);
            } catch (error) {
                console.error('Submission error:', error.message);
                alert('Something went wrong: ' + error.message + '\n\nPlease try again or call us directly at (603) 630-3944.');
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;

                // Reset Turnstile widget for retry
                if (typeof turnstile !== 'undefined') {
                    try { turnstile.reset(); } catch(err) {}
                }
            }
        });
    }

    // ===== SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            var href = this.getAttribute('href');
            if (href.length > 1) {
                var target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Close exit popup if open
                    var popup = document.getElementById('exit-popup');
                    if (popup) popup.classList.remove('active');
                }
            }
        });
    });

    // ===== ANIMATED COUNTERS #24 =====
    var countersStarted = false;
    function animateCounters() {
        if (countersStarted) return;
        var statNumbers = document.querySelectorAll('.stat-number');
        if (!statNumbers.length) return;

        var statsSection = document.querySelector('.stats-section');
        if (!statsSection) return;

        var rect = statsSection.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            countersStarted = true;
            statNumbers.forEach(function(el) {
                var target = parseFloat(el.getAttribute('data-target'));
                var suffix = el.getAttribute('data-suffix') || '';
                var prefix = el.getAttribute('data-prefix') || '';
                var isDecimal = target % 1 !== 0;
                var duration = 2000;
                var startTime = null;

                function step(timestamp) {
                    if (!startTime) startTime = timestamp;
                    var progress = Math.min((timestamp - startTime) / duration, 1);
                    var eased = 1 - Math.pow(1 - progress, 3);
                    var current = eased * target;
                    el.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;
                    if (progress < 1) {
                        requestAnimationFrame(step);
                    }
                }
                requestAnimationFrame(step);
            });
        }
    }
    window.addEventListener('scroll', animateCounters);
    animateCounters();

    // ===== COUNTDOWN TIMER #7 =====
    function startCountdown() {
        var now = new Date();
        var endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        function update() {
            var now = new Date();
            var diff = endOfMonth - now;
            if (diff <= 0) {
                endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                diff = endOfMonth - now;
            }
            var days = Math.floor(diff / (1000 * 60 * 60 * 24));
            var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            var secs = Math.floor((diff % (1000 * 60)) / 1000);

            var daysEl = document.getElementById('cd-days');
            var hoursEl = document.getElementById('cd-hours');
            var minsEl = document.getElementById('cd-mins');
            var secsEl = document.getElementById('cd-secs');

            if (daysEl) daysEl.textContent = days < 10 ? '0' + days : days;
            if (hoursEl) hoursEl.textContent = hours < 10 ? '0' + hours : hours;
            if (minsEl) minsEl.textContent = mins < 10 ? '0' + mins : mins;
            if (secsEl) secsEl.textContent = secs < 10 ? '0' + secs : secs;
        }
        update();
        setInterval(update, 1000);
    }
    startCountdown();

    // ===== FAQ ACCORDION #31 =====
    document.querySelectorAll('.faq-question').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var item = this.parentElement;
            var isActive = item.classList.contains('active');
            // Close all
            document.querySelectorAll('.faq-item').forEach(function(faq) {
                faq.classList.remove('active');
            });
            // Toggle current
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // ===== EXIT INTENT POPUP #19 =====
    var exitShown = false;
    document.addEventListener('mouseout', function(e) {
        if (e.clientY <= 0 && e.relatedTarget === null && !exitShown) {
            exitShown = true;
            var popup = document.getElementById('exit-popup');
            if (popup) popup.classList.add('active');
        }
    });

    var exitClose = document.getElementById('exit-close');
    var exitOverlay = document.getElementById('exit-overlay');
    var exitCtaBtn = document.getElementById('exit-cta-btn');

    function closePopup() {
        var popup = document.getElementById('exit-popup');
        if (popup) popup.classList.remove('active');
    }

    if (exitClose) exitClose.addEventListener('click', closePopup);
    if (exitOverlay) exitOverlay.addEventListener('click', closePopup);
    if (exitCtaBtn) exitCtaBtn.addEventListener('click', closePopup);

    // ===== SCROLL ANIMATIONS =====
    var observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -80px 0px'
    };

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    var animatedElements = document.querySelectorAll('.p-card, .testimonial-card, .pain-card, .step-card, .transform-card, .american-card, .stat-card');
    animatedElements.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(25px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // ===== NAVBAR HIDE URGENCY BAR ON SCROLL =====
    var urgencyBar = document.querySelector('.urgency-bar');
    var lastScroll = 0;
    window.addEventListener('scroll', function() {
        var currentScroll = window.pageYOffset;
        if (urgencyBar) {
            if (currentScroll > 200) {
                urgencyBar.style.transform = 'translateY(-100%)';
                urgencyBar.style.transition = 'transform 0.3s ease';
            } else {
                urgencyBar.style.transform = 'translateY(0)';
            }
        }
        lastScroll = currentScroll;
    });

});

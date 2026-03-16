// ig_hide_for_you.js
// Only activates on the main Instagram feed (/) when the user is logged in.
//
// Strategy:
//   - Finds the feed container div (nextElementSibling of the stories bar) and
//     hides it with display:none. This collapses the page height so there is
//     nothing to scroll, and ALL feed content is hidden regardless of any
//     visibility:visible overrides inside Instagram.
//   - A fixed overlay covers the area below stories to show "Blocked by
//     MobileLess". The overlay uses pointer-events:none so all elements below
//     (nav bar, header) remain fully interactive even if visually the overlay
//     background reaches them.
//   - The overlay bottom is set to exactly the height of Instagram's bottom nav
//     bar so it does not physically overlap with the nav bar — avoiding any
//     z-index conflict entirely. If detection fails, a 70px fallback is used.

function _mlIsMainFeed() {
    var p = window.location.pathname.replace(/\/+$/, '') || '/';
    return p === '/' || p === '';
}

function _mlIsLoggedIn() {
    if (document.querySelector('a[href="/u/profile/"]')) return false;
    if (document.querySelector('a[href*="accounts/login"], a[href*="accounts/emailsignup"]')) return false;
    return true;
}

// Find the stories bar and its next sibling (the feed container).
function _mlFindFeedParts() {
    var iW = window.innerWidth;
    function walk(el, depth) {
        if (depth > 12 || !el) return null;
        var children = Array.from(el.children);
        for (var i = 0; i < children.length; i++) {
            var c = children[i];
            var r = c.getBoundingClientRect();
            if (r.height > 60 && r.height < 220 &&
                Math.abs(r.top - 44) < 30 &&
                r.width > iW * 0.7 &&
                c.nextElementSibling) {
                return { stories: c, feed: c.nextElementSibling };
            }
        }
        for (var j = 0; j < children.length; j++) {
            var res = walk(children[j], depth + 1);
            if (res) return res;
        }
        return null;
    }
    var main = document.querySelector('main');
    return main ? walk(main, 0) : null;
}

// Measure the height of Instagram's fixed bottom nav bar.
// Returns the height in CSS pixels so the overlay can end just above it.
function _mlNavBarHeight() {
    var iH = window.innerHeight;
    var bottomH = 0;
    document.querySelectorAll('div,nav,section').forEach(function(el) {
        var cs = window.getComputedStyle(el);
        var r  = el.getBoundingClientRect();
        if (cs.position === 'fixed' &&
            r.top > iH * 0.70 &&
            r.bottom <= iH + 2 &&
            r.height >= 40 && r.height <= 100) {
            var h = iH - r.top;
            if (h > bottomH) bottomH = h;
        }
    });
    // Use 70px fallback — generous enough to clear the nav on all devices.
    return bottomH >= 40 ? Math.ceil(bottomH) : 70;
}

function _mlActivate() {
    var parts = _mlFindFeedParts();

    if (parts && parts.feed) {
        parts.feed.style.setProperty('display', 'none', 'important');
    }

    var overlayTop = parts
        ? Math.ceil(parts.stories.getBoundingClientRect().bottom)
        : 169;
    var overlayBottom = _mlNavBarHeight();

    var o = document.getElementById('ml-for-you-overlay');
    if (!o) {
        o = document.createElement('div');
        o.id = 'ml-for-you-overlay';
        if (document.body) document.body.appendChild(o);
    }
    o.setAttribute('style', [
        'position:fixed',
        'top:'    + overlayTop    + 'px',
        'left:0',
        'right:0',
        'bottom:' + overlayBottom + 'px',
        'z-index:1',
        'background:#f0f0f0',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:15px',
        'color:#888',
        // pointer-events:none: overlay is purely visual.
        // Scroll prevention is not needed because display:none on the feed
        // container collapses the page height to near-zero.
        'pointer-events:none',
        'text-align:center',
        'padding:16px',
        'box-sizing:border-box',
    ].join(';'));
    o.textContent = 'Blocked by MobileLess';
}

function _mlDeactivate() {
    var parts = _mlFindFeedParts();
    if (parts && parts.feed) {
        parts.feed.style.removeProperty('display');
    }
    var o = document.getElementById('ml-for-you-overlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
}

if(window._mlForYouInterval)clearInterval(window._mlForYouInterval);
window._mlForYouInterval=setInterval(function() {
    if (_mlIsMainFeed() && _mlIsLoggedIn()) {
        _mlActivate();
    } else {
        _mlDeactivate();
    }
}, 600);

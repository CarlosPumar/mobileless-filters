// ig_hide_for_you.js
// Only activates on the main Instagram feed (/).
//
// Strategy to avoid flicker and infinite-scroll loop:
//   - Uses `visibility: hidden` (NOT display:none) so articles keep their
//     height. The page scroll height stays the same, so Instagram's
//     IntersectionObserver sentinel for infinite scroll never enters the
//     viewport and stops triggering new loads.
//   - Locks window scroll (overflow:hidden on html+body) so the user cannot
//     scroll down to where the sentinel eventually is.
//   - A fixed overlay with "Blocked by MobileLess" covers the content area.
//     pointer-events:none so the nav bar stays clickable underneath.

var _mlForYouActive = false;

function _mlIsMainFeed() {
    var p = window.location.pathname.replace(/\/+$/, '') || '/';
    return p === '/' || p === '';
}

function _mlActivate() {
    if (!document.getElementById('ml-for-you-style')) {
        var s = document.createElement('style');
        s.id = 'ml-for-you-style';
        // visibility:hidden hides content but preserves layout height.
        // overflow:hidden on html+body prevents scroll so the infinite-scroll
        // sentinel never reaches the viewport.
        s.textContent = [
            'article{visibility:hidden!important;}',
            'html,body{overflow:hidden!important;}',
        ].join('');
        (document.head || document.documentElement).appendChild(s);
    }

    if (!document.getElementById('ml-for-you-overlay')) {
        var o = document.createElement('div');
        o.id = 'ml-for-you-overlay';
        o.setAttribute('style', [
            'position:fixed',
            'top:0',
            'left:0',
            'right:0',
            'bottom:0',
            'z-index:100',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:16px',
            'color:#888',
            'pointer-events:none',
            'text-align:center',
            'padding:16px',
            'box-sizing:border-box',
        ].join(';'));
        o.textContent = 'Blocked by MobileLess';
        document.body && document.body.appendChild(o);
    }

    _mlForYouActive = true;
}

function _mlDeactivate() {
    if (!_mlForYouActive) return;
    var s = document.getElementById('ml-for-you-style');
    if (s && s.parentNode) s.parentNode.removeChild(s);
    var o = document.getElementById('ml-for-you-overlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
    _mlForYouActive = false;
}

setInterval(function() {
    if (_mlIsMainFeed()) {
        _mlActivate();
    } else {
        _mlDeactivate();
    }
}, 600);

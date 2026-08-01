// ig_hide_stories.js
// Hides OTHER people's Stories from the feed's tray, while keeping the user's
// own "Your story / Add story" button so they can still post a story.
// Only activates on the main feed (/) when the user is logged in.
//
// Approach: inject a CSS rule (not per-element inline styles). A CSS rule is
// applied by the browser to every matching element the instant it appears, so
// it survives Instagram's React re-renders while scrolling — inline styles set
// by a polling loop do not (new nodes show for a frame before the next tick).
//
// Each other-user story circle is role="button" with aria-label "Story by
// <user>" (localized, always with a "by/de/di/von <user>" connector). The
// user's own "Your story" button has NO such aria-label, so it stays visible.
// The connector is what keeps the selectors from matching the own button.
//
// Self-contained polling toggles the <style> by path/login. We do NOT use
// window._mlSchedule — the deployed baseline.js lacks it and it would throw.

var _ML_STORIES_STYLE_ID = 'ml-ig-stories-hide';

var _ML_STORIES_CSS = [
    '[aria-label*="Story by" i]',
    '[aria-label*="Historia de" i]',
    '[aria-label*="Storia di" i]',
    '[aria-label*="História de" i]',
    '[aria-label*="Story von" i]',
    '[aria-label*="Geschichte von" i]',
    '[aria-label*="Histoire de" i]',
    '[aria-label*="Verhaal van" i]'
].join(',') + '{display:none!important;}';

function _mlStoriesIsMainFeed() {
    var p = window.location.pathname.replace(/\/+$/, '') || '/';
    return p === '/' || p === '';
}

function _mlStoriesIsLoggedIn() {
    if (document.querySelector('a[href="/u/profile/"]')) return false;
    if (document.querySelector('a[href*="accounts/login"], a[href*="accounts/emailsignup"]')) return false;
    return true;
}

function _mlStoriesOn() {
    if (document.getElementById(_ML_STORIES_STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = _ML_STORIES_STYLE_ID;
    s.textContent = _ML_STORIES_CSS;
    (document.head || document.documentElement).appendChild(s);
}

function _mlStoriesOff() {
    var s = document.getElementById(_ML_STORIES_STYLE_ID);
    if (s && s.parentNode) s.parentNode.removeChild(s);
}

if (window._mlStoriesInterval) clearInterval(window._mlStoriesInterval);
window._mlStoriesInterval = setInterval(function () {
    if (_mlStoriesIsMainFeed() && _mlStoriesIsLoggedIn()) {
        _mlStoriesOn();
    } else {
        _mlStoriesOff();
    }
}, 600);

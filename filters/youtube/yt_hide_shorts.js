// yt_hide_shorts.js
// Three behaviours:
//
//   1. Always: hide the Shorts tab in the bottom navigation
//      (ytm-pivot-bar-item-renderer containing .pivot-shorts).
//
//   2. On home (/): hide Shorts shelf sections.
//      YouTube renders Shorts as ytm-rich-section-renderer rows that contain
//      ytm-shorts-lockup-view-model thumbnails. We hide those sections.
//
//   3. On /shorts/* path: let the user watch the current Short, but block
//      swiping to the next one. YouTube uses a carousel
//      (#carousel-scrollable-wrapper) with transform-based navigation.
//      We lock it with CSS (touch-action:none, pointer-events on siblings)
//      and block touch/wheel events.

var _mlYtShortsScrollLocked=window._mlYtShortsScrollLocked||false;

function _mlYtCurrentPath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlYtIsHome(){
    var p=_mlYtCurrentPath();
    return p==='/'||p==='';
}

function _mlYtIsShorts(){
    return _mlYtCurrentPath().indexOf('/shorts')===0;
}

// ── 1. Always hide Shorts tab ──────────────────────────────────────────────

function _mlYtHideShortsTab(){
    var pivotShorts=document.querySelector('.pivot-shorts');
    if(!pivotShorts)return;
    var item=pivotShorts.closest('ytm-pivot-bar-item-renderer');
    if(item&&item.style.display!=='none'){
        item.style.setProperty('display','none','important');
    }
}

// ── 2. Hide Shorts shelf on home ───────────────────────────────────────────

function _mlYtHideShortsShelf(){
    document.querySelectorAll('ytm-rich-section-renderer').forEach(function(section){
        if(section.querySelector('ytm-shorts-lockup-view-model')){
            section.style.setProperty('display','none','important');
            section.setAttribute('data-ml-hidden','1');
        }
    });
}

// ── 3. Lock Shorts carousel scroll ─────────────────────────────────────────

function _mlYtBlockWheel(e){e.preventDefault();e.stopPropagation();}
function _mlYtBlockTouch(e){e.preventDefault();e.stopPropagation();}

function _mlYtLockShortsScroll(){
    if(_mlYtShortsScrollLocked)return;

    // Inject CSS that blocks the carousel from advancing
    if(!document.getElementById('ml-yt-shorts-lock')){
        var s=document.createElement('style');
        s.id='ml-yt-shorts-lock';
        s.textContent=[
            // Lock the carousel wrapper so swipe gestures have no effect
            '#carousel-scrollable-wrapper{touch-action:none!important;overflow:hidden!important;}',
            // Also lock shorts-carousel and its parent in case YouTube
            // listens for events higher in the tree
            'shorts-carousel{touch-action:none!important;}',
            '#player-shorts-container{touch-action:none!important;}',
        ].join('');
        (document.head||document.documentElement).appendChild(s);
    }

    // Block wheel/touch events on the carousel
    var wrapper=document.getElementById('carousel-scrollable-wrapper');
    if(wrapper){
        wrapper.addEventListener('wheel',_mlYtBlockWheel,{capture:true,passive:false});
        wrapper.addEventListener('touchmove',_mlYtBlockTouch,{capture:true,passive:false});
    }
    var psc=document.getElementById('player-shorts-container');
    if(psc){
        psc.addEventListener('wheel',_mlYtBlockWheel,{capture:true,passive:false});
        psc.addEventListener('touchmove',_mlYtBlockTouch,{capture:true,passive:false});
    }

    _mlYtShortsScrollLocked=true;
    window._mlYtShortsScrollLocked=true;
}

function _mlYtUnlockShortsScroll(){
    if(!_mlYtShortsScrollLocked)return;

    var s=document.getElementById('ml-yt-shorts-lock');
    if(s&&s.parentNode)s.parentNode.removeChild(s);

    var wrapper=document.getElementById('carousel-scrollable-wrapper');
    if(wrapper){
        wrapper.removeEventListener('wheel',_mlYtBlockWheel,{capture:true});
        wrapper.removeEventListener('touchmove',_mlYtBlockTouch,{capture:true});
    }
    var psc=document.getElementById('player-shorts-container');
    if(psc){
        psc.removeEventListener('wheel',_mlYtBlockWheel,{capture:true});
        psc.removeEventListener('touchmove',_mlYtBlockTouch,{capture:true});
    }

    _mlYtShortsScrollLocked=false;
    window._mlYtShortsScrollLocked=false;
}

// ── Main interval ──────────────────────────────────────────────────────────

if(window._mlYtShortsInterval)clearInterval(window._mlYtShortsInterval);
window._mlYtShortsInterval=setInterval(function(){
    _mlYtHideShortsTab();

    if(_mlYtIsShorts()){
        _mlYtLockShortsScroll();
    }else{
        _mlYtUnlockShortsScroll();
        if(_mlYtIsHome()){
            _mlYtHideShortsShelf();
        }
    }
},600);

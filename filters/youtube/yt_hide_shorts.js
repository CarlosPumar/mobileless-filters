// yt_hide_shorts.js
// Three behaviours:
//
//   1. Always: hide the Shorts tab in the bottom navigation
//      (ytm-pivot-bar-item-renderer containing .pivot-shorts).
//
//   2. On home (/) and the Subscriptions feed (/feed/subscriptions):
//      hide Shorts shelf sections. On home YouTube renders Shorts as
//      ytm-rich-section-renderer rows containing ytm-shorts-lockup-view-model
//      thumbnails; on Subscriptions they show up as a horizontal reel shelf
//      (ytm-reel-shelf-renderer). We hide both forms.
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

function _mlYtIsSubscriptions(){
    return _mlYtCurrentPath().indexOf('/feed/subscriptions')===0;
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

// ── 2. Hide Shorts shelf on home + subscriptions ───────────────────────────

// A single Shorts thumbnail. Newer YouTube wraps ...view-model (inner) inside
// ...view-model-v2 (outer); older layouts have only one. Both are shared web
// components used on m.youtube.com and desktop alike.
var _ML_YT_SHORTS_ITEM='ytm-shorts-lockup-view-model-v2,ytm-shorts-lockup-view-model';

// Selectors that identify a "normal video" — a container holding one of these
// is a mixed/regular feed section and must NOT be hidden wholesale.
var _ML_YT_VIDEO_SEL='ytm-video-with-context-renderer,ytm-compact-video-renderer,ytm-rich-item-renderer,ytm-media-item';

// Shelf/section wrappers a Shorts row can live in (home + subscriptions).
var _ML_YT_SHELF_SEL='ytm-reel-shelf-renderer,ytm-rich-shelf-renderer,ytm-rich-section-renderer,ytm-shelf-renderer,ytm-item-section-renderer';

function _mlYtHideEl(el){
    if(el&&el.getAttribute('data-ml-hidden')!=='1'){
        el.style.setProperty('display','none','important');
        el.setAttribute('data-ml-hidden','1');
    }
}

function _mlYtHideShortsShelf(){
    // (a) Home: dedicated Shorts rows rendered as ytm-rich-section-renderer
    //     that contain a shorts lockup, a reel shelf, or a /shorts/ link.
    document.querySelectorAll('ytm-rich-section-renderer').forEach(function(section){
        if(section.querySelector(_ML_YT_SHORTS_ITEM+',ytm-reel-shelf-renderer,a[href*="/shorts/"]')){
            _mlYtHideEl(section);
        }
    });

    // (b) Reel shelves (subscriptions + older layouts): hide the shelf and, when
    //     it is the only content, its section wrapper (avoids a "Shorts" header
    //     with nothing under it). Never hide a section that also holds videos.
    document.querySelectorAll('ytm-reel-shelf-renderer').forEach(function(shelf){
        _mlYtHideEl(shelf);
        var section=shelf.closest('ytm-item-section-renderer');
        if(section&&!section.querySelector(_ML_YT_VIDEO_SEL)){
            _mlYtHideEl(section);
        }
    });

    // (c) Content-signal fallback (robust across layouts): every Shorts thumbnail
    //     links to /shorts/VIDEO_ID. Hide the nearest shelf/section that holds
    //     one — but never a section that also holds normal videos, so the regular
    //     Subscriptions feed stays intact.
    document.querySelectorAll('a[href*="/shorts/"]').forEach(function(a){
        var container=a.closest(_ML_YT_SHELF_SEL);
        if(container&&!container.querySelector(_ML_YT_VIDEO_SEL)){
            _mlYtHideEl(container);
        }
    });

    // (d) Last resort: hide any individual Shorts lockups still left visible
    //     (both the v2 wrapper and the bare view-model).
    document.querySelectorAll(_ML_YT_SHORTS_ITEM).forEach(_mlYtHideEl);
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
        if(_mlYtIsHome()||_mlYtIsSubscriptions()){
            _mlYtHideShortsShelf();
        }
    }
},600);

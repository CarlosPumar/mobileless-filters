// ig_no_scroll_posts.js
// Behaviour by page:
//   /           (main feed)  – do nothing, scrolling is intentionally allowed.
//   /explore/               – hide the recommendations grid using CSS injection
//                             (same approach as ig_hide_for_you):
//                             · visibility:hidden + pointer-events:none on all
//                               post/reel thumbnail links → grid disappears.
//                             · overflow:hidden on html,body → prevents scroll
//                               so infinite-scroll sentinel never triggers.
//                             · Fixed overlay (pointer-events:none) shows the
//                               blocked message without covering the search bar
//                               (position:fixed z-index:1) or bottom nav
//                               (position:fixed z-index:2), because pointer
//                               events pass through our overlay to those elements.
//   everywhere else          – block scrolling on scrollable post containers
//                             (DMs, profile grids, post pages, etc.).

var _mlPostScrollLocked=[];
var _mlExploreActive=false;
var _mlPostScrollDesc=null;

var _ML_BLOCKED_MSG='Blocked by MobileLess';

// ── Helpers ─────────────────────────────────────────────────────────────────

function _mlCurrentPath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlIsMainFeed(){
    var p=_mlCurrentPath();
    return p==='/'||p==='';
}

function _mlIsExplorePage(){
    return _mlCurrentPath().indexOf('/explore')===0;
}

function _mlIsExploreGrid(){
    // Only block the base Explore recommendations page (/explore or /explore/).
    // _mlCurrentPath strips trailing slashes so /explore/ → '/explore'.
    // Sub-paths like /explore/search/ return '/explore/search' → not matched.
    if(_mlCurrentPath()!=='/explore')return false;
    // Also deactivate while the user is actively typing a search query.
    var input=document.querySelector('input[type="search"],input[placeholder*="Search"]');
    if(input&&input.value.length>0)return false;
    return true;
}

// ── Explore: CSS injection approach ─────────────────────────────────────────

function _mlActivateExplore(){
    if(!document.getElementById('ml-explore-style')){
        var s=document.createElement('style');
        s.id='ml-explore-style';
        // Hide the entire grid container (main > div) rather than individual
        // links. This catches everything inside the grid: thumbnails, loaders,
        // skeleton states, tabs — anything that could leak through.
        // The search bar is inside <nav> (not <div>), so it is unaffected.
        // The bottom nav is position:fixed and also unaffected.
        s.textContent=[
            'main>div{visibility:hidden!important;}',
            'html,body{overflow:hidden!important;}',
        ].join('');
        (document.head||document.documentElement).appendChild(s);
    }

    if(!document.getElementById('ml-explore-overlay')){
        var o=document.createElement('div');
        o.id='ml-explore-overlay';
        o.style.cssText=[
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
        ].join(';');
        o.textContent=_ML_BLOCKED_MSG;
        document.body&&document.body.appendChild(o);
    }

    _mlExploreActive=true;
}

function _mlDeactivateExplore(){
    if(!_mlExploreActive)return;
    var s=document.getElementById('ml-explore-style');
    if(s&&s.parentNode)s.parentNode.removeChild(s);
    var o=document.getElementById('ml-explore-overlay');
    if(o&&o.parentNode)o.parentNode.removeChild(o);
    _mlExploreActive=false;
}

// ── Other pages: freeze scrolling on post feed containers ───────────────────

function _mlIsPostFeedContainer(el){
    if(el.clientHeight<200)return false;
    var cs=window.getComputedStyle(el);
    var overflow=cs.overflowY;
    if(overflow!=='scroll'&&overflow!=='auto')return false;
    if(el.scrollHeight<=el.clientHeight+20)return false;
    var articles=el.querySelectorAll('article');
    var postLinks=el.querySelectorAll('a[href*="/p/"]');
    return articles.length>0||postLinks.length>1;
}

function _mlLockPostScroll(el){
    if(_mlPostScrollLocked.indexOf(el)>=0)return;
    _mlPostScrollLocked.push(el);
    var frozenTop=el.scrollTop;
    if(!_mlPostScrollDesc){
        _mlPostScrollDesc=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
    }
    Object.defineProperty(el,'scrollTop',{
        get:function(){return frozenTop;},
        set:function(){if(_mlPostScrollDesc)_mlPostScrollDesc.set.call(el,frozenTop);},
        configurable:true
    });
    el.style.setProperty('overflow-y','hidden','important');
    el.style.setProperty('touch-action','none','important');
    var blockWheel=function(e){e.preventDefault();e.stopPropagation();};
    var blockTouch=function(e){e.preventDefault();e.stopPropagation();};
    el.addEventListener('wheel',blockWheel,{capture:true,passive:false});
    el.addEventListener('touchmove',blockTouch,{capture:true,passive:false});
    el._mlUnlock=function(){
        el.style.removeProperty('overflow-y');
        el.style.removeProperty('touch-action');
        el.removeEventListener('wheel',blockWheel,{capture:true});
        el.removeEventListener('touchmove',blockTouch,{capture:true});
        if(_mlPostScrollDesc){
            Object.defineProperty(el,'scrollTop',_mlPostScrollDesc);
        }
    };
}

function _mlUnlockAllPostScroll(){
    _mlPostScrollLocked.forEach(function(el){
        if(el._mlUnlock)el._mlUnlock();
    });
    _mlPostScrollLocked=[];
}

function _mlLockPostScrollContainers(){
    var divs=document.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
        if(_mlIsPostFeedContainer(divs[i])){
            _mlLockPostScroll(divs[i]);
        }
    }
}

// ── Main interval ────────────────────────────────────────────────────────────

setInterval(function(){
    if(_mlIsMainFeed()){
        _mlUnlockAllPostScroll();
        _mlDeactivateExplore();
        return;
    }
    if(_mlIsExploreGrid()){
        // Base explore page, user NOT searching → block recommendations.
        _mlUnlockAllPostScroll();
        _mlActivateExplore();
        return;
    }
    // /explore/search/, profiles, DMs, etc.
    _mlDeactivateExplore();
    // Don't lock scroll on any Explore sub-page (search results should scroll).
    if(!_mlIsExplorePage()){
        _mlLockPostScrollContainers();
    }
},600);

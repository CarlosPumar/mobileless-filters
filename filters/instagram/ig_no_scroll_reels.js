var _mlReelObs=window._mlReelObs||null;
var _mlReelStyleEl=window._mlReelStyleEl||null;
var _mlReelContainer=window._mlReelContainer||null;
var _mlReelType=window._mlReelType||null;
var _mlReelScrollDesc=window._mlReelScrollDesc||null;
var _mlReelEvListeners=window._mlReelEvListeners||[];
var _mlSwipeTouchStart=window._mlSwipeTouchStart||null;
var _mlSwipeBlocker=window._mlSwipeBlocker||null;
var _mlSwipeStartListener=window._mlSwipeStartListener||null;
var _mlPointerStartYMap=window._mlPointerStartYMap||null;
var _mlPointerMoveBlocker=window._mlPointerMoveBlocker||null;
var _mlPointerDownListener=window._mlPointerDownListener||null;
var _mlPointerUpListener=window._mlPointerUpListener||null;

// Hide only the Reels nav tab so the user cannot navigate to the /reels/ section.
(function(){
    if(document.getElementById('ml-reel-nav-hide'))return;
    var s=document.createElement('style');
    s.id='ml-reel-nav-hide';
    s.textContent='a[href="/reels/"]{display:none!important;}';
    var _rnhParent=document.head||document.documentElement;
    if(_rnhParent)_rnhParent.appendChild(s);
})();

function _mlHasVideo(el){
    return el.querySelectorAll('video').length>0;
}

function _mlIsFullscreenReelContainer(el){
    return el.clientHeight>=window.innerHeight*0.85;
}

// Require truly fullscreen (≥85% viewport) for snap detection in all cases,
// including DMs. The old 55%-for-DMs exception was causing the DM message
// thread container (which contains reel thumbnails) to be matched and locked,
// blocking scroll through messages. Now we only lock if a fullscreen reel
// player is open — which is what the user actually "entered".
function _mlIsSnapReelContainerTallEnough(el){
    return _mlIsFullscreenReelContainer(el);
}

// Returns true only when children are each roughly viewport-height (reel feed).
// Used for transform-based and JS-scroll reel containers.
// Requires at least 2 fullscreen-height children.
function _mlIsReelFeedContainer(el){
    var iH=window.innerHeight;
    var ch=el.children;
    var big=0;
    for(var i=0;i<ch.length&&i<6;i++){
        if(ch[i].getBoundingClientRect().height>=iH*0.7) big++;
    }
    return big>=2;
}

// Returns true when at least 2 children have scroll-snap-align set.
// Instagram's new snap-scroll reel player uses smaller (non-fullscreen) items
// that snap-align, so _mlIsReelFeedContainer no longer works for it.
function _mlHasSnapChildren(el){
    var ch=el.children;
    var count=0;
    for(var i=0;i<ch.length&&i<10;i++){
        var cs=window.getComputedStyle(ch[i]);
        if(cs.scrollSnapAlign&&cs.scrollSnapAlign!=='none') count++;
    }
    return count>=2;
}

// Same as _mlHasSnapChildren but also checks one level deeper (grandchildren).
// Instagram's DM reel overlay wraps snap items one extra level:
//   container (snap-type:y mandatory)
//     > div (no snap-align)  <- direct child
//       > div (snap-align:center) <- grandchild (actual reel item)
function _mlHasSnapDescendants(el){
    if(_mlHasSnapChildren(el))return true;
    var ch=el.children;
    for(var i=0;i<ch.length&&i<5;i++){
        if(_mlHasSnapChildren(ch[i]))return true;
    }
    return false;
}

// True when el still looks like the transform-based reel stack (first two
// children carry Instagram's inline transform-origin reel markup).
function _mlTransformReelMarkupPresent(el){
    var ch=el.children;
    if(ch.length<2)return false;
    var f=ch[0],s=ch[1];
    if(!f||!s)return false;
    var fs=f.getAttribute('style')||'';
    var ss=s.getAttribute('style')||'';
    return fs.indexOf('transform-origin: center top')>=0
        &&ss.indexOf('transform-origin: center top')>=0;
}

function _mlFindTransformContainer(){
    var divs=document.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
        if(!_mlIsFullscreenReelContainer(divs[i]))continue;
        var ch=divs[i].children;
        if(ch.length<2)continue;
        var f=ch[0],s=ch[1];
        if(!f||!s)continue;
        var fs=f.getAttribute('style')||'';
        var ss=s.getAttribute('style')||'';
        if(fs.indexOf('transform-origin: center top')<0)continue;
        if(ss.indexOf('transform-origin: center top')<0)continue;
        if(!_mlHasVideo(divs[i]))continue;
        return divs[i];
    }
    return null;
}

function _mlFindSnapContainer(){
    var divs=document.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
        var cs=window.getComputedStyle(divs[i]);
        if(cs.scrollSnapType!=='y mandatory')continue;
        if(divs[i].scrollHeight<=divs[i].clientHeight+50)continue;
        if(!_mlIsSnapReelContainerTallEnough(divs[i]))continue;
        if(!_mlHasVideo(divs[i]))continue;
        // Instagram changed reel items from fullscreen to smaller snap-aligned cards.
        // Use snap-align presence (direct children or grandchildren) instead of height ratio.
        // DM reel overlay wraps snap items one extra level deep.
        if(!_mlHasSnapDescendants(divs[i]))continue;
        return divs[i];
    }
    return null;
}

// Instagram now implements Reels with overflow-y:scroll + touch-action:none,
// driving scrollTop via JS. Detect it separately.
// Never lock in DMs: the message thread container can look identical
// (fullscreen, overflowY:scroll, video thumbnails) but is not a reel player.
function _mlFindJsScrollContainer(){
    if(_mlIsInDMs())return null;
    var divs=document.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
        var cs=window.getComputedStyle(divs[i]);
        if(cs.overflowY!=='scroll')continue;
        if(divs[i].scrollHeight<=divs[i].clientHeight+200)continue;
        if(!_mlIsFullscreenReelContainer(divs[i]))continue;
        if(!_mlHasVideo(divs[i]))continue;
        if(!_mlIsReelFeedContainer(divs[i]))continue;
        return divs[i];
    }
    return null;
}

// True for touch / pen / unknown primary pointers; false for mouse only.
function _mlIsNonMousePointer(e){
    return e.pointerType!=='mouse';
}

// Primary swipe blocker — window capture phase runs BEFORE document capture.
// Instagram registers pointer/touch listeners on document early; if we only
// listen on document we run after them and preventDefault is too late.
// stopPropagation() on window capture prevents the event reaching document.
function _mlInstallSwipeBlocker(){
    if(_mlSwipeBlocker)return;
    _mlSwipeTouchStart=null;
    _mlPointerStartYMap=new Map();

    _mlSwipeStartListener=function(e){
        if(!e.touches||!e.touches.length)return;
        if(!_mlReelContainer)return;
        var t=e.touches[0];
        if(!t.target||!_mlReelContainer.contains(t.target))return;
        _mlSwipeTouchStart=t.clientY;
    };
    _mlSwipeBlocker=function(e){
        if(_mlSwipeTouchStart===null)return;
        if(_mlIsStoriesPath())return;
        if(!_mlReelContainer){_mlRemoveSwipeBlocker();return;}
        if(e.target&&!_mlReelContainer.contains(e.target))return;
        var dy=Math.abs(e.changedTouches[0].clientY-_mlSwipeTouchStart);
        if(dy>5){
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
        }
    };
    _mlPointerDownListener=function(e){
        if(!_mlIsNonMousePointer(e))return;
        if(!_mlReelContainer||!e.target||!_mlReelContainer.contains(e.target))return;
        _mlPointerStartYMap.set(e.pointerId,e.clientY);
    };
    _mlPointerUpListener=function(e){
        _mlPointerStartYMap.delete(e.pointerId);
    };
    _mlPointerMoveBlocker=function(e){
        if(!_mlIsNonMousePointer(e))return;
        if(!_mlPointerStartYMap.has(e.pointerId))return;
        if(_mlIsStoriesPath())return;
        if(!_mlReelContainer)return;
        if(e.target&&!_mlReelContainer.contains(e.target))return;
        var startY=_mlPointerStartYMap.get(e.pointerId);
        var dy=Math.abs(e.clientY-startY);
        if(dy>5){
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
        }
    };
    var win=window;
    win.addEventListener('touchstart',_mlSwipeStartListener,{capture:true,passive:true});
    win.addEventListener('touchmove',_mlSwipeBlocker,{capture:true,passive:false});
    win.addEventListener('pointerdown',_mlPointerDownListener,{capture:true,passive:true});
    win.addEventListener('pointermove',_mlPointerMoveBlocker,{capture:true,passive:false});
    win.addEventListener('pointerup',_mlPointerUpListener,{capture:true,passive:true});
    win.addEventListener('pointercancel',_mlPointerUpListener,{capture:true,passive:true});
    window._mlSwipeTouchStart=_mlSwipeTouchStart;
    window._mlSwipeBlocker=_mlSwipeBlocker;
    window._mlSwipeStartListener=_mlSwipeStartListener;
    window._mlPointerStartYMap=_mlPointerStartYMap;
    window._mlPointerMoveBlocker=_mlPointerMoveBlocker;
    window._mlPointerDownListener=_mlPointerDownListener;
    window._mlPointerUpListener=_mlPointerUpListener;
}

function _mlRemoveSwipeBlocker(){
    var win=window;
    if(_mlSwipeStartListener){
        win.removeEventListener('touchstart',_mlSwipeStartListener,{capture:true});
        _mlSwipeStartListener=null;
        window._mlSwipeStartListener=null;
    }
    if(_mlSwipeBlocker){
        win.removeEventListener('touchmove',_mlSwipeBlocker,{capture:true});
        _mlSwipeBlocker=null;
        window._mlSwipeBlocker=null;
    }
    if(_mlPointerDownListener){
        win.removeEventListener('pointerdown',_mlPointerDownListener,{capture:true});
        _mlPointerDownListener=null;
        window._mlPointerDownListener=null;
    }
    if(_mlPointerMoveBlocker){
        win.removeEventListener('pointermove',_mlPointerMoveBlocker,{capture:true});
        _mlPointerMoveBlocker=null;
        window._mlPointerMoveBlocker=null;
    }
    if(_mlPointerUpListener){
        win.removeEventListener('pointerup',_mlPointerUpListener,{capture:true});
        win.removeEventListener('pointercancel',_mlPointerUpListener,{capture:true});
        _mlPointerUpListener=null;
        window._mlPointerUpListener=null;
    }
    _mlSwipeTouchStart=null;
    window._mlSwipeTouchStart=null;
    _mlPointerStartYMap=null;
    window._mlPointerStartYMap=null;
}

function _mlLockTransform(c){
    var locked=new Map();
    function addChild(el){
        if(el.nodeType!==1)return;
        var st=el.getAttribute('style')||'';
        if(st.indexOf('transform-origin: center top')>=0){
            locked.set(el,(el.style.transform||''));
            _mlReelObs.observe(el,{attributes:true,attributeFilter:['style']});
        }
    }
    _mlReelObs=new MutationObserver(function(muts){
        muts.forEach(function(m){
            if(m.type==='attributes'&&m.attributeName==='style'){
                var el=m.target;
                if(locked.has(el)){
                    var want=locked.get(el);
                    if(el.style.transform!==want) el.style.transform=want;
                }
            }else if(m.type==='childList'){
                m.addedNodes.forEach(addChild);
            }
        });
    });
    Array.from(c.children).forEach(addChild);
    _mlReelObs.observe(c,{childList:true});
    if(!_mlReelStyleEl){
        _mlReelStyleEl=document.createElement('style');
        _mlReelStyleEl.id='ml-reel-lock';
        _mlReelStyleEl.textContent='div>div[style*="transform-origin: center top"]{transition:none!important;}';
        (document.head||document.documentElement).appendChild(_mlReelStyleEl);
    }
}

function _mlLockSnap(c){
    var frozenTop=c.scrollTop;
    c.style.setProperty('overflow','hidden','important');
    c.style.setProperty('touch-action','none','important');
    c.style.setProperty('overscroll-behavior','none','important');
    _mlReelScrollDesc=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
    Object.defineProperty(c,'scrollTop',{
        get:function(){return frozenTop;},
        set:function(v){_mlReelScrollDesc.set.call(c,frozenTop);},
        configurable:true
    });
    var blockWheel=function(e){e.preventDefault();e.stopPropagation();};
    var blockTouch=function(e){e.preventDefault();e.stopPropagation();};
    c.addEventListener('wheel',blockWheel,{capture:true,passive:false});
    c.addEventListener('touchmove',blockTouch,{capture:true,passive:false});
    _mlReelEvListeners=[{el:c,type:'wheel',fn:blockWheel},{el:c,type:'touchmove',fn:blockTouch}];
}

function _mlLockReels(){
    if(_mlReelContainer)return;
    if(_mlIsStoriesPath())return;
    var tc=_mlFindTransformContainer();
    if(tc){
        var tcs=window.getComputedStyle(tc);
        _mlReelContainer=tc;
        _mlInstallSwipeBlocker();
        if(tcs.overflowY==='scroll'||tcs.overflowY==='auto'){
            // Instagram 2026+: hybrid player. Scroll is JS-driven via
            // pointer events that update child transforms (not scrollTop).
            // Apply BOTH locks:
            // - _mlLockSnap: overflow:hidden + scrollTop freeze (backup)
            // - _mlLockTransform: MutationObserver to revert transform changes
            // - _mlInstallSwipeBlocker: blocks touchmove + pointermove
            _mlReelType='snap';
            _mlLockSnap(tc);
            _mlLockTransform(tc);
        }else{
            _mlReelType='transform';
            _mlLockTransform(tc);
        }
        return;
    }
    var sc=_mlFindSnapContainer();
    if(sc){
        _mlReelContainer=sc;
        _mlReelType='snap';
        _mlInstallSwipeBlocker();
        _mlLockSnap(sc);
        return;
    }
    var jsc=_mlFindJsScrollContainer();
    if(jsc){
        _mlReelContainer=jsc;
        _mlReelType='snap';
        _mlInstallSwipeBlocker();
        _mlLockSnap(jsc);
        return;
    }
}

function _mlUnlockReels(){
    _mlRemoveSwipeBlocker();
    if(_mlReelObs){_mlReelObs.disconnect();_mlReelObs=null;}
    if(_mlReelStyleEl&&_mlReelStyleEl.parentNode){_mlReelStyleEl.parentNode.removeChild(_mlReelStyleEl);_mlReelStyleEl=null;}
    if(_mlReelType==='snap'&&_mlReelContainer){
        _mlReelContainer.style.removeProperty('overflow');
        _mlReelContainer.style.removeProperty('touch-action');
        _mlReelContainer.style.removeProperty('overscroll-behavior');
        if(_mlReelScrollDesc){
            Object.defineProperty(_mlReelContainer,'scrollTop',_mlReelScrollDesc);
            _mlReelScrollDesc=null;
        }
    }
    _mlReelEvListeners.forEach(function(l){l.el.removeEventListener(l.type,l.fn,{capture:true});});
    _mlReelEvListeners=[];
    _mlReelContainer=null;
    _mlReelType=null;
}

function _mlCurrentPath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlIsInDMs(){
    return _mlCurrentPath().indexOf('/direct/')===0;
}

function _mlIsStoriesPath(){
    return _mlCurrentPath().indexOf('/stories/')===0;
}

// Height check for periodic unlock: container must still be fullscreen.
function _mlReelContainerStillTallEnough(){
    if(!_mlReelContainer)return false;
    return _mlIsFullscreenReelContainer(_mlReelContainer);
}

if(window._mlReelLockInterval)clearInterval(window._mlReelLockInterval);
window._mlReelLockInterval=setInterval(function(){
    if(_mlReelContainer){
        var stillValid=_mlReelType==='snap'
            ? (_mlHasSnapDescendants(_mlReelContainer)
               ||_mlIsReelFeedContainer(_mlReelContainer)
               ||(_mlTransformReelMarkupPresent(_mlReelContainer)&&_mlHasVideo(_mlReelContainer)))
            : (_mlReelType==='transform'
                ? (_mlTransformReelMarkupPresent(_mlReelContainer)&&_mlHasVideo(_mlReelContainer))
                : _mlIsReelFeedContainer(_mlReelContainer));
        var shouldUnlock;
        if(_mlIsInDMs()){
            // In DMs the reel player is always snap-based (verified empirically).
            // Any transform or JS-scroll lock here is stale — it came from a reel
            // feed the user navigated away from without triggering an unlock.
            // Release those immediately so DM scroll is never blocked by prior state.
            // Snap locks are kept only while the container is still fullscreen and
            // has snap properties (i.e. the DM reel player overlay is still open).
            shouldUnlock = _mlReelType!=='snap'
                || !document.contains(_mlReelContainer)
                || !_mlReelContainerStillTallEnough()
                || !stillValid;
        }else{
            shouldUnlock = !document.contains(_mlReelContainer)
                || !_mlReelContainerStillTallEnough()
                || !stillValid
                || _mlIsStoriesPath();
        }
        if(shouldUnlock) _mlUnlockReels();
    }
    if(!_mlReelContainer){
        _mlLockReels();
    }
},500);
